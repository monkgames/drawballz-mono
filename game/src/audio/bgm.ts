let audioCtx: AudioContext | null = null
let started = false
let source: AudioBufferSourceNode | null = null
let master: GainNode | null = null
let hp: BiquadFilterNode | null = null
let hs: BiquadFilterNode | null = null
let lp: BiquadFilterNode | null = null
let delay: DelayNode | null = null
let fb: GainNode | null = null
let wet: GainNode | null = null
let dry: GainNode | null = null
let comp: DynamicsCompressorNode | null = null
let cachedBuffer: AudioBuffer | null = null
let trimmedCache: AudioBuffer | null = null
let mediaEl: HTMLAudioElement | null = null
const BASE_GAIN = 0.18

function ensureAudioCtx(): AudioContext | null {
	const Ctor =
		(window as any).AudioContext || (window as any).webkitAudioContext
	if (!Ctor) return null
	if (!audioCtx) audioCtx = new Ctor()
	return audioCtx
}

export function getAudioContext(): AudioContext | null {
	return ensureAudioCtx()
}

export async function ensureAudioUnlocked() {
	const ac = ensureAudioCtx()
	if (!ac) return
	try {
		await ac.resume()
	} catch (_) {}
	if (ac.state === 'running') return
	await new Promise<void>(resolve => {
		const unlock = () => {
			const a = ensureAudioCtx()
			if (a && a.state !== 'running') {
				void a.resume().catch(() => {})
			}
			document.removeEventListener('pointerdown', unlock)
			document.removeEventListener('keydown', unlock)
			resolve()
		}
		document.addEventListener('pointerdown', unlock, { once: true })
		document.addEventListener('keydown', unlock, { once: true })
	})
}

export async function prefetchBGM() {
	const ac = ensureAudioCtx()
	if (!ac) return
	if (trimmedCache) return
	try {
		let buf: ArrayBuffer | null = null
		let fromBgPlay = false
		try {
			const respPlay = await fetch('/assets/sfx/bg_play.mp3', {
				cache: 'force-cache',
			})
			if (respPlay.ok) {
				buf = await respPlay.arrayBuffer()
				fromBgPlay = true
			}
		} catch (_) {}
		if (!buf) {
			const resp = await fetch('/assets/sfx/test.mp3', {
				cache: 'force-cache',
			})
			buf = await resp.arrayBuffer()
		}
		const decoded = await ac.decodeAudioData(buf)
		if (fromBgPlay) {
			trimmedCache = decoded
			cachedBuffer = null
			return
		}
		cachedBuffer = decoded
		const sr = cachedBuffer.sampleRate
		const D = cachedBuffer.duration
		const start = Math.max(8, D * 0.25)
		const end = Math.min(D - 4, start + 18)
		const startFrame = Math.floor(start * sr)
		const endFrame = Math.floor(end * sr)
		const length = Math.max(1, endFrame - startFrame)
		const trimmed = ac.createBuffer(1, length, sr)
		const to = trimmed.getChannelData(0)
		const ch0 = cachedBuffer.getChannelData(0)
		const ch1 =
			cachedBuffer.numberOfChannels > 1
				? cachedBuffer.getChannelData(1)
				: null
		for (let i = 0; i < length; i++) {
			const s0 = ch0[startFrame + i] || 0
			const s1 = ch1 ? ch1[startFrame + i] || 0 : 0
			to[i] = (s0 + s1) * 0.5
		}
		const fade = Math.floor(sr * 0.05)
		for (let i = 0; i < fade; i++) {
			const g = i / fade
			to[i] *= g
			const j = length - 1 - i
			const g2 = i / fade
			to[j] *= 1 - g2
		}
		trimmedCache = trimmed
		cachedBuffer = null
	} catch (_) {}
}

export async function startBGMOnce() {
	if (started) return
	if (isMuted()) return
	const ac = ensureAudioCtx()
	if (!ac) return
	try {
		await ac.resume()
	} catch (_) {}
	if (ac.state !== 'running') {
		await ensureAudioUnlocked()
	}
	const t0 = ac.currentTime
	master = ac.createGain()
	master.gain.setValueAtTime(BASE_GAIN, t0)
	master.connect(ac.destination)
	hp = ac.createBiquadFilter()
	hp.type = 'highpass'
	hp.frequency.setValueAtTime(60, t0)
	hp.Q.setValueAtTime(0.7, t0)
	hs = ac.createBiquadFilter()
	hs.type = 'highshelf'
	hs.frequency.setValueAtTime(6000, t0)
	hs.gain.setValueAtTime(-3, t0)
	lp = ac.createBiquadFilter()
	lp.type = 'lowpass'
	lp.frequency.setValueAtTime(5500, t0)
	lp.Q.setValueAtTime(0.7, t0)
	comp = ac.createDynamicsCompressor()
	comp.threshold.setValueAtTime(-24, t0)
	comp.knee.setValueAtTime(18, t0)
	comp.ratio.setValueAtTime(2, t0)
	comp.attack.setValueAtTime(0.01, t0)
	comp.release.setValueAtTime(0.25, t0)
	comp.connect(master)
	delay = ac.createDelay(1.0)
	delay.delayTime.setValueAtTime(0.22, t0)
	fb = ac.createGain()
	fb.gain.setValueAtTime(0.08, t0)
	delay.connect(fb).connect(delay)
	wet = ac.createGain()
	wet.gain.setValueAtTime(0.06, t0)
	dry = ac.createGain()
	dry.gain.setValueAtTime(0.6, t0)
	try {
		if (!trimmedCache) await prefetchBGM()
		if (!trimmedCache) return
		source = ac.createBufferSource()
		source.buffer = trimmedCache
		source.loop = true
		source.connect(hp)
		hp.connect(hs)
		hs.connect(lp)
		lp.connect(dry)
		lp.connect(delay)
		delay.connect(wet)
		dry.connect(comp)
		wet.connect(comp)
		source.start(t0)
		started = true
	} catch (_) {}
}

export function duckBGMTemporary(
	minGain = 0.12,
	attack = 0.02,
	hold = 0.35,
	release = 0.25
) {
	const ac = ensureAudioCtx()
	if (!ac || !master) return
	const t = ac.currentTime
	try {
		master.gain.cancelScheduledValues(t)
		const current = master.gain.value || BASE_GAIN
		master.gain.setValueAtTime(current, t)
		master.gain.linearRampToValueAtTime(minGain, t + attack)
		master.gain.setValueAtTime(minGain, t + attack + hold)
		master.gain.linearRampToValueAtTime(
			BASE_GAIN,
			t + attack + hold + release
		)
	} catch (_) {}
}

export async function tryStartBGMNow() {
	if (started) return
	const ac = ensureAudioCtx()
	if (!ac) return
	try {
		await ac.resume()
	} catch (_) {}
	if (ac.state !== 'running') return
	await startBGMOnce()
}

export function isAudioRunning() {
	const ac = ensureAudioCtx()
	if (!ac) return false
	return ac.state === 'running'
}

export function isBGMStarted() {
	return started
}

export async function startBGMElement() {
	if (mediaEl) return
	const el = document.createElement('audio')
	let triedFallback = false
	el.src = '/assets/sfx/bg_play.mp3'
	el.crossOrigin = 'anonymous'
	el.loop = true
	el.preload = 'auto'
	el.volume = 0.25
	el.autoplay = true
	el.muted = true
	el.setAttribute('playsinline', '')
	el.setAttribute('webkit-playsinline', '')
	el.style.display = 'none'
	el.addEventListener('error', () => {
		if (triedFallback) return
		triedFallback = true
		el.src = '/assets/sfx/test.mp3'
		try {
			void el.play()
		} catch (_) {}
	})
	document.body.appendChild(el)
	mediaEl = el
	try {
		await el.play()
	} catch (_) {}
	// Try to unmute shortly after successful autoplay
	setTimeout(() => {
		try {
			el.muted = false
		} catch (_) {}
	}, 800)
}

export function stopBGMElement() {
	try {
		mediaEl?.pause()
	} catch (_) {}
	if (mediaEl) {
		try {
			mediaEl.currentTime = 0
		} catch (_) {}
	}
	mediaEl = null
}

export function stopBGM() {
	try {
		if (source) source.stop()
	} catch (_) {}
	if (source) source.disconnect()
	if (wet) wet.disconnect()
	if (delay) delay.disconnect()
	if (fb) fb.disconnect()
	if (hp) hp.disconnect()
	if (hs) hs.disconnect()
	if (lp) lp.disconnect()
	if (dry) dry.disconnect()
	if (comp) comp.disconnect()
	if (master) master.disconnect()
	source = null
	wet = null
	delay = null
	fb = null
	hp = null
	hs = null
	lp = null
	dry = null
	comp = null
	master = null
	started = false
}

export function isMuted(): boolean {
	return (localStorage.getItem('bgmMuted') || '') === '1'
}

export function setMuted(muted: boolean) {
	localStorage.setItem('bgmMuted', muted ? '1' : '0')
	if (muted) {
		stopBGM()
		stopBGMElement()
	} else {
		void autoStartBGM()
	}
}

export function toggleBGM() {
	setMuted(!isMuted())
}

export async function autoStartBGM() {
	if (isMuted()) return
	void tryStartBGMNow()
	if (!isBGMStarted()) {
		await ensureAudioUnlocked()
		await startBGMOnce()
	}
	if (!isBGMStarted()) {
		void startBGMElement()
	}
	void prefetchBGM()
}
