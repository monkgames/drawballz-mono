import { Container, Sprite, Assets, Texture, Rectangle } from 'pixi.js'

export type BallColor = 'green' | 'pink' | 'orange' | 'yellow' | 'blue'

const TRAIL_CENTER_Y_OFFSET: Record<BallColor, number> = {
	green: 0,
	pink: 0,
	orange: 0,
	yellow: -2,
	blue: 0,
}

async function loadTexture(basePath: string): Promise<Texture | null> {
	const candidates = [
		`${basePath}.svg`,
		`${basePath}.png`,
		`${basePath}.webp`,
	]
	for (const url of candidates) {
		try {
			const tex = await Assets.load(url)
			if (tex) return tex as Texture
		} catch (_) {}
	}
	return null
}

async function loadTrimmedTexture(basePath: string): Promise<Texture | null> {
	const candidates = [
		`${basePath}.svg`,
		`${basePath}.png`,
		`${basePath}.webp`,
	]
	for (const url of candidates) {
		try {
			const img = await new Promise<HTMLImageElement>(
				(resolve, reject) => {
					const image = new Image()
					image.crossOrigin = 'anonymous'
					image.onload = () => resolve(image)
					image.onerror = e => reject(e)
					image.src = url
				}
			)
			const w = img.naturalWidth || img.width
			const h = img.naturalHeight || img.height
			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext('2d')
			if (!ctx) continue
			ctx.clearRect(0, 0, w, h)
			ctx.drawImage(img, 0, 0)
			const data = ctx.getImageData(0, 0, w, h).data
			let minX = w,
				minY = h,
				maxX = -1,
				maxY = -1
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const i = (y * w + x) * 4
					const a = data[i + 3]
					if (a > 5) {
						if (x < minX) minX = x
						if (y < minY) minY = y
						if (x > maxX) maxX = x
						if (y > maxY) maxY = y
					}
				}
			}
			if (maxX < minX || maxY < minY) {
				return Texture.from(img)
			}
			const cropW = Math.max(1, maxX - minX + 1)
			const cropH = Math.max(1, maxY - minY + 1)
			const crop = document.createElement('canvas')
			crop.width = cropW
			crop.height = cropH
			const cctx = crop.getContext('2d')
			if (!cctx) continue
			cctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
			return Texture.from(crop)
		} catch (_) {}
	}
	return null
}

async function loadTrimmedCanvas(
	basePath: string
): Promise<HTMLCanvasElement | null> {
	const candidates = [
		`${basePath}.svg`,
		`${basePath}.png`,
		`${basePath}.webp`,
	]
	for (const url of candidates) {
		try {
			const img = await new Promise<HTMLImageElement>(
				(resolve, reject) => {
					const image = new Image()
					image.crossOrigin = 'anonymous'
					image.onload = () => resolve(image)
					image.onerror = e => reject(e)
					image.src = url
				}
			)
			const w = img.naturalWidth || img.width
			const h = img.naturalHeight || img.height
			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext('2d')
			if (!ctx) continue
			ctx.clearRect(0, 0, w, h)
			ctx.drawImage(img, 0, 0)
			const data = ctx.getImageData(0, 0, w, h).data
			let minX = w,
				minY = h,
				maxX = -1,
				maxY = -1
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const i = (y * w + x) * 4
					const a = data[i + 3]
					if (a > 5) {
						if (x < minX) minX = x
						if (y < minY) minY = y
						if (x > maxX) maxX = x
						if (y > maxY) maxY = y
					}
				}
			}
			if (maxX < minX || maxY < minY) {
				const c = document.createElement('canvas')
				c.width = w
				c.height = h
				const cc = c.getContext('2d')
				if (!cc) continue
				cc.drawImage(img, 0, 0)
				return c
			}
			const cropW = Math.max(1, maxX - minX + 1)
			const cropH = Math.max(1, maxY - minY + 1)
			const crop = document.createElement('canvas')
			crop.width = cropW
			crop.height = cropH
			const cctx = crop.getContext('2d')
			if (!cctx) continue
			cctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
			return crop
		} catch (_) {}
	}
	return null
}

type AtlasTextures = Record<string, Texture>
let ballsAtlas: AtlasTextures | null = null
let ballsAtlasPromise: Promise<AtlasTextures> | null = null
let packedAtlas: AtlasTextures | null = null
let packedAtlasPromise: Promise<AtlasTextures | null> | null = null

export async function ensureBallsAtlas(): Promise<AtlasTextures> {
	if (ballsAtlas) return ballsAtlas
	if (ballsAtlasPromise) return ballsAtlasPromise
	ballsAtlasPromise = (async () => {
		const colors: BallColor[] = [
			'green',
			'pink',
			'orange',
			'yellow',
			'blue',
		]
		const padding = 4
		const ballCanvases = await Promise.all(
			colors.map(c => loadTrimmedCanvas(`/assets/sprites/balls/${c}`))
		)
		const trailCanvases = await Promise.all(
			colors.map(c => loadTrimmedCanvas(`/assets/sprites/trails/${c}`))
		)
		const all = [...ballCanvases, ...trailCanvases].filter(
			(c): c is HTMLCanvasElement => !!c
		)
		if (all.length === 0) {
			ballsAtlas = {}
			return ballsAtlas
		}
		const maxW = Math.max(...all.map(c => c.width))
		const maxH = Math.max(...all.map(c => c.height))
		const cols = 2
		const rows = Math.max(ballCanvases.length, trailCanvases.length)
		const atlasW = cols * (maxW + padding) + padding
		const atlasH = rows * (maxH + padding) + padding
		const atlasCanvas = document.createElement('canvas')
		atlasCanvas.width = atlasW
		atlasCanvas.height = atlasH
		const ctx = atlasCanvas.getContext('2d') as CanvasRenderingContext2D
		ctx.clearRect(0, 0, atlasW, atlasH)
		const positions: {
			key: string
			x: number
			y: number
			w: number
			h: number
		}[] = []
		for (let i = 0; i < rows; i++) {
			const bx = padding
			const by = padding + i * (maxH + padding)
			const tx = padding + (maxW + padding)
			const ty = by
			const b = ballCanvases[i]
			const t = trailCanvases[i]
			if (b) {
				ctx.drawImage(b, bx, by)
				positions.push({
					key: `ball/${colors[i]}`,
					x: bx,
					y: by,
					w: b.width,
					h: b.height,
				})
			}
			if (t) {
				ctx.drawImage(t, tx, ty)
				positions.push({
					key: `trail/${colors[i]}`,
					x: tx,
					y: ty,
					w: t.width,
					h: t.height,
				})
			}
		}
		const baseTex = Texture.from(atlasCanvas)
		const atlas: AtlasTextures = {}
		for (const p of positions) {
			const frame = new Rectangle(p.x, p.y, p.w, p.h)
			atlas[p.key] = new Texture({ source: baseTex.source, frame })
		}
		ballsAtlas = atlas
		return ballsAtlas
	})()
	return ballsAtlasPromise
}

async function ensurePackedAtlas(): Promise<AtlasTextures | null> {
	if (packedAtlas) return packedAtlas
	if (packedAtlasPromise) return packedAtlasPromise
	packedAtlasPromise = (async () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const paths = [
			dpr > 1
				? '/assets/atlases/balls@2x.json'
				: '/assets/atlases/balls.json',
		]
		for (const p of paths) {
			try {
				const sheet: any = await Assets.load(p)
				const textures: Record<string, Texture> =
					(sheet && sheet.textures) || {}
				const colors: BallColor[] = [
					'green',
					'pink',
					'orange',
					'yellow',
					'blue',
				]
				const atlas: AtlasTextures = {}
				for (const c of colors) {
					const ballKeys = [
						`ball/${c}`,
						`balls/${c}`,
						`ball_${c}`,
						`${c}_ball`,
						`${c}`,
					]
					const trailKeys = [
						`trail/${c}`,
						`trails/${c}`,
						`trail_${c}`,
						`${c}_trail`,
						`${c}_t`,
					]
					let b: Texture | undefined
					for (const k of ballKeys) {
						if (textures[k]) {
							b = textures[k]
							break
						}
					}
					let t: Texture | undefined
					for (const k of trailKeys) {
						if (textures[k]) {
							t = textures[k]
							break
						}
					}
					if (b) atlas[`ball/${c}`] = b
					if (t) atlas[`trail/${c}`] = t
				}
				packedAtlas = atlas
				return packedAtlas
			} catch (_) {}
		}
		packedAtlas = null
		return packedAtlas
	})()
	return packedAtlasPromise
}

export async function createBall(color: BallColor, opts?: { noFX?: boolean }) {
	const container = new Container()
	const packed = await ensurePackedAtlas()
	const atlas = packed || (await ensureBallsAtlas())
	const ballTex =
		atlas[`ball/${color}`] ||
		(await loadTrimmedTexture(`/assets/sprites/balls/${color}`)) ||
		(await loadTexture(`/assets/sprites/balls/${color}`))
	const trailTex = opts?.noFX
		? null
		: atlas[`trail/${color}`] ||
		  (await loadTrimmedTexture(`/assets/sprites/trails/${color}`)) ||
		  (await loadTexture(`/assets/sprites/trails/${color}`))

	if (trailTex) {
		const trail = new Sprite({ texture: trailTex })
		trail.anchor = 0.5
		trail.roundPixels = true
		container.addChild(trail)
		;(container as any).userData = { trail }
	}

	if (ballTex) {
		const ball = new Sprite({ texture: ballTex })
		ball.anchor = 0.5
		ball.roundPixels = true
		container.addChild(ball)
		const trail = container.children[0] as Sprite | undefined
		if (trail) {
			const desiredGap = 40
			const bH = ballTex.height || 300
			const tH = trailTex?.height || 0
			const offset = Math.round(desiredGap + bH * 0.5 + tH * 0.5)
			const centerAdj = TRAIL_CENTER_Y_OFFSET[color] || 0
			trail.y = offset + centerAdj
			const trailBottomOffset =
				trail.y + ((trailTex?.height as number) || 0) * 0.5
			;(container as any).userData = {
				baseWidth: ballTex.width || 0,
				trailBottomOffset,
				ball,
				trail,
			}
		} else {
			;(container as any).userData = {
				baseWidth: ballTex.width || 0,
				trailBottomOffset: (ballTex.height || 0) * 0.5,
				ball,
			}
		}
	}

	return container
}
