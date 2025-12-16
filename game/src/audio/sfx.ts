import { getAudioContext, duckBGMTemporary } from '@/audio/bgm'

export function playHoverSound(color: string) {
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

export function playClickSound(color: string) {
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

export function playBeep() {
	const ac = getAudioContext()
	if (!ac) return
	try {
		const t = ac.currentTime
		const osc = ac.createOscillator()
		const g = ac.createGain()
		osc.type = 'sine'
		osc.frequency.setValueAtTime(740, t)
		g.gain.setValueAtTime(0.06, t)
		osc.connect(g).connect(ac.destination)
		duckBGMTemporary(0.12, 0.01, 0.18, 0.15)
		osc.start(t)
		osc.stop(t + 0.18)
		setTimeout(() => {
			try {
				osc.disconnect()
				g.disconnect()
			} catch (_) {}
		}, 240)
	} catch (_) {}
}

export function playConfirmSound() {
	const ac = getAudioContext()
	if (!ac) return
	try {
		const t0 = ac.currentTime
		const osc = ac.createOscillator()
		osc.type = 'sine'
		osc.frequency.setValueAtTime(800, t0)
		osc.frequency.exponentialRampToValueAtTime(1200, t0 + 0.1)
		const gain = ac.createGain()
		gain.gain.setValueAtTime(0, t0)
		gain.gain.linearRampToValueAtTime(0.1, t0 + 0.02)
		gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3)

		osc.connect(gain).connect(ac.destination)
		osc.start(t0)
		osc.stop(t0 + 0.3)

		duckBGMTemporary(0.06, 0.02, 0.4, 0.28)
	} catch (_) {}
}
