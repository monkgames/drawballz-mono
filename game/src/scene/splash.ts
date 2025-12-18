import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { startBGMOnce, ensureAudioUnlocked, prefetchBGM } from '@/audio/bgm'
import { isMobileDevice, isSlowNetwork } from '@/util/env'

async function loadSplashVideoSprite(
	w: number,
	h: number
): Promise<{ sprite: Sprite; video: HTMLVideoElement } | null> {
	try {
		if (isSlowNetwork() || isMobileDevice()) {
			return null
		}
		const video = document.createElement('video')
		const candidates = [
			// Prefer formats we actually ship
			'/assets/bg/splash_load.mp4',
			'/bg/splash_load.mp4',
			'/assets/bg/splash_load.mov',
			'/bg/splash_load.mov',
			'/assets/bg/splash_load.webm',
			'/bg/splash_load.webm',
		]
		let idx = 0
		video.src = candidates[0]
		video.crossOrigin = 'anonymous'
		video.muted = true
		video.loop = false
		video.playsInline = true
		video.setAttribute('playsinline', '')
		video.setAttribute('webkit-playsinline', '')
		video.setAttribute('muted', '')
		video.preload = 'metadata'
		await new Promise<void>((resolve, reject) => {
			const onReady = () => {
				video.removeEventListener('loadeddata', onReady)
				resolve()
			}
			const onError = (e: Event) => {
				video.removeEventListener('error', onError)
				if (idx < candidates.length - 1) {
					idx++
					video.src = candidates[idx]
					video.load()
				} else {
					reject(e)
				}
			}
			video.addEventListener('loadeddata', onReady)
			video.addEventListener('error', onError)
			video.load()
		})
		try {
			await video.play()
		} catch (_) {
			await video.play().catch(() => {})
			const unlock = () => {
				try {
					video.muted = false
					video.volume = 1.0
					void video.play()
				} catch (_) {}
				document.removeEventListener('pointerdown', unlock)
				document.removeEventListener('keydown', unlock)
			}
			document.addEventListener('pointerdown', unlock, { once: true })
			document.addEventListener('keydown', unlock, { once: true })
		}
		const tex = Texture.from(video)
		const sprite = new Sprite({ texture: tex })
		sprite.anchor = 0.5
		sprite.x = Math.round(w / 2)
		sprite.y = Math.round(h / 2)
		const texW = sprite.texture.width || 1
		const texH = sprite.texture.height || 1
		const scale = Math.max(w / texW, h / texH)
		sprite.scale.set(scale)
		return { sprite, video }
	} catch (_) {
		return null
	}
}

export async function createSplashScene(w: number, h: number) {
	const root = new Container()
	const content = new Container()
	root.addChild(content)

	const bg = new Graphics()
	bg.rect(0, 0, w, h)
	bg.fill({ color: 0x0e0e12 })
	content.addChild(bg)

	const loaded = await loadSplashVideoSprite(w, h)
	if (loaded) {
		const { sprite, video } = loaded
		content.addChild(sprite)
		void prefetchBGM()
		video.addEventListener(
			'ended',
			async () => {
				await ensureAudioUnlocked()
				await startBGMOnce()
				root.emit('splashCompleted')
			},
			{ once: true }
		)
	} else {
		// Fallback: light static image for low-end/slow networks
		try {
			const tex = (await (
				await import('pixi.js')
			).Assets.load('/assets/bg/splash_ig5.png')) as unknown as Texture
			const sprite = new Sprite({ texture: tex })
			sprite.anchor = 0.5
			sprite.x = Math.round(w / 2)
			sprite.y = Math.round(h / 2)
			const texW = sprite.texture.width || 1
			const texH = sprite.texture.height || 1
			const scale = Math.max(w / texW, h / texH)
			sprite.scale.set(scale)
			content.addChild(sprite)
			void prefetchBGM()
			setTimeout(async () => {
				await ensureAudioUnlocked()
				await startBGMOnce()
				root.emit('splashCompleted')
			}, 600)
		} catch (_) {
			root.emit('splashCompleted')
		}
	}
	// splash UI removed; show only media

	return root
}

export async function createCutsceneScene(
	w: number,
	h: number,
	sources: string[]
) {
	const root = new Container()
	const content = new Container()
	root.addChild(content)
	const bg = new Graphics()
	bg.rect(0, 0, w, h)
	bg.fill({ color: 0x0e0e12 })
	content.addChild(bg)
	try {
		const video = document.createElement('video')
		let idx = 0
		video.src = sources[idx] || ''
		video.crossOrigin = 'anonymous'
		video.muted = true
		video.loop = false
		video.playsInline = true
		video.setAttribute('playsinline', '')
		video.setAttribute('webkit-playsinline', '')
		video.setAttribute('muted', '')
		video.preload = 'metadata'
		await new Promise<void>((resolve, reject) => {
			const onReady = () => {
				video.removeEventListener('loadeddata', onReady)
				resolve()
			}
			const onError = (e: Event) => {
				video.removeEventListener('error', onError)
				if (idx < sources.length - 1) {
					idx++
					video.src = sources[idx]
					video.load()
				} else {
					reject(e)
				}
			}
			video.addEventListener('loadeddata', onReady)
			video.addEventListener('error', onError)
			video.load()
		})
		try {
			await video.play()
		} catch (_) {
			await video.play().catch(() => {})
			const unlock = () => {
				try {
					video.muted = false
					video.volume = 1.0
					void video.play()
				} catch (_) {}
				document.removeEventListener('pointerdown', unlock)
				document.removeEventListener('keydown', unlock)
			}
			document.addEventListener('pointerdown', unlock, { once: true })
			document.addEventListener('keydown', unlock, { once: true })
		}
		const tex = Texture.from(video)
		const sprite = new Sprite({ texture: tex })
		sprite.anchor = 0.5
		sprite.x = Math.round(w / 2)
		sprite.y = Math.round(h / 2)
		const texW = sprite.texture.width || 1
		const texH = sprite.texture.height || 1
		const scale = Math.max(w / texW, h / texH)
		sprite.scale.set(scale)
		content.addChild(sprite)
		video.addEventListener(
			'ended',
			async () => {
				await ensureAudioUnlocked()
				await startBGMOnce()
				root.emit('cutsceneCompleted')
			},
			{ once: true }
		)
	} catch (_) {}
	return root
}
