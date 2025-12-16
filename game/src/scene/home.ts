import { Container, Graphics, Text, Assets, Sprite, Texture } from 'pixi.js'
import { createBall } from '@/modules/ball'
import { isMobileDevice, isSlowNetwork } from '@/util/env'
import { stopBGM, getAudioContext, duckBGMTemporary } from '@/audio/bgm'
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

function playHoverSound(color: string) {
	const ac = getAudioContext()
	if (!ac) return
	const freqMap: Record<string, number> = {
		green: 420,
		pink: 520,
		orange: 480,
		yellow: 560,
		blue: 380,
	}
	const f = freqMap[color] || 440
	const t0 = ac.currentTime
	const oscA = ac.createOscillator()
	oscA.type = 'sine'
	oscA.frequency.setValueAtTime(f, t0)
	oscA.detune.setValueAtTime(3, t0)
	const oscSub = ac.createOscillator()
	oscSub.type = 'sine'
	oscSub.frequency.setValueAtTime(f * 0.5, t0)
	const lfo = ac.createOscillator()
	lfo.type = 'sine'
	lfo.frequency.setValueAtTime(3.5, t0)
	const lfoGain = ac.createGain()
	lfoGain.gain.setValueAtTime(20, t0)
	const gain = ac.createGain()
	gain.gain.setValueAtTime(0, t0)
	gain.gain.linearRampToValueAtTime(0.14, t0 + 0.02)
	gain.gain.linearRampToValueAtTime(0.12, t0 + 0.08)
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6)
	const lowShelf = ac.createBiquadFilter()
	lowShelf.type = 'lowshelf'
	lowShelf.frequency.setValueAtTime(160, t0)
	lowShelf.gain.setValueAtTime(8, t0)
	const lp = ac.createBiquadFilter()
	lp.type = 'lowpass'
	lp.Q.setValueAtTime(0.7, t0)
	lp.frequency.setValueAtTime(1400, t0)
	lp.frequency.linearRampToValueAtTime(900, t0 + 0.5)
	const delay = ac.createDelay(0.35)
	delay.delayTime.setValueAtTime(0.18, t0)
	const fb = ac.createGain()
	fb.gain.setValueAtTime(0.18, t0)
	delay.connect(fb).connect(delay)
	const wet = ac.createGain()
	wet.gain.setValueAtTime(0.42, t0)
	oscA.connect(gain)
	oscSub.connect(gain)
	lfo.connect(lfoGain)
	lfoGain.connect(lp.frequency)
	gain.connect(lowShelf)
	lowShelf.connect(lp)
	lp.connect(wet)
	wet.connect(ac.destination)
	lp.connect(delay)
	const wetDelay = ac.createGain()
	wetDelay.gain.setValueAtTime(0.26, t0)
	delay.connect(wetDelay).connect(ac.destination)
	oscA.start(t0)
	oscSub.start(t0)
	lfo.start(t0)
	oscA.stop(t0 + 0.65)
	oscSub.stop(t0 + 0.65)
	lfo.stop(t0 + 0.65)
	duckBGMTemporary(0.06, 0.02, 0.6, 0.32)
}

function playClickSound(color: string) {
	const ac = getAudioContext()
	if (!ac) return
	const freqMap: Record<string, number> = {
		green: 500,
		pink: 600,
		orange: 560,
		yellow: 640,
		blue: 460,
	}
	const f = freqMap[color] || 520
	const t0 = ac.currentTime
	const osc = ac.createOscillator()
	osc.type = 'triangle'
	osc.frequency.setValueAtTime(f * 1.1, t0)
	osc.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.12)
	const sub = ac.createOscillator()
	sub.type = 'sine'
	sub.frequency.setValueAtTime(f * 0.5, t0)
	const gain = ac.createGain()
	gain.gain.setValueAtTime(0, t0)
	gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02)
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
	const lowShelf = ac.createBiquadFilter()
	lowShelf.type = 'lowshelf'
	lowShelf.frequency.setValueAtTime(140, t0)
	lowShelf.gain.setValueAtTime(6, t0)
	const lp = ac.createBiquadFilter()
	lp.type = 'lowpass'
	lp.Q.setValueAtTime(0.8, t0)
	lp.frequency.setValueAtTime(900, t0)
	lp.frequency.linearRampToValueAtTime(600, t0 + 0.22)
	const delay = ac.createDelay(0.28)
	delay.delayTime.setValueAtTime(0.12, t0)
	const fb = ac.createGain()
	fb.gain.setValueAtTime(0.14, t0)
	delay.connect(fb).connect(delay)
	const wet = ac.createGain()
	wet.gain.setValueAtTime(0.36, t0)
	osc.connect(gain)
	sub.connect(gain)
	gain.connect(lowShelf)
	lowShelf.connect(lp)
	lp.connect(wet)
	wet.connect(ac.destination)
	lp.connect(delay)
	const wetDelay = ac.createGain()
	wetDelay.gain.setValueAtTime(0.26, t0)
	delay.connect(wetDelay).connect(ac.destination)
	osc.start(t0)
	sub.start(t0)
	osc.stop(t0 + 0.3)
	sub.stop(t0 + 0.3)
	duckBGMTemporary(0.06, 0.02, 0.4, 0.28)
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
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
	const hiRes = dpr > 1
	const candidates: string[] = []
	if (hiRes) {
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
		'/bg/assets/bg_base.webp',
		'/bg/assets/bg_base.jpg',
		'/bg/assets/bg_base.png'
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
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
	const atlasCandidates =
		dpr > 1
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
	const candidates = ['/assets/bg/bg_layer.png', '/bg/assets/bg_layer.png']
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
		const candidates = [
			'/assets/bg/spaceship-haunts.mp4',
			'/bg/spaceship-haunts.mp4',
		]
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
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
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
	let bgLayer: Sprite | Graphics | null = null
	let bgIsVideo = false

	// Add immediate solid background to avoid any blank stage
	const bgSolid = makeBackground(DESIGN_W, DESIGN_H)
	content.addChild(bgSolid)
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
			content.addChildAt(sprite, 0)
			if (bgLayer) {
				try {
					content.removeChild(bgLayer)
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
			content.addChildAt(sprite, 0)
			if (bgLayer) {
				try {
					content.removeChild(bgLayer)
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

	{
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
			content.addChild(overlay)
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
		title.resolution = Math.min(window.devicePixelRatio || 1, 2)
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

	const readyText = new Text({
		text: 'Not Ready',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xffffff },
	})
	readyText.anchor = 0.5
	readyText.x = Math.round(DESIGN_W - 160)
	readyText.y = headerCenterY
	readyText.roundPixels = true
	readyText.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(readyText)
	const bgmBtnBox = new Graphics()
	const BGM_W = 120
	const BGM_H = 40
	bgmBtnBox.roundRect(0, 0, BGM_W, BGM_H, 10)
	const bgmMutedInit =
		(localStorage.getItem('bgmMuted') || '') === '1' ? true : false
	bgmBtnBox.fill({ color: bgmMutedInit ? 0xff4d4f : 0x98ffb3, alpha: 1.0 })
	bgmBtnBox.x = Math.round(DESIGN_W - 160 - BGM_W - 20)
	bgmBtnBox.y = Math.round(headerCenterY - BGM_H / 2)
	bgmBtnBox.eventMode = 'static'
	bgmBtnBox.cursor = 'pointer'
	content.addChild(bgmBtnBox)
	const bgmBtnLabel = new Text({
		text: bgmMutedInit ? 'BGM OFF' : 'BGM ON',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x000000 },
	})
	bgmBtnLabel.anchor = 0.5
	bgmBtnLabel.x = Math.round(bgmBtnBox.x + BGM_W / 2)
	bgmBtnLabel.y = Math.round(bgmBtnBox.y + BGM_H / 2)
	bgmBtnLabel.roundPixels = true
	bgmBtnLabel.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(bgmBtnLabel)
	bgmBtnBox.on('pointertap', async () => {
		try {
			const mutedNow = (localStorage.getItem('bgmMuted') || '') === '1'
			if (mutedNow) {
				localStorage.setItem('bgmMuted', '0')
				bgmBtnBox.fill({ color: 0x98ffb3, alpha: 1.0 })
				bgmBtnLabel.text = 'BGM ON'
				const { ensureAudioUnlocked, startBGMOnce, stopBGMElement } =
					await import('@/audio/bgm')
				await ensureAudioUnlocked()
				await startBGMOnce()
				stopBGMElement()
			} else {
				localStorage.setItem('bgmMuted', '1')
				bgmBtnBox.fill({ color: 0xff4d4f, alpha: 1.0 })
				bgmBtnLabel.text = 'BGM OFF'
				const { stopBGM, stopBGMElement } = await import('@/audio/bgm')
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
	matchBtnBox.x = Math.round(DESIGN_W / 2 - BTN_W / 2)
	matchBtnBox.y = btnY
	matchBtnBox.eventMode = 'static'
	matchBtnBox.cursor = 'pointer'
	content.addChild(matchBtnBox)
	const matchBtnLabel = new Text({
		text: 'MATCH',
		style: { fontFamily: 'system-ui', fontSize: 20, fill: 0x000000 },
	})
	matchBtnLabel.anchor = 0.5
	matchBtnLabel.x = Math.round(matchBtnBox.x + BTN_W / 2)
	matchBtnLabel.y = Math.round(matchBtnBox.y + BTN_H / 2)
	matchBtnLabel.roundPixels = true
	matchBtnLabel.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(matchBtnLabel)
	const cancelBtnBox = new Graphics()
	cancelBtnBox.roundRect(0, 0, BTN_W, BTN_H, 14)
	cancelBtnBox.fill({ color: 0xff4d4f, alpha: 1.0 })
	cancelBtnBox.x = matchBtnBox.x
	cancelBtnBox.y = matchBtnBox.y
	cancelBtnBox.eventMode = 'none'
	cancelBtnBox.cursor = 'auto'
	cancelBtnBox.visible = false
	content.addChild(cancelBtnBox)
	const cancelBtnLabel = new Text({
		text: 'CANCEL',
		style: { fontFamily: 'system-ui', fontSize: 20, fill: 0xffffff },
	})
	cancelBtnLabel.anchor = 0.5
	cancelBtnLabel.x = Math.round(cancelBtnBox.x + BTN_W / 2)
	cancelBtnLabel.y = Math.round(cancelBtnBox.y + BTN_H / 2)
	cancelBtnLabel.roundPixels = true
	cancelBtnLabel.resolution = Math.min(window.devicePixelRatio || 1, 2)
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
	matchStatus.y = Math.round(headerCenterY + 28)
	matchStatus.roundPixels = true
	matchStatus.resolution = Math.min(window.devicePixelRatio || 1, 2)
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
		loader2.stroke({ color: 0x98ffb3, width: 2, alpha: 0.18 })
		loader2.arc(
			0,
			0,
			loaderR2,
			-Math.PI / 2,
			-Math.PI / 2 + p * Math.PI * 2
		)
		loader2.stroke({ color: 0x98ffb3, width: 3, alpha: 0.9 })
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
	// Bet amount overlay (HTML) to capture user input
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
		overlay.style.display = 'flex'
		overlay.style.alignItems = 'center'
		overlay.style.gap = '8px'
		overlay.style.padding = '8px 10px'
		overlay.style.background = 'rgba(10,15,18,0.9)'
		overlay.style.border = '1px solid #375a44'
		overlay.style.borderRadius = '14px'
		overlay.style.zIndex = '9999'
		overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
		const label = document.createElement('span')
		label.textContent = 'Bet'
		label.style.color = '#e6f7ff'
		label.style.fontWeight = '600'
		const input = document.createElement('input')
		input.type = 'number'
		input.min = '1'
		input.step = '1'
		input.placeholder = 'Amount'
		input.style.width = '110px'
		input.style.padding = '8px 10px'
		input.style.color = '#e6f7ff'
		input.style.background = '#0a0f12'
		input.style.border = '1px solid #334155'
		input.style.borderRadius = '10px'
		input.style.outline = 'none'
		const setBtn = document.createElement('button')
		setBtn.textContent = 'Set'
		setBtn.style.padding = '8px 14px'
		setBtn.style.background = '#98ffb3'
		setBtn.style.color = '#000'
		setBtn.style.border = 'none'
		setBtn.style.borderRadius = '10px'
		setBtn.style.cursor = 'pointer'
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
			overlay.style.border = `1px solid ${borderColor}`
		}
		const submit = () => {
			const v = Math.max(1, Math.floor(Number(input.value) || 0))
			localStorage.setItem('betAmount', String(v))
			root.emit('betUpdated', v)
			applyBetStyle()
		}
		setBtn.addEventListener('click', submit)
		input.addEventListener('keydown', e => {
			if ((e as KeyboardEvent).key === 'Enter') submit()
		})
		input.addEventListener('input', applyBetStyle)
		overlay.appendChild(label)
		overlay.appendChild(input)
		overlay.appendChild(setBtn)
		document.body.appendChild(overlay)
		applyBetStyle()
		root.on('destroyed', () => {
			try {
				setBtn.removeEventListener('click', submit)
				overlay.remove()
			} catch (_) {}
		})
	}
	// Prize multipliers panel
	{
		const panel = new Graphics()
		const pW = 220
		const pH = 150
		panel.roundRect(0, 0, pW, pH, 12)
		panel.fill({ color: 0x0a0f12, alpha: 0.9 })
		panel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
		panel.x = Math.round(20)
		panel.y = Math.round(20)
		const title = new Text({
			text: 'Prize Multipliers',
			style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xe6f7ff },
		})
		title.x = panel.x + 12
		title.y = panel.y + 10
		const list = new Text({
			text: '',
			style: { fontFamily: 'system-ui', fontSize: 14, fill: 0x98ffb3 },
		})
		list.x = panel.x + 12
		list.y = panel.y + 36
		content.addChild(panel)
		content.addChild(title)
		content.addChild(list)
		;(async () => {
			const tryLoad = async (attempt = 1): Promise<void> => {
				try {
					const res = await fetch('/prize')
					if (!res.ok) throw new Error(`status ${res.status}`)
					const data = await res.json()
					const t = (data?.table || {}) as Record<number, number>
					const lines = [1, 2, 3, 4, 5]
						.map(k => `${k} matches → x${Number(t[k] || 0)}`)
						.join('\n')
					list.text = lines
				} catch (_) {
					if (attempt < 3) {
						list.text = 'Loading…'
						setTimeout(() => void tryLoad(attempt + 1), 1200)
					} else {
						list.text = 'Failed to load'
					}
				}
			}
			void tryLoad()
		})()
	}
	const proposalUI = new Container()
	proposalUI.zIndex = 1000
	const proposalPanel = new Graphics()
	const panelW = 400
	const panelH = 180
	proposalPanel.roundRect(0, 0, panelW, panelH, 16)
	proposalPanel.fill({ color: 0x0a0f12, alpha: 0.96 })
	proposalPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.8 })
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

	const next = new Text({
		text: 'NEXT LIVEBET',
		style: { fontFamily: 'system-ui', fontSize: 22, fill: 0x98ffb3 },
	})
	next.anchor = 0.5
	next.x = Math.round(DESIGN_W / 2)
	next.y = nextY
	next.roundPixels = true
	next.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(next)
	const nextLoader = new Graphics()
	const loaderR = 14
	nextLoader.x = Math.round(next.x - next.width / 2 - loaderR - 16)
	nextLoader.y = next.y
	content.addChild(nextLoader)
	const renderLoader = (p: number) => {
		nextLoader.clear()
		nextLoader.circle(0, 0, loaderR)
		nextLoader.stroke({ color: 0x98ffb3, width: 2, alpha: 0.18 })
		nextLoader.arc(
			0,
			0,
			loaderR,
			-Math.PI / 2,
			-Math.PI / 2 + p * Math.PI * 2
		)
		nextLoader.stroke({ color: 0x98ffb3, width: 3, alpha: 0.9 })
	}
	const loaderState = { p: 0 }
	renderLoader(0)
	gsap.to(loaderState, {
		p: 1,
		duration: 2.2,
		ease: 'none',
		repeat: -1,
		onUpdate: () => renderLoader(loaderState.p),
	})

	const countdownLabel = new Graphics()
	countdownLabel.roundRect(0.5, 0.5, 210, 48, 12)
	countdownLabel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
	countdownLabel.x = Math.round(DESIGN_W / 2 - 105)
	countdownLabel.y = Math.round(next.y + 30)
	content.addChild(countdownLabel)

	const countdown = new Text({
		text: 'Countdown 180',
		style: { fontFamily: 'system-ui', fontSize: 22, fill: 0xffffff },
	})
	countdown.anchor = 0.5
	countdown.x = Math.round(DESIGN_W / 2)
	countdown.y = Math.round(countdownLabel.y + 24)
	countdown.roundPixels = true
	countdown.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(countdown)

	type BallColor = 'green' | 'pink' | 'orange' | 'yellow' | 'blue'
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
				b.circle(0, 0, Math.round((ballWidths[i] / 2) * 0.55))
				b.fill({ color: 0x0a0f12, alpha: 0.35 })
				b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
				b.eventMode = 'static'
				b.cursor = 'pointer'
				b.scale.set(s0)
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
			if (countTextRef) {
				countTextRef.text = `${count}/5 Configured`
			}
			for (const key of Object.keys(configNodes)) {
				const idx = Number(key)
				const n = configNodes[idx]
				const curColor = String(colors[idx])
				const val = Number(configured[curColor]) || 0
				const container = balls[idx]
				const ballSprite = (container as any).userData?.ball as
					| Sprite
					| undefined
				const hasBall = !!ballSprite
				const isConfigured = hasBall && val > 0
				// recompute ring radius and redraw to ensure instant visual update
				const s = scales[idx]
				const r =
					(ballSprite
						? (ballSprite.texture.width || ballSprite.width) *
						  s *
						  0.55
						: (ballWidths[idx] / 2) * 0.55) || 30
				n.ring.clear()
				n.ring.circle(0, 0, Math.round(r))
				n.ring.x = Math.round(container.x)
				n.ring.y = Math.round(container.y)
				n.ring.stroke({
					color: isConfigured ? 0x00c853 : 0xff4d4f,
					width: 4,
					alpha: 0.9,
				})
				n.label.text = isConfigured ? String(val) : '-'
				n.label.style.fill = isConfigured ? 0x98ffb3 : 0xffb3b3
				try {
					console.log('Home/ringUpdate', {
						index: idx,
						color: curColor,
						hasBall,
						number: val,
						isConfigured,
						ringPos: { x: n.ring.x, y: n.ring.y },
					})
				} catch (_) {}
			}
		}
		const countText = new Text({
			text: '0/5 Configured',
			style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xe6f7ff },
		})
		countText.anchor = 0.5
		countText.x = Math.round(120)
		countText.y = headerCenterY
		countText.roundPixels = true
		countText.resolution = Math.min(window.devicePixelRatio || 1, 2)
		content.addChild(countText)
		countTextRef = countText
		for (let i = 0; i < balls.length; i++) {
			const container = balls[i]
			const color = colors[i]
			const ballSprite = (container as any).userData?.ball as
				| Sprite
				| undefined
			const s = scales[i]
			const r =
				(ballSprite
					? (ballSprite.texture.width || ballSprite.width) * s * 0.55
					: (ballWidths[i] / 2) * 0.55) || 30
			const ring = new Graphics()
			ring.circle(0, 0, Math.round(r))
			ring.x = Math.round(container.x)
			ring.y = Math.round(container.y)
			content.addChild(ring)
			const label = new Text({
				text: '-',
				style: {
					fontFamily: 'system-ui',
					fontSize: 18,
					fill: 0xffb3b3,
				},
			})
			label.anchor = 0.5
			label.x = Math.round(container.x)
			label.y = Math.round(container.y - r - 18)
			label.roundPixels = true
			label.resolution = Math.min(window.devicePixelRatio || 1, 2)
			content.addChild(label)
			// small delete button (×) above the ball
			const del = new Text({
				text: '×',
				style: {
					fontFamily: 'system-ui',
					fontSize: 18,
					fill: 0xffb3b3,
				},
			})
			del.anchor = 0.5
			del.x = Math.round(container.x)
			del.y = Math.round(container.y - r - 40)
			del.roundPixels = true
			del.resolution = Math.min(window.devicePixelRatio || 1, 2)
			del.eventMode = 'static'
			del.cursor = 'pointer'
			del.on('pointertap', () => {
				try {
					const existingBall = (container as any).userData?.ball as
						| Sprite
						| undefined
					if (existingBall) {
						try {
							container.removeChild(existingBall)
						} catch (_) {}
					}
					// ensure an empty bubble is shown; keep trail intact
					const s0 = scales[i]
					let bubble = (container as any).userData?.bubble as
						| Graphics
						| undefined
					if (!bubble) {
						const b = new Graphics()
						b.circle(0, 0, Math.round((ballWidths[i] / 2) * 0.55))
						b.fill({ color: 0x0a0f12, alpha: 0.35 })
						b.stroke({ color: 0x334155, width: 2, alpha: 0.9 })
						b.eventMode = 'static'
						b.cursor = 'pointer'
						b.scale.set(s0)
						container.addChild(b)
						bubble = b
						b.on('pointertap', (ev: any) => {
							try {
								console.log('Home/bubble tapped', {
									index: i,
									color: colors[i],
								})
								ev?.stopPropagation?.()
							} catch (_) {}
							root.emit(
								'configureBall',
								colors[i],
								i,
								colors.slice()
							)
						})
					}
					;(container as any).userData = {
						...(container as any).userData,
						ball: undefined,
						bubble,
					}
					// clear configured number for this color
					const key = 'configuredMap'
					let map: Record<string, number> = {}
					try {
						map =
							JSON.parse(localStorage.getItem(key) || '{}') || {}
					} catch (_) {}
					const curColor = String(colors[i])
					if (curColor in map) {
						try {
							delete map[curColor]
						} catch (_) {}
						localStorage.setItem(key, JSON.stringify(map))
					}
					// immediate UI refresh to force ring redraw
					root.emit('refreshConfigured')
				} catch (_) {}
			})
			content.addChild(del)
			configNodes[i] = { ring, label, del }
		}
		applyConfigured()
		root.on('refreshConfigured', () => applyConfigured())
	}

	// allow main app to update a ball sprite color by index
	root.on('updateBallSprite', async (idx: number, newColor: string) => {
		try {
			const i = Math.max(0, Math.min(balls.length - 1, Math.floor(idx)))
			// disallow duplicates
			if (
				colors.some((c, j) => {
					if (j === i) return false
					const other = balls[j]
					const hasBallOther = !!((other as any).userData?.ball as
						| Sprite
						| undefined)
					return hasBallOther && c === (newColor as any)
				})
			) {
				try {
					console.log('Home/updateBallSprite blocked (duplicate)', {
						index: i,
						newColor,
						colors,
					})
				} catch (_) {}
				return
			}
			const container = balls[i]
			const s = scales[i]
			// remove existing ball/trail children
			const existingBall = (container as any).userData?.ball as
				| Sprite
				| undefined
			const existingTrail = (container as any).userData?.trail as
				| Sprite
				| undefined
			const existingBubble = (container as any).userData?.bubble as
				| Graphics
				| undefined
			try {
				console.log('Home/updateBallSprite start', {
					index: i,
					newColor,
					hasBall: !!existingBall,
					hasTrail: !!existingTrail,
					hasBubble: !!existingBubble,
				})
			} catch (_) {}
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
			// create new ball with FX
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
			}
			if (ballSpriteNew) {
				ballSpriteNew.eventMode = 'static'
				ballSpriteNew.cursor = 'pointer'
			}
			// attach without per-child scaling; scale the container to keep slot width consistent
			if (trailSpriteNew) {
				container.addChild(trailSpriteNew as Sprite)
			}
			if (ballSpriteNew) {
				container.addChild(ballSpriteNew as Sprite)
			}
			// compute new container scale based on fresh base width to preserve slot width
			const freshMetrics = ((fresh as any).userData as any) || {
				baseWidth: ballSpriteNew?.width || 1,
				trailBottomOffset: (ballSpriteNew?.height || 0) * 0.5,
			}
			const baseWNew =
				Number(freshMetrics.baseWidth) ||
				(ballSpriteNew?.texture?.width as number) ||
				(ballSpriteNew?.width as number) ||
				1
			const sNew = Math.max(0.0001, (ballWidths[i] || 1) / baseWNew)
			container.scale.set(sNew)
			const trailBottomOffsetNew =
				Number(freshMetrics.trailBottomOffset) ||
				(ballSpriteNew?.height || 0) * 0.5
			const u0 = (container as any).userData || {}
			const origX = Number(u0.origX) || Math.round(container.x)
			const origY = Number(u0.origY) || Math.round(container.y)
			container.x = origX
			container.y = origY
			;(container as any).userData = {
				...(container as any).userData,
				ball: ballSpriteNew,
				trail: trailSpriteNew,
				bubble: undefined,
				baseWidth: baseWNew,
				trailBottomOffset: trailBottomOffsetNew,
				origX,
				origY,
			}
			// update color index mapping
			const prevColor = colors[i] as BallColor
			let swapIdx = -1
			for (let j = 0; j < colors.length; j++) {
				if (j !== i && colors[j] === (newColor as any)) {
					swapIdx = j
					break
				}
			}
			if (swapIdx >= 0) {
				colors[swapIdx] = prevColor as any
			}
			colors[i] = newColor as any
			// persist slot color mapping to localStorage
			try {
				localStorage.setItem('slotColors', JSON.stringify(colors))
				console.log('LocalStorage/slotColors updated', { colors })
			} catch (_) {}
			// restore locked trail gap for this slot to preserve spacing
			try {
				const target = (
					Array.isArray(LOCKED_YELLOW_GAPS) &&
					typeof LOCKED_YELLOW_GAPS[i] === 'number'
						? LOCKED_YELLOW_GAPS[i]
						: YELLOW_GAP_LOCKED
				) as number
				setGapTarget(i, target)
				console.log('Home/gapRestore', { index: i, target })
			} catch (_) {}
			// update configured UI (number/ring) to reflect new color mapping
			root.emit('refreshConfigured')
			try {
				const hasBubbleAfter = !!((container as any).userData
					?.bubble as Graphics | undefined)
				const hasBallAfter = !!((container as any).userData?.ball as
					| Sprite
					| undefined)
				console.log('Home/updateBallSprite done', {
					index: i,
					color: newColor,
					hasBallAfter,
					hasBubbleAfter,
				})
			} catch (_) {}
		} catch (_) {}
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

	if (SHOW_DEBUG) {
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
			label.resolution = Math.min(window.devicePixelRatio || 1, 2)
			labels.push(label)
		}
		debug.stroke({ color: 0xff0077, alpha: 0.9, width: 3 })
		content.addChild(debug)
		labels.forEach(l => content.addChild(l))

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
			label.resolution = Math.min(window.devicePixelRatio || 1, 2)
			trailLabels.push(label)
		}
		trailDebug.stroke({ color: 0xffff00, alpha: 0.9, width: 3 })
		content.addChild(trailDebug)
		trailLabels.forEach(l => content.addChild(l))
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

	let remaining = 180
	const tick = () => {
		remaining = Math.max(0, remaining - 1)
		countdown.text = `Countdown ${remaining}`
		gsap.fromTo(countdown, { alpha: 0.6 }, { alpha: 1, duration: 0.2 })
	}
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

	return root
}
