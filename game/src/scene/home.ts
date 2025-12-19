import { Container, Graphics, Text, Assets, Sprite, Texture } from 'pixi.js'
import {
	createBall,
	BallColor,
	addDisplayToBall,
	createMasterBall,
} from '@/modules/ball'
import { isMobileDevice, isSlowNetwork } from '@/util/env'
import {
	stopBGM,
	autoStartBGM,
	setMuted,
	ensureAudioUnlocked,
	startBGMOnce,
	stopBGMElement,
} from '@/audio/bgm'
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
const SHOW_DEBUG = true
const SHOW_STREAK_MARKERS = true
const RED_GAP_LOCKED = [40, 40, 40, 40] as const
const YELLOW_GAP_LOCKED = -54
const LOCK_POSITIONS = false
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
	const BGM_W = 110
	const BGM_H = 32
	bgmBtnBox.roundRect(0, 0, BGM_W, BGM_H, 16)
	const bgmMutedInit =
		(localStorage.getItem('bgmMuted') || '') === '1' ? true : false

	// Status Indicator Logic:
	// Green = ON (Playing)
	// Red = OFF (Muted)
	bgmBtnBox.eventMode = 'static'
	bgmBtnBox.cursor = 'pointer'
	content.addChild(bgmBtnBox)

	// Position BGM button at top-left
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
		text: bgmMutedInit ? 'BGM: OFF' : 'BGM: ON',
		style: {
			fontFamily: 'system-ui',
			fontSize: 13,
			fill: 0xffffff,
			fontWeight: 'bold',
		},
	})
	bgmBtnLabel.anchor = 0.5
	bgmBtnLabel.x = Math.round(bgmBtnBox.x + BGM_W / 2)
	bgmBtnLabel.y = Math.round(bgmBtnBox.y + BGM_H / 2)
	bgmBtnLabel.roundPixels = true
	bgmBtnLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	content.addChild(bgmBtnLabel)

	let bgmStateMuted = bgmMutedInit

	const drawBgmBtn = (muted: boolean) => {
		bgmBtnBox.clear()
		bgmBtnBox.roundRect(0, 0, BGM_W, BGM_H, 16)
		// If Muted -> Red (OFF)
		// If Not Muted -> Green (ON)
		bgmBtnBox.fill({
			color: muted ? 0xff4d4f : 0x98ffb3,
			alpha: 0.9,
		})
		bgmBtnBox.stroke({ color: 0xffffff, width: 1.5, alpha: 0.4 })
		bgmBtnLabel.text = muted ? 'BGM: OFF' : 'BGM: ON'
		bgmBtnLabel.style.fill = muted ? 0xffffff : 0x0a0f12
	}
	drawBgmBtn(bgmStateMuted)

	bgmBtnBox.on('pointertap', async () => {
		try {
			// Toggle local state
			bgmStateMuted = !bgmStateMuted

			if (!bgmStateMuted) {
				// Turn ON
				setMuted(false)
				drawBgmBtn(false)
				await ensureAudioUnlocked()
				await startBGMOnce()
				stopBGMElement()
			} else {
				// Turn OFF
				setMuted(true)
				drawBgmBtn(true)
				stopBGM()
				stopBGMElement()
			}
		} catch (err) {
			console.error('BGM toggle error', err)
		}
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
	matchBtnBox.zIndex = 100
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
	matchBtnLabel.zIndex = 101
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
	cancelBtnBox.zIndex = 100
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
	cancelBtnLabel.zIndex = 101
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
	matchingUI.zIndex = 2000
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
	// Move to center of screen to avoid overlap with balls (at bottom) and header (at top)
	// Shifted up by 260px to avoid ball overlap
	loader2.y = Math.round(DESIGN_H / 2 - 260)
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
	// Bet amount overlay (HTML) - Ultra Compact
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
		Object.assign(overlay.style, {
			position: 'fixed',
			left: '20px',
			bottom: '20px',
			zIndex: '9999',
			display: 'flex',
			alignItems: 'center',
			background: 'rgba(10, 15, 18, 0.85)',
			backdropFilter: 'blur(4px)',
			padding: '3px',
			borderRadius: '16px',
			border: '1px solid rgba(152, 255, 179, 0.25)',
			boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
			gap: '6px',
			transition: 'transform 0.2s, box-shadow 0.2s',
		})

		// Icon Circle
		const icon = document.createElement('div')
		Object.assign(icon.style, {
			width: '26px',
			height: '26px',
			borderRadius: '50%',
			background: 'linear-gradient(135deg, #1a2228 0%, #0a0f12 100%)',
			border: '1px solid #98ffb3',
			color: '#98ffb3',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			fontWeight: 'bold',
			fontSize: '13px',
			boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
			flexShrink: '0',
		})
		icon.innerHTML = '<span>$</span>'
		overlay.appendChild(icon)

		// Input Field
		const input = document.createElement('input')
		input.type = 'number'
		input.min = '1'
		input.step = '1'
		input.placeholder = 'Bet'
		Object.assign(input.style, {
			width: '50px',
			background: 'transparent',
			border: 'none',
			color: '#e6f7ff',
			fontSize: '13px',
			fontWeight: 'bold',
			outline: 'none',
			textAlign: 'left',
			fontFamily: 'system-ui',
			padding: '0 6px 0 0',
		})

		const saved = Math.max(
			1,
			Math.floor(Number(localStorage.getItem('betAmount') || 0))
		)
		if (saved > 0) input.value = String(saved)

		const updateBet = () => {
			let v = Math.floor(Number(input.value))
			if (isNaN(v) || v < 1) v = 1
			input.value = String(v)
			localStorage.setItem('betAmount', String(v))
			root.emit('betUpdated', v)
		}

		input.onchange = updateBet
		input.onblur = updateBet
		input.onkeydown = e => {
			if (e.key === 'Enter') {
				input.blur()
			}
		}

		overlay.appendChild(input)
		document.body.appendChild(overlay)

		root.on('destroyed', () => {
			try {
				overlay.remove()
			} catch (_) {}
		})
	}

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
	const ballResults = await Promise.all(
		colors.map((c: BallColor) =>
			createMasterBall(c, '00', { gap: YELLOW_GAP_LOCKED })
		)
	)
	const balls = ballResults.map(r => r.container)

	const rawTargetWidths = [420, 420, 420, 420, 420]
	// Calculate fit scale to ensure all 5 balls fit within design width
	const totalRawW = rawTargetWidths.reduce((a, b) => a + b, 0)
	const GRID_SIZE = 40
	const ADJ_GAP = 10 // Trimmed gap
	const totalGap = ADJ_GAP * 4
	const maxW = DESIGN_W * 0.95 // Use 95% of width
	const fitScale = Math.min(1, (maxW - totalGap) / totalRawW)
	const SIZE_FACTOR = 0.42 // Increased by 40% (0.3 * 1.4)

	const targetWidths = rawTargetWidths.map(w =>
		Math.round(w * fitScale * SIZE_FACTOR)
	)

	const baseWidths = balls.map(
		(b: Container) =>
			((b as any).userData?.baseWidth as number) || b.width || 1
	)

	// Y Position Logic - Simple Arch
	// Center (index 2) is lowest (closest)
	// Outer (0,4) are highest (farthest)
	const BASE_Y = Math.round(DESIGN_H * 0.6) // Lower on screen (~650px)
	const ARCH_OFFSET = 100 * SIZE_FACTOR // Scale arch height too

	const getY = (i: number) => {
		// Distance from center index (2)
		const dist = Math.abs(i - 2)
		// dist 0 -> offset 0
		// dist 1 -> offset 0.5 * ARCH_OFFSET
		// dist 2 -> offset 1.0 * ARCH_OFFSET
		// We subtract because lower Y is higher on screen? No, +Y is down.
		// We want center to be lower (higher Y value).
		// So outer balls should have smaller Y value.
		return BASE_Y - (dist / 2) * ARCH_OFFSET
	}

	const scales = targetWidths.map((w, i) => w / baseWidths[i])
	balls.forEach((b: Container, i: number) => b.scale.set(scales[i]))

	// X Position Logic - Center Outwards
	const xPositions: number[] = []
	const centerI = 2
	xPositions[centerI] = DESIGN_W / 2

	// Working outwards from center
	// Left side
	xPositions[1] =
		xPositions[2] - (targetWidths[2] / 2 + ADJ_GAP + targetWidths[1] / 2)
	xPositions[0] =
		xPositions[1] - (targetWidths[1] / 2 + ADJ_GAP + targetWidths[0] / 2)
	// Right side
	xPositions[3] =
		xPositions[2] + (targetWidths[2] / 2 + ADJ_GAP + targetWidths[3] / 2)
	xPositions[4] =
		xPositions[3] + (targetWidths[3] / 2 + ADJ_GAP + targetWidths[4] / 2)

	balls.forEach((ball: Container, i: number) => {
		ball.x = Math.round(xPositions[i])
		ball.y = Math.round(getY(i))

		content.addChild(ball)

		// Fix Trail Sizes - Make them visually uniform
		const trailSprite = (ball as any).userData?.trail as Sprite | undefined
		if (trailSprite) {
			const baseW = (ball as any).userData?.baseWidth || 1
			const trailTexW = trailSprite.texture.width || 1

			// Force trail width to match ball width exactly for uniformity
			// This ensures all trails have the same visual width on screen
			const TRAIL_WIDTH_RATIO = 1.0
			const k = (baseW / trailTexW) * TRAIL_WIDTH_RATIO

			trailSprite.scale.set(k)
			trailSprite.x = 0

			// Position Logic matching updateBallSprite
			const ballSprite = (ball as any).userData?.ball as
				| Sprite
				| undefined
			if (ballSprite) {
				const ballTexH = ballSprite.texture.height || ballSprite.height
				const texH = trailSprite.texture.height || trailSprite.height
				const s = scales[i]

				const color = colors[i]
				let correction = 0
				if (color === 'blue') correction = -25
				if (color === 'yellow') correction = -2

				const visualGap = YELLOW_GAP_LOCKED * SIZE_FACTOR

				// Calculate local Y position
				// ballBottom (local) = ballTexH / 2
				// trailTop (local) = trail.y - (texH * k) / 2
				// We want: trailTop = ballBottom + (visualGap / s) + (correction / s)
				// So: trail.y = ballTexH / 2 + visualGap / s + correction / s + (texH * k) / 2

				trailSprite.y =
					ballTexH / 2 + (visualGap + correction) / s + (texH * k) / 2
			}

			if (!LOCK_POSITIONS) {
				// Trail animation removed
			}
		}
	})

	{
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const user = (container as any).userData || {}
			user.origX = Math.round(container.x)
			user.origY = Math.round(container.y)
			;(container as any).userData = user
		}
	}

	if (SHOW_DEBUG) {
		const debugG = new Graphics()
		content.addChild(debugG)

		// Red Markers (Horizontal Gap)
		for (let i = 0; i < balls.length - 1; i++) {
			const b1 = balls[i]
			const b2 = balls[i + 1]

			const w1 = targetWidths[i]
			const w2 = targetWidths[i + 1]

			const x1 = b1.x + w1 / 2
			const x2 = b2.x - w2 / 2

			// Draw Red Rect for gap
			const cy = (b1.y + b2.y) / 2
			debugG.rect(x1, cy - 10, x2 - x1, 20)
			debugG.fill({ color: 0xff0000, alpha: 0.6 })

			// Label
			const txt = new Text({
				text: Math.round(x2 - x1) + 'px',
				style: { fontSize: 12, fill: 0xffffff },
			})
			txt.anchor.set(0.5)
			txt.x = (x1 + x2) / 2
			txt.y = cy - 20
			debugG.addChild(txt)
		}

		// Yellow Markers (Vertical Gap)
		balls.forEach((b, i) => {
			const trail = (b as any).userData?.trail as Sprite
			const ball = (b as any).userData?.ball as Sprite
			if (trail && ball) {
				const s = scales[i]
				const ballH = ball.texture.height || ball.height
				const ballBottomY = b.y + (ballH / 2) * s

				// Visual Gap
				const visualGap = YELLOW_GAP_LOCKED * SIZE_FACTOR

				// Draw Yellow Rect for gap (negative goes up)
				debugG.rect(b.x - 6, ballBottomY, 12, visualGap)
				debugG.fill({ color: 0xffff00, alpha: 0.6 })

				// Label
				const txt = new Text({
					text: visualGap.toFixed(1),
					style: { fontSize: 10, fill: 0xffff00 },
				})
				txt.anchor.set(0.5)
				txt.x = b.x
				txt.y = ballBottomY + visualGap - 10
				debugG.addChild(txt)
			}
		})
	}

	// Hover animation removed

	{
		for (let i = 0; i < balls.length; i++) {
			balls[i].filters = []
			const container = balls[i]
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			if (ballSprite) {
				// Hover animation removed

				ballSprite.eventMode = 'static'
				ballSprite.cursor = 'pointer'
				ballSprite.on('pointerover', () => {
					playHoverSound(colors[i])
				})
				// pointerout removed as it only handled animation
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
			const existingDisplay = (container as any).displayContainer as
				| Container
				| undefined
			if (existingDisplay) {
				try {
					container.removeChild(existingDisplay)
					;(container as any).displayContainer = undefined
				} catch (_) {}
			}

			// Adjust trail position for empty slot to prevent overflow
			const existingTrail = (container as any).userData?.trail as
				| Sprite
				| undefined

			// Use baseWidth for local radius (scaled appropriately by bubble logic)
			const radiusLocal = Math.round((baseWidths[i] / 2) * 0.55)

			if (existingTrail) {
				const s = scales[i]
				// Counter-scale
				const uniformTrailScale = 1.2 * SIZE_FACTOR
				existingTrail.scale.set(uniformTrailScale / s)

				const trailH =
					existingTrail.texture.height || existingTrail.height

				let correction = 0
				const c = colors[i]
				if (c === 'blue') correction = -25
				if (c === 'yellow') correction = -2

				// Calculate gap in LOCAL coordinates
				// visualGap = YELLOW_GAP_LOCKED * SIZE_FACTOR
				const visualGap = YELLOW_GAP_LOCKED * SIZE_FACTOR

				// Position relative to bubble (radiusLocal is effectively ballH/2 equivalent)
				// existingTrail.y = radiusLocal + visualGap/s + (trailH * uniformTrailScale)/2/s + correction/s

				existingTrail.y =
					radiusLocal +
					(visualGap + (trailH * uniformTrailScale) / 2) / s +
					correction / s

				// Update container Y to keep trail bottom aligned
				const newTrailBottomOffset = existingTrail.y + trailH / 2

				container.y = getY(i)
				;(container as any).userData.trailBottomOffset =
					newTrailBottomOffset
			}

			const s0 = scales[i]
			let bubble = (container as any).userData?.bubble as
				| Graphics
				| undefined
			if (!bubble) {
				const b = new Graphics()
				// Draw bubble with local radius
				b.circle(0, 0, radiusLocal)
				// Red bubble style for "add ball" indicator
				b.fill({ color: 0xff4d4f, alpha: 0.2 })
				b.stroke({ color: 0xff4d4f, width: 2, alpha: 0.8 })
				b.eventMode = 'static'
				b.cursor = 'pointer'
				// Set scale to 1 (local) because container is already scaled by s0
				b.scale.set(1)

				const plus = new Text({
					text: '+',
					style: {
						fontFamily: 'system-ui',
						fontSize: Math.round(radiusLocal * 1.2),
						fill: 0xff4d4f,
						fontWeight: 'bold',
						align: 'center',
					},
				})
				plus.anchor.set(0.5)
				// Center visually
				plus.y = -2
				b.addChild(plus)

				b.on('pointerover', () => {
					b.fill({ color: 0xff4d4f, alpha: 0.4 })
					b.stroke({ color: 0xffffff, width: 2, alpha: 1 })
					plus.style.fill = 0xffffff
					gsap.to(b.scale, {
						x: 1.1,
						y: 1.1,
						duration: 0.3,
						ease: 'back.out(1.7)',
					})
				})
				b.on('pointerout', () => {
					b.fill({ color: 0xff4d4f, alpha: 0.2 })
					b.stroke({ color: 0xff4d4f, width: 2, alpha: 0.8 })
					plus.style.fill = 0xff4d4f
					gsap.to(b.scale, {
						x: 1,
						y: 1,
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
			const existingDisplay = (container as any).displayContainer as
				| Container
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
			if (existingDisplay) {
				try {
					container.removeChild(existingDisplay)
					;(container as any).displayContainer = undefined
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
				// Use baseWidth for local radius so it scales with container
				const radius = Math.round((baseWidths[i] / 2) * 0.55)
				b.circle(0, 0, radius)
				b.fill({ color: 0x0a0f12, alpha: 0.35 })
				b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
				b.eventMode = 'static'
				b.cursor = 'pointer'
				b.scale.set(1)

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

			// Create Ball using Master Config
			const {
				container: masterContainer,
				updateNumber,
				displayContainer,
			} = await createMasterBall(
				newColor as any,
				val, // Use configured number
				{ gap: YELLOW_GAP_LOCKED }
			)

			// Transfer children from masterContainer to existing container
			// masterContainer has [Trail, Ball, Display] (roughly)
			// We want to insert Shadow between Trail and Ball if possible, or just behind Ball.

			// Extract sprites from masterContainer userData
			const ballSpriteNew = (masterContainer as any).userData
				?.ball as Sprite
			const trailSpriteNew = (masterContainer as any).userData
				?.trail as Sprite

			// Move children to our container
			while (masterContainer.children.length > 0) {
				container.addChild(masterContainer.children[0])
			}

			// Update userData
			;(container as any).userData = {
				...(container as any).userData,
				ball: ballSpriteNew,
				trail: trailSpriteNew,
				bubble: undefined,
			}
			;(container as any).displayContainer = displayContainer
			;(container as any).updateNumber = updateNumber

			if (trailSpriteNew) {
				trailSpriteNew.eventMode = 'none'
				// Trail animation removed
			}

			if (ballSpriteNew) {
				ballSpriteNew.eventMode = 'static'
				ballSpriteNew.cursor = 'pointer'
				ballSpriteNew.on('pointerover', () => {
					playHoverSound(newColor as any)
				})
				// pointerout removed

				const shadowTex = makeRadialTexture(
					512,
					'rgba(0,0,0,0.35)',
					'rgba(0,0,0,0)'
				)
				const shadow = new Sprite({ texture: shadowTex })
				shadow.anchor = 0.5
				const shDiameter =
					Math.max(ballSpriteNew.width, ballSpriteNew.height) * 1.2
				const shScale = shDiameter / 512
				shadow.scale.set(shScale)
				shadow.alpha = 0.14
				shadow.x = 0
				shadow.y =
					Math.max(ballSpriteNew.height, ballSpriteNew.width) * 0.12
				shadow.eventMode = 'none'

				// Insert shadow behind ball
				// We need to find the index of the ball and insert before it
				const ballIndex = container.getChildIndex(ballSpriteNew)
				container.addChildAt(shadow, Math.max(0, ballIndex))

				// Shadow animation removed

				ballSpriteNew.on('pointertap', () => {
					root.emit('configureBall', newColor, i, colors.slice())
				})

				// Restore Configured Indicator (Ring)
				const ring = new Graphics()
				const r =
					Math.max(ballSpriteNew.width, ballSpriteNew.height) * 0.65
				ring.arc(0, 0, r, 0, Math.PI * 2)
				ring.stroke({ color: 0x98ffb3, width: 3, alpha: 0.8 })
				ring.eventMode = 'none'
				container.addChild(ring)

				// Ring animation removed

				// Restore Remove Button
				const removeBtn = new Graphics()
				const btnSize = 40
				removeBtn.circle(0, 0, btnSize / 2)
				removeBtn.fill({ color: 0xff4d4f, alpha: 0.9 })
				removeBtn.stroke({ color: 0xffffff, width: 3 })

				const xMark = new Text({
					text: '✕',
					style: {
						fontFamily: 'Arial',
						fontSize: 24,
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

			// Enforce gap consistency
			if (ballSpriteNew && trailSpriteNew) {
				// DO NOT manually scale trailSpriteNew here; container is already scaled.
				// Scaling it again by 's' results in double scaling (s*s).

				const tH =
					trailSpriteNew.texture.height || trailSpriteNew.height
				const ballH =
					ballSpriteNew.texture.height || ballSpriteNew.height

				// Calculate gap in LOCAL coordinates
				// Desired Visual Gap = YELLOW_GAP_LOCKED (negative for overlap)
				// Local Gap = YELLOW_GAP_LOCKED / s
				// trailY (local) = (ballH/2) + (tH/2) + (YELLOW_GAP_LOCKED/s)
				trailSpriteNew.y =
					(ballH + tH) / 2 + YELLOW_GAP_LOCKED / scales[i]
				const newOffset = trailSpriteNew.y + tH / 2
				;(container as any).userData.trailBottomOffset = newOffset

				// Update container Y
				container.y = getY(i)
			}

			// Re-apply hover animation removed
		} catch (err) {
			console.error('Home/updateBallSprite error', err)
		}
	})

	{
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
		}

		applyConfigured()
		root.on('refreshConfigured', () => applyConfigured())

		// Sync initial state: create bubbles for unconfigured slots, or setup balls for configured ones
		{
			let configured: Record<string, number> = {}
			try {
				configured =
					JSON.parse(localStorage.getItem('configuredMap') || '{}') ||
					{}
			} catch (_) {}
			for (let i = 0; i < balls.length; i++) {
				const color = String(colors[i])
				// Update all slots. The handler checks configuration and swaps ball/bubble accordingly.
				root.emit('updateBallSprite', i, color)
			}
		}
	}

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
		// Gap = Visual Top of Trail - Visual Bottom of Ball
		// Visual Top of Trail = (trail.y - trailH/2) * s
		// Visual Bottom of Ball = (ballH/2) * s
		// We want to return the visual gap in pixels
		const trailH = trailSprite.texture.height || trailSprite.height
		const visualGap = s * (trailSprite.y - trailH / 2 - ballH / 2)
		return visualGap
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

		// Target visual gap = YELLOW_GAP_LOCKED
		// target = s * (trailY - tH/2 - ballH/2)
		// target/s = trailY - (tH+ballH)/2
		// trailY = target/s + (tH+ballH)/2

		trailSprite.y = target / s + (tH + ballH) / 2

		const user = (container as any).userData || {}
		user.trailBottomOffset = trailSprite.y + tH / 2
		;(container as any).userData = user
	}
	// Force all yellow marker (trail center-to-ball bottom) values to 20px
	for (let i = 0; i < balls.length; i++) {
		setGapTarget(i, YELLOW_GAP_LOCKED)
	}

	// Collapsible Debug UI removed (redundant)

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
					// Use standard hover animation removed
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
				// Apply standardized hover animation removed

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
				// Insert shadow at bottom (index 0) if possible
				container.addChildAt(shadow, 0)
				;(container as any).userData.shadow = shadow

				// Shadow animation removed
			}
			if (trailSprite) {
				// Trail animation removed
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
