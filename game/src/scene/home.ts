import { Container, Graphics, Text, Assets, Sprite, Texture } from 'pixi.js'
import { createBall, BallColor } from '@/modules/ball'
import { isMobileDevice, isSlowNetwork } from '@/util/env'
import { stopBGM, autoStartBGM } from '@/audio/bgm'
import { playHoverSound, playClickSound } from '@/audio/sfx'
import { gsap } from 'gsap'

function makeBackground(width: number, height: number) {
	const g = new Graphics()
	g.rect(0, 0, width, height)
	g.fill({ color: 0x0e0e12 })
	return g
}

function makeRadialTexture(
	size: number,
	innerColor: string,
	outerColor: string,
	highlightOffset = { x: -0.2, y: -0.2 }
): Texture {
	const c = document.createElement('canvas')
	c.width = c.height = size
	const ctx = c.getContext('2d') as CanvasRenderingContext2D
	const cx = size * (0.5 + highlightOffset.x * 0.3)
	const cy = size * (0.5 + highlightOffset.y * 0.3)
	const grad = ctx.createRadialGradient(
		cx,
		cy,
		size * 0.05,
		size * 0.55,
		size * 0.55,
		size * 0.65
	)
	grad.addColorStop(0, innerColor)
	grad.addColorStop(1, outerColor)
	ctx.fillStyle = grad
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2)
	ctx.fill()
	return Texture.from(c)
}

const DESIGN_W = 1920
const DESIGN_H = 1080
const SHOW_GRID = false
const SHOW_DEBUG = false
const SHOW_STREAK_MARKERS = false
const RED_GAP_LOCKED = [40, 40, 40, 40] as const
const YELLOW_GAP_LOCKED = 0
const LOCK_POSITIONS = true
let LOCKED_YELLOW_GAPS: number[] | null = null

async function loadBackgroundTexture(): Promise<Texture | null> {
	const useHiRes = !isSlowNetwork() && (window.devicePixelRatio || 1) > 1
	const candidates: string[] = []
	if (useHiRes) {
		candidates.push(
			'/assets/bg/bg_base@2x.webp',
			'/assets/bg/bg_base@2x.jpg',
			'/assets/bg/bg_base@2x.png'
		)
	}
	candidates.push(
		'/assets/bg/bg_base.webp',
		'/assets/bg/bg_base.jpg',
		'/assets/bg/bg_base.png',
		'/bg/bg_base.webp',
		'/bg/bg_base.jpg',
		'/bg/bg_base.png'
	)
	for (const url of candidates) {
		try {
			const tex = await Assets.load(url)
			if (tex) return tex as Texture
		} catch (_) {
			// try next
		}
	}
	return null
}

async function loadBackgroundOverlayTexture(): Promise<Texture | null> {
	const useHiRes = !isSlowNetwork() && (window.devicePixelRatio || 1) > 1
	const atlasCandidates = useHiRes
		? ['/assets/atlases/ui@2x.json', '/assets/atlases/bg@2x.json']
		: ['/assets/atlases/ui.json', '/assets/atlases/bg.json']
	for (const a of atlasCandidates) {
		try {
			const sheet: any = await Assets.load(a)
			const textures: Record<string, Texture> =
				(sheet && sheet.textures) || {}
			const keys = ['bg/layer', 'overlay', 'bg_layer', 'layer']
			for (const k of keys) {
				if (textures[k]) return textures[k]
			}
		} catch (_) {}
	}
	const candidates = [
		'/assets/bg/bg_layer.webp',
		'/assets/bg/bg_layer.png',
		'/bg/bg_layer.webp',
		'/bg/bg_layer.png',
	]
	for (const url of candidates) {
		try {
			const tex = await Assets.load(url)
			if (tex) return tex as Texture
		} catch (_) {}
	}
	return null
}

async function loadBackgroundVideoSprite(): Promise<Sprite | null> {
	try {
		if (isSlowNetwork()) return null
		const video = document.createElement('video')
		const candidates = ['/assets/bg/video_bg.webm', '/bg/video_bg.webm']
		video.src = candidates[0]
		video.crossOrigin = 'anonymous'
		video.muted = true
		video.loop = true
		video.playsInline = true
		video.preload = 'metadata'
		await new Promise<void>((resolve, reject) => {
			const onReady = () => {
				video.removeEventListener('loadeddata', onReady)
				resolve()
			}
			const onError = (e: Event) => {
				video.removeEventListener('error', onError)
				if (video.src !== candidates[1]) {
					video.src = candidates[1]
					video.load()
				} else {
					reject(e)
				}
			}
			video.addEventListener('loadeddata', onReady)
			video.addEventListener('error', onError)
			video.load()
		})
		await video.play().catch(() => {})
		const tex = Texture.from(video)
		return new Sprite({ texture: tex })
	} catch (_) {
		return null
	}
}

async function loadLogoTexture(): Promise<Texture | null> {
	const dpr = window.devicePixelRatio || 1
	const atlasCandidates =
		dpr > 1
			? ['/assets/atlases/ui@2x.json', '/assets/atlases/balls@2x.json']
			: ['/assets/atlases/ui.json', '/assets/atlases/balls.json']
	for (const a of atlasCandidates) {
		try {
			const sheet: any = await Assets.load(a)
			const textures: Record<string, Texture> =
				(sheet && sheet.textures) || {}
			const keys = ['ui/logo', 'logo', 'drawballz_brand']
			for (const k of keys) {
				if (textures[k]) return textures[k]
			}
		} catch (_) {}
	}
	const candidates = [
		'/assets/ui/drawballz_brand.svg',
		'/assets/ui/drawballz_brand.png',
		'/ui/drawballz_brand.svg',
		'/ui/drawballz_brand.png',
	]
	for (const url of candidates) {
		try {
			const tex = await Assets.load(url)
			if (tex) return tex as Texture
		} catch (_) {}
	}
	return null
}

export async function createHomeScene(w: number, h: number) {
	const root = new Container()
	const content = new Container()
	content.sortableChildren = true
	root.addChild(content)
	const bgGroup = new Container()
	bgGroup.eventMode = 'none'
	content.addChildAt(bgGroup, 0)
	let bgLayer: Sprite | Graphics | null = null
	let bgIsVideo = false

	// Add immediate solid background to avoid any blank stage
	const bgSolid = makeBackground(DESIGN_W, DESIGN_H)
	bgGroup.addChild(bgSolid)
	bgLayer = bgSolid
	const baseTexPromise = loadBackgroundTexture()
	const bgVideoPromise = loadBackgroundVideoSprite()
	void (async () => {
		const bgTex = await baseTexPromise
		if (bgTex && !bgIsVideo) {
			const sprite = new Sprite({ texture: bgTex })
			sprite.anchor = 0.5
			sprite.x = DESIGN_W / 2
			sprite.y = DESIGN_H / 2
			const scale = Math.max(
				DESIGN_W / bgTex.width,
				DESIGN_H / bgTex.height
			)
			sprite.scale.set(scale)
			bgGroup.addChildAt(sprite, 0)
			if (bgLayer) {
				try {
					bgGroup.removeChild(bgLayer)
				} catch (_) {}
			}
			bgLayer = sprite
			if (!isMobileDevice()) {
				gsap.to(sprite, {
					rotation: 0.01,
					yoyo: true,
					repeat: -1,
					duration: 12,
					ease: 'sine.inOut',
				})
				gsap.to(sprite.scale, {
					x: scale * 1.02,
					y: scale * 1.02,
					yoyo: true,
					repeat: -1,
					duration: 18,
					ease: 'sine.inOut',
				})
			}
		}
	})()
	void (async () => {
		const bgVideo = await bgVideoPromise
		if (bgVideo) {
			bgIsVideo = true
			const sprite = bgVideo
			sprite.anchor = 0.5
			sprite.x = DESIGN_W / 2
			sprite.y = DESIGN_H / 2
			const texW = sprite.texture.width || 1
			const texH = sprite.texture.height || 1
			const scale = Math.max(DESIGN_W / texW, DESIGN_H / texH)
			sprite.scale.set(scale)
			bgGroup.addChildAt(sprite, 0)
			if (bgLayer) {
				try {
					bgGroup.removeChild(bgLayer)
				} catch (_) {}
			}
			bgLayer = sprite
			if (!isMobileDevice()) {
				gsap.to(sprite, {
					rotation: 0.01,
					yoyo: true,
					repeat: -1,
					duration: 12,
					ease: 'sine.inOut',
				})
				gsap.to(sprite.scale, {
					x: scale * 1.02,
					y: scale * 1.02,
					yoyo: true,
					repeat: -1,
					duration: 18,
					ease: 'sine.inOut',
				})
			}
			const overlayTex = await loadBackgroundOverlayTexture()
			if (overlayTex) {
				const overlay = new Sprite({ texture: overlayTex })
				overlay.anchor = 0.5
				overlay.x = DESIGN_W / 2
				overlay.y = DESIGN_H / 2
				const s = Math.max(
					DESIGN_W / overlayTex.width,
					DESIGN_H / overlayTex.height
				)
				overlay.scale.set(s)
				bgGroup.addChild(overlay)
				if (!isMobileDevice()) {
					gsap.to(overlay, {
						y: overlay.y + 8,
						rotation: 0.01,
						yoyo: true,
						repeat: -1,
						duration: 6,
						ease: 'sine.inOut',
					})
					gsap.to(overlay.scale, {
						x: s * 1.01,
						y: s * 1.01,
						yoyo: true,
						repeat: -1,
						duration: 10,
						ease: 'sine.inOut',
					})
				}
			}
		}
	})()

	const bgFX = new Container()
	content.addChild(bgFX)
	if (SHOW_STREAK_MARKERS) {
		const marks = new Graphics()
		bgFX.addChild(marks)
		const drawDashed = (
			x1: number,
			y1: number,
			x2: number,
			y2: number,
			dash: number,
			gap: number,
			width: number,
			color: number,
			alpha: number
		) => {
			const dx = x2 - x1
			const dy = y2 - y1
			const len = Math.hypot(dx, dy)
			const ux = dx / len
			const uy = dy / len
			let traveled = 0
			while (traveled < len) {
				const sx = x1 + ux * traveled
				const sy = y1 + uy * traveled
				const seg = Math.min(dash, len - traveled)
				const ex = sx + ux * seg
				const ey = sy + uy * seg
				marks.moveTo(sx, sy)
				marks.lineTo(ex, ey)
				traveled += seg + gap
			}
			marks.stroke({ color, alpha, width })
		}
		drawDashed(
			Math.round(DESIGN_W * 0.06),
			Math.round(DESIGN_H * 0.22),
			Math.round(DESIGN_W * 0.74),
			Math.round(DESIGN_H * 0.38),
			80,
			40,
			4,
			0xffffff,
			0.25
		)
		drawDashed(
			Math.round(DESIGN_W * 0.18),
			Math.round(DESIGN_H * 0.56),
			Math.round(DESIGN_W * 0.92),
			Math.round(DESIGN_H * 0.52),
			90,
			36,
			3,
			0xffffff,
			0.22
		)
		drawDashed(
			Math.round(DESIGN_W * 0.82),
			Math.round(DESIGN_H * 0.84),
			Math.round(DESIGN_W * 0.26),
			Math.round(DESIGN_H * 0.68),
			70,
			32,
			4,
			0xffffff,
			0.24
		)
		drawDashed(
			Math.round(DESIGN_W * 0.06),
			Math.round(DESIGN_H * 0.78),
			Math.round(DESIGN_W * 0.32),
			Math.round(DESIGN_H * 0.86),
			70,
			30,
			3,
			0xffffff,
			0.18
		)
	}
	// scanlines moved to a global filter on content
	if (SHOW_GRID) {
		const grid = new Graphics()
		for (let x = 0; x <= DESIGN_W; x += 40) {
			grid.moveTo(x, 0)
			grid.lineTo(x, DESIGN_H)
		}
		for (let y = 0; y <= DESIGN_H; y += 40) {
			grid.moveTo(0, y)
			grid.lineTo(DESIGN_W, y)
		}
		grid.stroke({ color: 0xffffff, alpha: 0.06, width: 1 })
		content.addChild(grid)
	}

	const headerCenterY = 80
	let nextY = Math.round(headerCenterY + 100)
	const logoTex = await loadLogoTexture()
	if (logoTex) {
		const logo = new Sprite({ texture: logoTex })
		logo.anchor = 0.5
		logo.x = Math.round(DESIGN_W / 2)
		logo.y = headerCenterY
		const targetWidth = 420 * 1.75
		const scale = targetWidth / logoTex.width
		logo.scale.set(scale)
		content.addChild(logo)
		gsap.to(logo.scale, {
			x: scale * 1.03,
			y: scale * 1.03,
			yoyo: true,
			repeat: -1,
			duration: 3.2,
			ease: 'sine.inOut',
		})
		gsap.to(logo, {
			rotation: 0.01,
			yoyo: true,
			repeat: -1,
			duration: 4.0,
			ease: 'sine.inOut',
		})
		const logoBottomY = headerCenterY + (logoTex.height * scale) / 2
		nextY = Math.round(logoBottomY + 60)
	} else {
		const title = new Text({
			text: 'DRAWBALLZ',
			style: {
				fontFamily:
					'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
				fontSize: 56,
				fill: 0xff6b00,
				stroke: { color: '#000000', width: 6 },
			},
		})
		title.anchor = 0.5
		title.x = Math.round(DESIGN_W / 2)
		title.y = headerCenterY
		title.roundPixels = true
		title.resolution = Math.max(window.devicePixelRatio || 1, 2)
		content.addChild(title)
		gsap.to(title.scale, {
			x: 1.03,
			y: 1.03,
			yoyo: true,
			repeat: -1,
			duration: 3.0,
			ease: 'sine.inOut',
		})
		gsap.to(title, {
			alpha: 0.9,
			yoyo: true,
			repeat: -1,
			duration: 2.8,
			ease: 'sine.inOut',
		})
	}

	const bgmBtnBox = new Graphics()
	const BGM_W = 100
	const BGM_H = 32
	bgmBtnBox.roundRect(0, 0, BGM_W, BGM_H, 8)
	const bgmMutedInit =
		(localStorage.getItem('bgmMuted') || '') === '1' ? true : false
	bgmBtnBox.fill({
		color: bgmMutedInit ? 0xff4d4f : 0x98ffb3,
		alpha: 1.0,
	})
	bgmBtnBox.stroke({ color: 0xffffff, width: 2, alpha: 0.5 })
	bgmBtnBox.eventMode = 'static'
	bgmBtnBox.cursor = 'pointer'
	content.addChild(bgmBtnBox)

	// Position BGM button at top-left (vacated by prize multipliers)
	bgmBtnBox.x = 24
	bgmBtnBox.y = 24

	const readyText = new Text({
		text: 'Not Ready',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xff4d4f },
	})
	readyText.anchor.set(0, 0.5) // Left align
	readyText.x = bgmBtnBox.x
	readyText.y = Math.round(bgmBtnBox.y + BGM_H + 24)
	readyText.roundPixels = true
	readyText.resolution = Math.max(window.devicePixelRatio || 1, 2)
	content.addChild(readyText)

	const bgmBtnLabel = new Text({
		text: bgmMutedInit ? 'BGM OFF' : 'BGM ON',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x000000 },
	})
	bgmBtnLabel.anchor = 0.5
	bgmBtnLabel.x = Math.round(bgmBtnBox.x + BGM_W / 2)
	bgmBtnLabel.y = Math.round(bgmBtnBox.y + BGM_H / 2)
	bgmBtnLabel.roundPixels = true
	bgmBtnLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	content.addChild(bgmBtnLabel)
	bgmBtnBox.on('pointertap', async () => {
		try {
			const {
				isMuted,
				setMuted,
				ensureAudioUnlocked,
				startBGMOnce,
				stopBGMElement,
				stopBGM,
			} = await import('@/audio/bgm')
			const mutedNow = isMuted()
			if (mutedNow) {
				setMuted(false)
				bgmBtnBox.fill({ color: 0x98ffb3, alpha: 1.0 })
				bgmBtnLabel.text = 'BGM ON'
				await ensureAudioUnlocked()
				await startBGMOnce()
				stopBGMElement()
			} else {
				setMuted(true)
				bgmBtnBox.fill({ color: 0xff4d4f, alpha: 1.0 })
				bgmBtnLabel.text = 'BGM OFF'
				stopBGM()
				stopBGMElement()
			}
		} catch (_) {}
	})
	const matchBtnBox = new Graphics()
	const BTN_W = 260
	const BTN_H = 56
	const btnY = Math.round(DESIGN_H - 80)
	matchBtnBox.roundRect(0, 0, BTN_W, BTN_H, 14)
	matchBtnBox.fill({ color: 0x98ffb3, alpha: 1.0 })
	// Pivot center for scaling effects
	matchBtnBox.pivot.set(BTN_W / 2, BTN_H / 2)
	matchBtnBox.x = Math.round(DESIGN_W / 2)
	matchBtnBox.y = Math.round(btnY + BTN_H / 2)
	matchBtnBox.eventMode = 'static'
	matchBtnBox.cursor = 'pointer'
	content.addChild(matchBtnBox)

	// Add pulse animation
	gsap.to(matchBtnBox.scale, {
		x: 1.05,
		y: 1.05,
		duration: 0.8,
		yoyo: true,
		repeat: -1,
		ease: 'sine.inOut',
	})

	const matchBtnLabel = new Text({
		text: 'MATCH',
		style: {
			fontFamily: 'system-ui',
			fontSize: 20,
			fill: 0x000000,
			fontWeight: 'bold',
		},
	})
	matchBtnLabel.anchor = 0.5
	matchBtnLabel.x = matchBtnBox.x
	matchBtnLabel.y = matchBtnBox.y
	matchBtnLabel.roundPixels = true
	matchBtnLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	content.addChild(matchBtnLabel)

	const cancelBtnBox = new Graphics()
	cancelBtnBox.roundRect(0, 0, BTN_W, BTN_H, 14)
	cancelBtnBox.fill({ color: 0xff4d4f, alpha: 1.0 })
	// Pivot center
	cancelBtnBox.pivot.set(BTN_W / 2, BTN_H / 2)
	cancelBtnBox.x = matchBtnBox.x
	cancelBtnBox.y = matchBtnBox.y
	cancelBtnBox.eventMode = 'none'
	cancelBtnBox.cursor = 'auto'
	cancelBtnBox.visible = false
	content.addChild(cancelBtnBox)

	const cancelBtnLabel = new Text({
		text: 'CANCEL',
		style: {
			fontFamily: 'system-ui',
			fontSize: 20,
			fill: 0xffffff,
			fontWeight: 'bold',
		},
	})
	cancelBtnLabel.anchor = 0.5
	cancelBtnLabel.x = cancelBtnBox.x
	cancelBtnLabel.y = cancelBtnBox.y
	cancelBtnLabel.roundPixels = true
	cancelBtnLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	cancelBtnLabel.visible = false
	content.addChild(cancelBtnLabel)
	const setBtnEnabled = (enabled: boolean) => {
		matchBtnBox.alpha = enabled ? 1.0 : 0.4
		matchBtnBox.eventMode = enabled ? 'static' : 'none'
		matchBtnBox.cursor = enabled ? 'pointer' : 'auto'
		matchBtnLabel.alpha = enabled ? 1.0 : 0.5
	}
	setBtnEnabled(false)
	matchBtnBox.on('pointertap', () => {
		root.emit('requestMatch')
		root.emit('showMatching')
		matchBtnBox.visible = false
		matchBtnLabel.visible = false
		cancelBtnBox.visible = true
		cancelBtnLabel.visible = true
		cancelBtnBox.eventMode = 'static'
		cancelBtnBox.cursor = 'pointer'
	})
	cancelBtnBox.on('pointertap', () => {
		root.emit('cancelMatching')
		root.emit('hideMatching')
		cancelBtnBox.visible = false
		cancelBtnLabel.visible = false
		matchBtnBox.visible = true
		matchBtnLabel.visible = true
		cancelBtnBox.eventMode = 'none'
		cancelBtnBox.cursor = 'auto'
	})
	root.on('readyStatus', (ready: boolean) => {
		readyText.text = ready ? 'Ready' : 'Not Ready'
		readyText.style.fill = ready ? 0x98ffb3 : 0xff4d4f
		setBtnEnabled(ready)
	})
	// default to not ready until we detect configured state
	root.emit('readyStatus', false)
	const matchStatus = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x98ffb3 },
	})
	matchStatus.anchor = 0.5
	matchStatus.x = Math.round(DESIGN_W - 160)
	matchStatus.y = Math.round(headerCenterY + 40)
	matchStatus.roundPixels = true
	matchStatus.resolution = Math.max(window.devicePixelRatio || 1, 2)
	content.addChild(matchStatus)
	root.on('matchStatus', (msg: string) => {
		matchStatus.text = msg || ''
	})
	// Debug panel is provided globally; omit per-home duplicate
	const matchingUI = new Container()
	matchingUI.zIndex = 900
	const loaderR2 = 18
	const loader2 = new Graphics()
	const loaderLabel = new Text({
		text: 'Matching…',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	const readyCountText = new Text({
		text: 'Ready players: 0',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x98ffb3 },
	})
	loader2.x = Math.round(DESIGN_W / 2)
	loader2.y = Math.round(btnY - 60)
	loaderLabel.anchor = 0.5
	loaderLabel.x = loader2.x
	loaderLabel.y = loader2.y + 46
	readyCountText.anchor = 0.5
	readyCountText.x = loader2.x
	readyCountText.y = loaderLabel.y + 30
	matchingUI.addChild(loader2)
	matchingUI.addChild(loaderLabel)
	matchingUI.addChild(readyCountText)
	const renderLoader2 = (p: number) => {
		loader2.clear()
		loader2.circle(0, 0, loaderR2)
		loader2.stroke({ color: 0x98ffb3, width: 2, alpha: 0.1 })
		loader2.arc(
			0,
			0,
			loaderR2,
			-Math.PI / 2 + p * Math.PI * 2,
			-Math.PI / 2 + p * Math.PI * 2 + Math.PI * 0.75
		)
		loader2.stroke({ color: 0x98ffb3, width: 3, alpha: 0.9 })
		// Inner ring counter-rotating
		loader2.arc(
			0,
			0,
			loaderR2 * 0.65,
			p * -Math.PI * 4,
			p * -Math.PI * 4 + Math.PI
		)
		loader2.stroke({ color: 0xe6f7ff, width: 2, alpha: 0.6 })
	}
	const loaderState2 = { p: 0 }
	renderLoader2(0)
	gsap.to(loaderState2, {
		p: 1,
		duration: 2.2,
		ease: 'none',
		repeat: -1,
		onUpdate: () => renderLoader2(loaderState2.p),
	})
	matchingUI.visible = false
	content.addChild(matchingUI)
	root.on('showMatching', () => {
		matchingUI.visible = true
	})
	root.on('hideMatching', () => {
		matchingUI.visible = false
		cancelBtnBox.visible = false
		cancelBtnLabel.visible = false
		matchBtnBox.visible = true
		matchBtnLabel.visible = true
		cancelBtnBox.eventMode = 'none'
		cancelBtnBox.cursor = 'auto'
	})
	root.on('readyCount', (n: number) => {
		readyCountText.text = `Ready players: ${Math.max(0, Math.floor(n))}`
	})
	// Opponent badge is shown in battle scene; no badge on home
	// Bet amount overlay (HTML) - Round Collapsible UI
	{
		const existing = document.getElementById(
			'betOverlay'
		) as HTMLElement | null
		if (existing) {
			try {
				existing.remove()
			} catch (_) {}
		}
		const overlay = document.createElement('div')
		overlay.id = 'betOverlay'
		overlay.style.position = 'fixed'
		overlay.style.left = '24px'
		overlay.style.bottom = '24px'
		overlay.style.zIndex = '9999'
		overlay.style.display = 'flex'
		overlay.style.flexDirection = 'column'
		overlay.style.alignItems = 'flex-start'
		overlay.style.gap = '8px'

		// Toggle Button (Round Chip)
		const toggleBtn = document.createElement('div')
		toggleBtn.style.width = '56px'
		toggleBtn.style.height = '56px'
		toggleBtn.style.borderRadius = '50%'
		toggleBtn.style.background =
			'linear-gradient(135deg, #1a2228 0%, #0a0f12 100%)'
		toggleBtn.style.border = '2px solid #98ffb3'
		toggleBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'
		toggleBtn.style.cursor = 'pointer'
		toggleBtn.style.display = 'flex'
		toggleBtn.style.alignItems = 'center'
		toggleBtn.style.justifyContent = 'center'
		toggleBtn.style.color = '#98ffb3'
		toggleBtn.style.fontSize = '24px'
		toggleBtn.style.transition = 'transform 0.2s, box-shadow 0.2s'
		toggleBtn.innerHTML = '<span>$</span>' // Dollar sign icon
		toggleBtn.title = 'Change Bet'

		toggleBtn.addEventListener('mouseenter', () => {
			toggleBtn.style.transform = 'scale(1.05)'
			toggleBtn.style.boxShadow = '0 6px 16px rgba(152, 255, 179, 0.3)'
		})
		toggleBtn.addEventListener('mouseleave', () => {
			toggleBtn.style.transform = 'scale(1)'
			toggleBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)'
		})

		// Collapsible Panel
		const panel = document.createElement('div')
		panel.style.display = 'none' // Hidden by default
		panel.style.alignItems = 'center'
		panel.style.gap = '8px'
		panel.style.padding = '12px 16px'
		panel.style.background = 'rgba(10,15,18,0.95)'
		panel.style.border = '1px solid #375a44'
		panel.style.borderRadius = '24px' // Rounded pill shape
		panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
		panel.style.marginBottom = '8px' // Space above toggle button

		const label = document.createElement('span')
		label.textContent = 'Bet'
		label.style.color = '#e6f7ff'
		label.style.fontWeight = '600'

		const input = document.createElement('input')
		input.type = 'number'
		input.min = '1'
		input.step = '1'
		input.placeholder = 'Amount'
		input.style.width = '100px'
		input.style.padding = '8px 12px'
		input.style.color = '#e6f7ff'
		input.style.background = '#0a0f12'
		input.style.border = '1px solid #334155'
		input.style.borderRadius = '12px'
		input.style.outline = 'none'

		const setBtn = document.createElement('button')
		setBtn.textContent = 'Set'
		setBtn.style.padding = '8px 16px'
		setBtn.style.background = '#98ffb3'
		setBtn.style.color = '#000'
		setBtn.style.border = 'none'
		setBtn.style.borderRadius = '12px'
		setBtn.style.cursor = 'pointer'
		setBtn.style.fontWeight = 'bold'

		const saved = Math.max(
			1,
			Math.floor(Number(localStorage.getItem('betAmount') || 0))
		)
		if (saved > 0) input.value = String(saved)

		const applyBetStyle = () => {
			const v = Math.max(1, Math.floor(Number(input.value) || 0))
			const ok = v > 0
			const borderColor = ok ? '#3bd38c' : '#ff4d4f'
			input.style.border = `1px solid ${borderColor}`
		}

		const submit = () => {
			const v = Math.max(1, Math.floor(Number(input.value) || 0))
			localStorage.setItem('betAmount', String(v))
			root.emit('betUpdated', v)
			applyBetStyle()
			// Auto-collapse after setting
			panel.style.display = 'none'
			// Update toggle button text temporarily or show feedback?
			// For now just collapse
		}

		setBtn.addEventListener('click', submit)
		input.addEventListener('keydown', e => {
			if ((e as KeyboardEvent).key === 'Enter') submit()
		})
		input.addEventListener('input', applyBetStyle)

		panel.appendChild(label)
		panel.appendChild(input)
		panel.appendChild(setBtn)

		// Structure: Overlay -> [Panel, ToggleBtn]
		// Since flex-direction is column-reverse (we want panel above button),
		// or we can use column and put panel first?
		// User said "round collapsible ui". Usually expands outwards.
		// Let's keep it simple: Button at bottom, panel appears above it.
		overlay.style.flexDirection = 'column-reverse'

		overlay.appendChild(toggleBtn)
		overlay.appendChild(panel)
		document.body.appendChild(overlay)

		toggleBtn.addEventListener('click', () => {
			const isVisible = panel.style.display === 'flex'
			panel.style.display = isVisible ? 'none' : 'flex'
			if (!isVisible) {
				setTimeout(() => input.focus(), 50)
			}
		})

		applyBetStyle()
		root.on('destroyed', () => {
			try {
				setBtn.removeEventListener('click', submit)
				overlay.remove()
			} catch (_) {}
		})
	}
	// Prize multipliers panel purged
	// n/5 Configured text purged
	const countTextRef: Text | null = null
	const proposalUI = new Container()
	proposalUI.zIndex = 1000

	// Backdrop
	const proposalBackdrop = new Graphics()
	proposalBackdrop.rect(0, 0, DESIGN_W, DESIGN_H)
	proposalBackdrop.fill({ color: 0x000000, alpha: 0.7 })
	proposalBackdrop.eventMode = 'static'
	proposalUI.addChild(proposalBackdrop)

	const proposalPanel = new Graphics()
	const panelW = 400
	const panelH = 180
	proposalPanel.roundRect(0, 0, panelW, panelH, 16)
	proposalPanel.fill({ color: 0x0a0f12, alpha: 0.96 })
	proposalPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.8 })
	// Add glow
	// proposalPanel.filters = [new GlowFilter({ distance: 15, outerStrength: 2, color: 0x98ffb3 })]; // Requires pixi-filters

	proposalPanel.x = Math.round(DESIGN_W / 2 - panelW / 2)
	proposalPanel.y = Math.round(DESIGN_H / 2 - panelH / 2)
	const proposalText = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	proposalText.anchor = 0.5
	proposalText.x = Math.round(proposalPanel.x + panelW / 2)
	proposalText.y = Math.round(proposalPanel.y + 50)
	const acceptBtn = new Graphics()
	acceptBtn.roundRect(0, 0, 140, 44, 10)
	acceptBtn.fill({ color: 0x98ffb3, alpha: 1.0 })
	acceptBtn.x = Math.round(proposalPanel.x + 40)
	acceptBtn.y = Math.round(proposalPanel.y + panelH - 64)
	acceptBtn.eventMode = 'static'
	acceptBtn.cursor = 'pointer'
	const acceptLabel = new Text({
		text: 'ACCEPT',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x000000 },
	})
	acceptLabel.anchor = 0.5
	acceptLabel.x = Math.round(acceptBtn.x + 70)
	acceptLabel.y = Math.round(acceptBtn.y + 22)
	const declineBtn = new Graphics()
	declineBtn.roundRect(0, 0, 140, 44, 10)
	declineBtn.fill({ color: 0xff4d4f, alpha: 1.0 })
	declineBtn.x = Math.round(proposalPanel.x + panelW - 180)
	declineBtn.y = Math.round(proposalPanel.y + panelH - 64)
	declineBtn.eventMode = 'static'
	declineBtn.cursor = 'pointer'
	const declineLabel = new Text({
		text: 'DECLINE',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xffffff },
	})
	declineLabel.anchor = 0.5
	declineLabel.x = Math.round(declineBtn.x + 70)
	declineLabel.y = Math.round(declineBtn.y + 22)
	proposalUI.addChild(proposalPanel)
	proposalUI.addChild(proposalText)
	proposalUI.addChild(acceptBtn)
	proposalUI.addChild(acceptLabel)
	proposalUI.addChild(declineBtn)
	proposalUI.addChild(declineLabel)
	proposalUI.visible = false
	content.addChild(proposalUI)
	root.on('matchProposal', (opponentName: string) => {
		matchingUI.visible = false
		proposalText.text = `Start battle with ${opponentName}?`
		proposalUI.visible = true
	})
	acceptBtn.on('pointertap', () => {
		proposalUI.visible = false
		root.emit('proposalResponse', true)
	})
	declineBtn.on('pointertap', () => {
		proposalUI.visible = false
		root.emit('proposalResponse', false)
	})
	// verification removed; match is handled via websocket

	// Next Livebet & Countdown purged

	const colorsInit: readonly BallColor[] = [
		'green',
		'pink',
		'orange',
		'yellow',
		'blue',
	]
	let colors: BallColor[] = colorsInit.slice()
	{
		// load persisted slot color mapping if available and valid
		try {
			const raw = localStorage.getItem('slotColors') || ''
			const arr = JSON.parse(raw || '[]') || []
			const validSet = new Set([
				'green',
				'pink',
				'orange',
				'yellow',
				'blue',
			])
			if (Array.isArray(arr) && arr.length === 5) {
				const candidate = arr.map(c => String(c)) as BallColor[]
				const allValid = candidate.every(c => validSet.has(c))
				const uniqueCount = new Set(candidate).size
				if (allValid && uniqueCount === 5) {
					colors = candidate
					console.log('Home/slotColors loaded', { colors })
				} else {
					console.log('Home/slotColors ignored (invalid)', { arr })
				}
			}
		} catch (_) {}
	}
	const balls = await Promise.all(colors.map((c: BallColor) => createBall(c)))

	const targetWidths = [300, 460, 520, 460, 300]
	const baseWidths = balls.map(
		(b: Container) =>
			((b as any).userData?.baseWidth as number) || b.width || 1
	)
	const GRID_SIZE = 40
	const snap = (n: number) => Math.round(n / GRID_SIZE) * GRID_SIZE
	const rowY = snap(860)
	const depthOffsets = [-16, 26, 8, 26, -16]
	const ADJ_GAP = GRID_SIZE * 1
	let ballWidths = targetWidths.slice()
	{
		ballWidths[0] = Math.round(ballWidths[0] * 1.2)
		ballWidths[4] = Math.round(ballWidths[4] * 1.2)
		const totalBallWidth = ballWidths.reduce((a, b) => a + b, 0)
		const totalGaps = ADJ_GAP * 4
		const margin = GRID_SIZE * 2
		const maxRowWidth = DESIGN_W - margin * 2
		const s = Math.min(
			1,
			((maxRowWidth - totalGaps) / totalBallWidth) * 0.7
		)
		ballWidths = ballWidths.map(w => Math.round(w * s))
	}
	const scales = ballWidths.map((w, i) => w / baseWidths[i])
	balls.forEach((b: Container, i: number) => b.scale.set(scales[i]))
	const xMid = DESIGN_W / 2
	const leftEdges: number[] = []
	leftEdges[2] = snap(xMid - ballWidths[2] / 2)
	leftEdges[1] = leftEdges[2] - (ballWidths[1] + ADJ_GAP)
	leftEdges[0] = leftEdges[1] - (ballWidths[0] + ADJ_GAP)
	leftEdges[3] = leftEdges[2] + (ballWidths[2] + ADJ_GAP)
	leftEdges[4] = leftEdges[3] + (ballWidths[3] + ADJ_GAP)
	const xPositions: number[] = []
	for (let i = 0; i < 5; i++) xPositions[i] = leftEdges[i] + ballWidths[i] / 2

	balls.forEach((ball: Container, i: number) => {
		const metrics = (ball as any).userData || {
			trailBottomOffset: ball.height / 2,
		}
		const dropBy = GRID_SIZE * 3
		const perRow =
			rowY + depthOffsets[i] + (i === 1 || i === 3 ? dropBy : 0)
		ball.x = Math.round(xPositions[i])
		ball.y = Math.round(
			perRow - scales[i] * (metrics.trailBottomOffset || 0)
		)
		content.addChild(ball)
		const trailSprite = (ball as any).userData?.trail as Sprite | undefined
		if (trailSprite && !LOCK_POSITIONS) {
			gsap.to(trailSprite, {
				alpha: 0.8,
				yoyo: true,
				repeat: -1,
				duration: 1.6 + i * 0.1,
				ease: 'sine.inOut',
			})
		}
	})

	{
		const shift = GRID_SIZE * 1
		balls[0].y += shift
		balls[2].y += shift
		balls[4].y += shift
	}
	{
		const extra = GRID_SIZE * 3
		balls[2].y += extra
	}
	{
		const shiftAll = GRID_SIZE * 3
		for (let i = 0; i < balls.length; i++) balls[i].y += shiftAll
	}

	{
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const user = (container as any).userData || {}
			user.origX = Math.round(container.x)
			user.origY = Math.round(container.y)
			;(container as any).userData = user
		}
	}

	{
		for (let i = 0; i < balls.length; i++) {
			balls[i].filters = []
			const container = balls[i]
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			if (ballSprite) {
				ballSprite.eventMode = 'static'
				ballSprite.cursor = 'pointer'
				const baseScale = ballSprite.scale.x || 1
				ballSprite.on('pointerover', () => {
					playHoverSound(colors[i])
					gsap.to(ballSprite.scale, {
						x: baseScale * 1.08,
						y: baseScale * 1.08,
						duration: 0.3,
						ease: 'back.out(1.7)',
					})
				})
				ballSprite.on('pointerout', () => {
					gsap.to(ballSprite.scale, {
						x: baseScale,
						y: baseScale,
						duration: 0.3,
						ease: 'power2.out',
					})
				})
				ballSprite.on('pointertap', () => {
					root.emit('configureBall', colors[i], i, colors.slice())
				})
			}
		}
	}
	// expose minimal test hooks
	;(root as any).__getState = () => {
		let configured: Record<string, number> = {}
		try {
			configured =
				JSON.parse(localStorage.getItem('configuredMap') || '{}') || {}
		} catch (_) {}
		const slots = balls.map((container: Container, i: number) => {
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			const bubble = (container as any).userData?.bubble as
				| Graphics
				| undefined
			const color = String(colors[i])
			const hasBall = !!ballSprite
			const isConfigured =
				hasBall && ((configured[color] as any) || 0) > 0
			const baseW =
				((container as any).userData?.baseWidth as number) ||
				(ballSprite?.texture?.width as number) ||
				(ballSprite?.width as number) ||
				0
			const renderW = hasBall
				? Math.round(baseW * (container.scale?.x || 1))
				: 0
			const posX = Math.round(container.x)
			const posY = Math.round(container.y)
			let gapPX = 0
			try {
				const trailSprite = (container as any).userData?.trail as
					| Sprite
					| undefined
				if (ballSprite && trailSprite) {
					const s = scales[i]
					const ballH = ballSprite.texture.height || ballSprite.height
					const y1 = container.y + s * (ballH / 2)
					const y2 = container.y + s * trailSprite.y
					gapPX = Math.round(y2 - y1)
				}
			} catch (_) {}
			return {
				color,
				hasBall: !!ballSprite,
				hasBubble: !!bubble,
				isConfigured,
				renderW,
				posX,
				posY,
				gapPX,
			}
		})
		return {
			configuredCount: Object.values(configured).filter(
				v => (Number(v) || 0) > 0
			).length,
			slots,
		}
	}
	{
		let configured: Record<string, number> = {}
		try {
			configured =
				JSON.parse(localStorage.getItem('configuredMap') || '{}') || {}
		} catch (_) {}
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const val = Number(configured[String(colors[i])]) || 0
			if (val > 0) continue
			const existingBall = (container as any).userData?.ball as
				| Sprite
				| undefined
			if (existingBall) {
				try {
					container.removeChild(existingBall)
				} catch (_) {}
			}
			const s0 = scales[i]
			let bubble = (container as any).userData?.bubble as
				| Graphics
				| undefined
			if (!bubble) {
				const b = new Graphics()
				const radius = Math.round((ballWidths[i] / 2) * 0.55)
				b.circle(0, 0, radius)
				b.fill({ color: 0x0a0f12, alpha: 0.35 })
				b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
				b.eventMode = 'static'
				b.cursor = 'pointer'
				b.scale.set(s0)

				const plus = new Text({
					text: '+',
					style: {
						fontFamily: 'system-ui',
						fontSize: Math.round(radius * 1.2),
						fill: 0x334155,
						fontWeight: 'bold',
						align: 'center',
					},
				})
				plus.anchor.set(0.5)
				// Center visually
				plus.y = -2
				b.addChild(plus)

				b.on('pointerover', () => {
					b.stroke({ color: 0x98ffb3, width: 2, alpha: 1 })
					plus.style.fill = 0x98ffb3
					gsap.to(b.scale, {
						x: s0 * 1.1,
						y: s0 * 1.1,
						duration: 0.3,
						ease: 'back.out(1.7)',
					})
				})
				b.on('pointerout', () => {
					b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
					plus.style.fill = 0x334155
					gsap.to(b.scale, {
						x: s0,
						y: s0,
						duration: 0.3,
						ease: 'power2.out',
					})
				})

				container.addChild(b)
				bubble = b
				b.on('pointertap', () => {
					root.emit('configureBall', colors[i], i, colors.slice())
				})
			}
			;(container as any).userData = {
				...(container as any).userData,
				ball: undefined,
				bubble,
			}
		}
	}

	{
		const configNodes: Record<
			number,
			{ ring: Graphics; label: Text; del?: Text }
		> = Object.create(null)
		let countTextRef: Text | null = null
		const applyConfigured = () => {
			let configured: Record<string, number> = {}
			try {
				configured =
					JSON.parse(localStorage.getItem('configuredMap') || '{}') ||
					{}
			} catch (_) {}
			const count = Object.values(configured).filter(
				v => (Number(v) || 0) > 0
			).length
			root.emit('readyStatus', count >= 5)
			try {
				console.log('Home/refreshConfigured', { count, configured })
			} catch (_) {}
			// n/5 Configured update purged
			// for (const key of Object.keys(configNodes)) ... removed
		}
		// n/5 Configured creation purged
		// for (let i = 0; i < balls.length; i++) ... removed

		applyConfigured()
		root.on('refreshConfigured', () => applyConfigured())
	}

	// allow main app to update a ball sprite color by index
	root.on('updateBallSprite', async (idx: number, newColor: string) => {
		try {
			const i = Math.max(0, Math.min(balls.length - 1, Math.floor(idx)))
			const container = balls[i]
			const s = scales[i]

			// Remove existing
			const existingBall = (container as any).userData?.ball as
				| Sprite
				| undefined
			const existingTrail = (container as any).userData?.trail as
				| Sprite
				| undefined
			const existingBubble = (container as any).userData?.bubble as
				| Graphics
				| undefined
			if (existingBall) {
				try {
					container.removeChild(existingBall)
				} catch (_) {}
			}
			if (existingTrail) {
				try {
					container.removeChild(existingTrail)
				} catch (_) {}
			}
			if (existingBubble) {
				try {
					container.removeChild(existingBubble)
					;(existingBubble as any)?.destroy?.()
				} catch (_) {}
			}

			// Check configuration
			let map: Record<string, number> = {}
			try {
				map =
					JSON.parse(localStorage.getItem('configuredMap') || '{}') ||
					{}
			} catch (_) {}
			const val = Number(map[newColor]) || 0
			const isConfigured = val > 0

			if (!isConfigured) {
				// Create Bubble
				const b = new Graphics()
				const radius = Math.round((ballWidths[i] / 2) * 0.55)
				b.circle(0, 0, radius)
				b.fill({ color: 0x0a0f12, alpha: 0.35 })
				b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
				b.eventMode = 'static'
				b.cursor = 'pointer'
				b.scale.set(s)

				const plus = new Text({
					text: '+',
					style: {
						fontFamily: 'system-ui',
						fontSize: Math.round(radius * 1.2),
						fill: 0x334155,
						fontWeight: 'bold',
						align: 'center',
					},
				})
				plus.anchor.set(0.5)
				plus.y = -2
				b.addChild(plus)

				b.on('pointerover', () => {
					b.stroke({ color: 0x98ffb3, width: 2, alpha: 1 })
					plus.style.fill = 0x98ffb3
					gsap.to(b.scale, {
						x: s * 1.1,
						y: s * 1.1,
						duration: 0.3,
						ease: 'back.out(1.7)',
					})
				})
				b.on('pointerout', () => {
					b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
					plus.style.fill = 0x334155
					gsap.to(b.scale, {
						x: s,
						y: s,
						duration: 0.3,
						ease: 'power2.out',
					})
				})
				b.on('pointertap', () => {
					root.emit('configureBall', newColor, i, colors.slice())
				})
				container.addChild(b)
				;(container as any).userData = {
					...(container as any).userData,
					ball: undefined,
					bubble: b,
				}
				return
			}

			// Create Ball
			const fresh = await createBall(newColor as any)
			const freshBall = (fresh as any).userData?.ball as
				| Sprite
				| undefined
			const freshTrail = (fresh as any).userData?.trail as
				| Sprite
				| undefined
			let ballSpriteNew: Sprite | undefined = freshBall
			let trailSpriteNew: Sprite | undefined = freshTrail
			if (!ballSpriteNew) {
				const fallback = await createBall(newColor as any, {
					noFX: true,
				})
				ballSpriteNew = (fallback as any).userData?.ball as
					| Sprite
					| undefined
			}
			if (trailSpriteNew) {
				trailSpriteNew.eventMode = 'none'
				container.addChild(trailSpriteNew)
				if (!LOCK_POSITIONS) {
					gsap.to(trailSpriteNew, {
						alpha: 0.8,
						yoyo: true,
						repeat: -1,
						duration: 1.6 + i * 0.1,
						ease: 'sine.inOut',
					})
				}
			}
			if (ballSpriteNew) {
				ballSpriteNew.eventMode = 'static'
				ballSpriteNew.cursor = 'pointer'
				const baseScale = ballSpriteNew.scale.x || 1
				ballSpriteNew.on('pointerover', () => {
					playHoverSound(newColor as any)
					gsap.to(ballSpriteNew.scale, {
						x: baseScale * 1.08,
						y: baseScale * 1.08,
						duration: 0.3,
						ease: 'back.out(1.7)',
					})
				})
				ballSpriteNew.on('pointerout', () => {
					gsap.to(ballSpriteNew.scale, {
						x: baseScale,
						y: baseScale,
						duration: 0.3,
						ease: 'power2.out',
					})
				})
				ballSpriteNew.on('pointertap', () => {
					root.emit('configureBall', newColor, i, colors.slice())
				})
				container.addChild(ballSpriteNew)

				// Restore Configured Indicator (Ring)
				const ring = new Graphics()
				const r =
					Math.max(ballSpriteNew.width, ballSpriteNew.height) * 0.65
				ring.arc(0, 0, r, 0, Math.PI * 2)
				ring.stroke({ color: 0x98ffb3, width: 3, alpha: 0.8 })
				// Dashed effect simulated by mask or multiple arcs?
				// Simple glow ring is fine for now, user asked for "circle indicator"
				ring.eventMode = 'none'
				container.addChild(ring)

				// Animate ring
				gsap.to(ring.scale, {
					x: 1.1,
					y: 1.1,
					duration: 1.5,
					yoyo: true,
					repeat: -1,
					ease: 'sine.inOut',
				})
				gsap.to(ring, {
					alpha: 0.4,
					duration: 1.5,
					yoyo: true,
					repeat: -1,
					ease: 'sine.inOut',
				})

				// Restore Remove Button
				const removeBtn = new Graphics()
				const btnSize = 24
				removeBtn.circle(0, 0, btnSize / 2)
				removeBtn.fill({ color: 0xff4d4f, alpha: 0.9 })
				removeBtn.stroke({ color: 0xffffff, width: 2 })

				const xMark = new Text({
					text: '✕',
					style: {
						fontFamily: 'Arial',
						fontSize: 14,
						fill: 0xffffff,
						fontWeight: 'bold',
					},
				})
				xMark.anchor.set(0.5)
				removeBtn.addChild(xMark)

				// Position top-right
				removeBtn.x = r * 0.7
				removeBtn.y = -r * 0.7
				removeBtn.eventMode = 'static'
				removeBtn.cursor = 'pointer'

				removeBtn.on('pointerover', () => {
					removeBtn.scale.set(1.2)
				})
				removeBtn.on('pointerout', () => {
					removeBtn.scale.set(1.0)
				})
				removeBtn.on('pointertap', e => {
					e.stopPropagation() // Prevent ball tap
					try {
						let cfg: Record<string, number> = {}
						try {
							cfg =
								JSON.parse(
									localStorage.getItem('configuredMap') ||
										'{}'
								) || {}
						} catch (_) {}
						if (cfg[newColor]) {
							delete cfg[newColor]
							localStorage.setItem(
								'configuredMap',
								JSON.stringify(cfg)
							)
							root.emit('refreshConfigured')
							// Trigger self-update to revert to bubble
							root.emit('updateBallSprite', i, newColor)
						}
					} catch (err) {
						console.error('Home/removeConfig error', err)
					}
				})

				container.addChild(removeBtn)
			}
			;(container as any).userData = {
				...(container as any).userData,
				ball: ballSpriteNew,
				trail: trailSpriteNew,
				bubble: undefined,
			}
		} catch (err) {
			console.error('Home/updateBallSprite error', err)
		}
	})

	// background alignment unchanged

	const getGap = (i: number) => {
		const container = balls[i]
		const s = scales[i]
		const ballSprite = (container as any).userData?.ball as
			| Sprite
			| undefined
		const trailSprite = (container as any).userData?.trail as
			| Sprite
			| undefined
		if (!ballSprite || !trailSprite) return 0
		const ballH = ballSprite.texture.height || ballSprite.height
		return s * (trailSprite.y - ballH / 2)
	}
	const setGapTarget = (i: number, target: number) => {
		const container = balls[i]
		const s = scales[i]
		const ballSprite = (container as any).userData?.ball as
			| Sprite
			| undefined
		const trailSprite = (container as any).userData?.trail as
			| Sprite
			| undefined
		if (!ballSprite || !trailSprite) return
		const tH = trailSprite.texture.height || trailSprite.height
		const ballH = ballSprite.texture.height || ballSprite.height
		const current = s * (trailSprite.y - ballH / 2)
		const delta = (target - current) / s
		trailSprite.y += delta
		const user = (container as any).userData || {}
		user.trailBottomOffset = trailSprite.y + tH / 2
		;(container as any).userData = user
	}
	if (!LOCK_POSITIONS) {
		{
			const a = getGap(1)
			const b = getGap(3)
			const t = Math.round((a + b) / 2)
			setGapTarget(1, t)
			setGapTarget(3, t)
		}
		{
			const a = getGap(0)
			const b = getGap(4)
			const t = Math.round((a + b) / 2)
			setGapTarget(0, t)
			setGapTarget(4, t)
		}
	}

	// Force all yellow marker (trail center-to-ball bottom) values to 20px
	if (!LOCK_POSITIONS) {
		for (let i = 0; i < balls.length; i++) {
			setGapTarget(i, YELLOW_GAP_LOCKED)
		}
	}

	{
		if (LOCKED_YELLOW_GAPS) {
			for (let i = 0; i < balls.length; i++) {
				setGapTarget(i, LOCKED_YELLOW_GAPS[i])
			}
		} else {
			for (let i = 0; i < balls.length; i++) {
				const current = getGap(i)
				const target = Math.round(current * 0.1)
				setGapTarget(i, target)
			}
			LOCKED_YELLOW_GAPS = balls.map((_: Container, i: number) =>
				getGap(i)
			)
		}
	}

	// Collapsible Debug UI
	{
		const debugContainer = new Container()
		debugContainer.visible = false
		content.addChild(debugContainer)

		const debug = new Graphics()
		const lefts = xPositions.map((x, i) => x - ballWidths[i] / 2)
		const rights = xPositions.map((x, i) => x + ballWidths[i] / 2)
		const labels: Text[] = []
		for (let i = 0; i < 4; i++) {
			const yTop = rowY - 140
			const yBottom = rowY + 140
			debug.moveTo(rights[i], yTop)
			debug.lineTo(rights[i], yBottom)
			debug.moveTo(lefts[i + 1], yTop)
			debug.lineTo(lefts[i + 1], yBottom)
			debug.moveTo(rights[i], yTop - 20)
			debug.lineTo(lefts[i + 1], yTop - 20)
			const label = new Text({
				text: `${RED_GAP_LOCKED[i]}px`,
				style: {
					fontFamily: 'system-ui',
					fontSize: 18,
					fill: 0xff0077,
				},
			})
			label.anchor = 0.5
			label.x = Math.round((rights[i] + lefts[i + 1]) / 2)
			label.y = yTop - 36
			label.roundPixels = true
			label.resolution = window.devicePixelRatio || 1
			labels.push(label)
		}
		debug.stroke({ color: 0xff0077, alpha: 0.9, width: 3 })
		debugContainer.addChild(debug)
		labels.forEach(l => debugContainer.addChild(l))

		const trailDebug = new Graphics()
		const trailLabels: Text[] = []
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const s = scales[i]
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			const trailSprite = (container as any).userData?.trail as
				| Sprite
				| undefined
			if (!ballSprite || !trailSprite) continue
			const ballH = ballSprite.texture.height || ballSprite.height
			const ballBottomY = container.y + s * (ballH / 2)
			const trailCenterY = container.y + s * trailSprite.y
			const y1 = Math.round(ballBottomY)
			const y2 = Math.round(trailCenterY)
			const xLine = Math.round(container.x)
			trailDebug.moveTo(xLine, y1)
			trailDebug.lineTo(xLine, y2)
			const label = new Text({
				text: `${Math.round(y2 - y1)}px`,
				style: {
					fontFamily: 'system-ui',
					fontSize: 18,
					fill: 0xffff00,
				},
			})
			label.anchor = 0.5
			label.x = xLine
			label.y = Math.round(y1 - 18)
			label.roundPixels = true
			label.resolution = window.devicePixelRatio || 1
			trailLabels.push(label)
		}
		trailDebug.stroke({ color: 0xffff00, alpha: 0.9, width: 3 })
		debugContainer.addChild(trailDebug)
		trailLabels.forEach(l => debugContainer.addChild(l))

		// Toggle Button
		const dbgToggle = new Graphics()
		dbgToggle.roundRect(0, 0, 80, 30, 8)
		dbgToggle.fill({ color: 0x333333, alpha: 0.8 })
		dbgToggle.stroke({ color: 0xffffff, width: 1, alpha: 0.5 })
		dbgToggle.x = DESIGN_W - 100
		dbgToggle.y = DESIGN_H - 50
		dbgToggle.eventMode = 'static'
		dbgToggle.cursor = 'pointer'
		const dbgText = new Text({
			text: 'Debug',
			style: { fontFamily: 'system-ui', fontSize: 14, fill: 0xffffff },
		})
		dbgText.anchor = 0.5
		dbgText.x = dbgToggle.x + 40
		dbgText.y = dbgToggle.y + 15
		dbgText.resolution = window.devicePixelRatio || 1
		content.addChild(dbgToggle)
		content.addChild(dbgText)

		dbgToggle.on('pointertap', () => {
			const v = !debugContainer.visible
			debugContainer.visible = v
			dbgText.text = v ? 'Hide' : 'Debug'
		})
	}

	{
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			const trailSprite = (container as any).userData?.trail as
				| Sprite
				| undefined
			container.eventMode = 'static'
			container.cursor = 'pointer'
			const hoverColor = colors[i]
			container.on('pointerover', () => playHoverSound(hoverColor))
			if (trailSprite) trailSprite.eventMode = 'none'
			if (ballSprite) {
				ballSprite.eventMode = 'static'
				ballSprite.cursor = 'pointer'
			}
			container.on('pointertap', (ev: any) => {
				playClickSound(hoverColor)
				const hasBall = !!((container as any).userData?.ball as
					| Sprite
					| undefined)
				if (!hasBall) {
					try {
						console.log('Home/container tapped (empty)', {
							index: i,
							color: hoverColor,
						})
						ev?.stopPropagation?.()
					} catch (_) {}
					root.emit('configureBall', hoverColor, i, colors.slice())
				}
			})
			if (ballSprite) {
				ballSprite.on('pointertap', (ev: any) => {
					gsap.to(ballSprite.scale, {
						x: 1.12,
						y: 1.12,
						duration: 0.12,
						ease: 'power2.out',
						yoyo: true,
						repeat: 1,
						overwrite: 'auto',
						onComplete: () => {
							gsap.to(ballSprite.scale, {
								x: 1.03,
								y: 1.03,
								yoyo: true,
								repeat: -1,
								duration: 2.2 + i * 0.1,
								ease: 'sine.inOut',
							})
						},
					})
					try {
						console.log('Home/ball tapped', {
							index: i,
							color: hoverColor,
						})
						ev?.stopPropagation?.()
					} catch (_) {}
					root.emit('configureBall', hoverColor, i, colors.slice())
				})
			}
			// no bgm trigger on click
			if (ballSprite) {
				gsap.to(ballSprite.scale, {
					x: 1.03,
					y: 1.03,
					yoyo: true,
					repeat: -1,
					duration: 2.2 + i * 0.1,
					ease: 'sine.inOut',
				})
				gsap.to(ballSprite, {
					rotation: 0.03,
					yoyo: true,
					repeat: -1,
					duration: 3.2 + i * 0.1,
					ease: 'sine.inOut',
				})
				const shadowTex = makeRadialTexture(
					512,
					'rgba(0,0,0,0.35)',
					'rgba(0,0,0,0)'
				)
				const shadow = new Sprite({ texture: shadowTex })
				shadow.anchor = 0.5
				const shDiameter =
					Math.max(ballSprite.width, ballSprite.height) * 1.2
				const shScale = shDiameter / 512
				shadow.scale.set(shScale)
				shadow.alpha = 0.14
				shadow.x = 0
				shadow.y = Math.max(ballSprite.height, ballSprite.width) * 0.12
				shadow.eventMode = 'none'
				container.addChildAt(shadow, trailSprite ? 1 : 0)
				gsap.to(shadow, {
					alpha: 0.22,
					yoyo: true,
					repeat: -1,
					duration: 2.6 + i * 0.1,
					ease: 'sine.inOut',
					delay: i * 0.25,
				})
				const amp = 18 + (i % 2) * 8
				const targetY =
					i % 2 === 0 ? ballSprite.y - amp : ballSprite.y + amp
				gsap.to(ballSprite, {
					y: targetY,
					yoyo: true,
					repeat: -1,
					duration: 2.4 + i * 0.2,
					ease: 'sine.inOut',
					delay: i * 0.25,
				})
			}
			if (trailSprite) {
				gsap.to(trailSprite, {
					alpha: 0.82,
					yoyo: true,
					repeat: -1,
					duration: 1.6 + i * 0.08,
					ease: 'sine.inOut',
					delay: i * 0.1,
				})
				gsap.to(trailSprite.scale, {
					x: 1.06,
					y: 1.02,
					yoyo: true,
					repeat: -1,
					duration: 2.2 + i * 0.12,
					ease: 'sine.inOut',
					delay: i * 0.12,
				})
			}
		}
	}

	const tick = () => {}
	const interval = setInterval(tick, 1000)

	root.on('destroyed', () => clearInterval(interval))
	root.on('destroyed', () => {
		stopBGM()
	})

	const scale = Math.min(w / DESIGN_W, h / DESIGN_H)
	content.pivot.set(DESIGN_W / 2, DESIGN_H / 2)
	content.scale.set(scale)
	content.x = Math.round(w / 2)
	content.y = Math.round(h / 2)

	// apply global scanline filter to the whole scene
	// no filters applied

	try {
		autoStartBGM()
	} catch (_) {}

	return root
}
