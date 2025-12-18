export type RTCController = {
	start: () => Promise<void>
	stop: () => void
	toggleAudio: (enabled: boolean) => void
	toggleVideo: (enabled: boolean) => void
	minimize: (min: boolean) => void
}

export function createRTC(
	signaler: { send: (d: any) => void; on: (e: string, fn: any) => void },
	role: 'A' | 'B'
) {
	let pc: RTCPeerConnection | null = null
	let localStream: MediaStream | null = null
	let remoteStream: MediaStream | null = null
	let localEl: HTMLVideoElement | null = null
	let remoteEl: HTMLVideoElement | null = null
	let started = false
	let minimized = false
	let audioEnabled = true
	let videoEnabled = true
	let pendingIce: any[] = []
	let overlay: HTMLDivElement | null = null
	let controls: HTMLDivElement | null = null
	const env = (import.meta as any)?.env || {}
	const turnUrl = String(env?.VITE_TURN_URL || '').trim()
	const turnUser = String(env?.VITE_TURN_USERNAME || '').trim()
	const turnPass = String(env?.VITE_TURN_PASSWORD || '').trim()
	const iceServers: RTCIceServer[] = [
		{ urls: 'stun:stun.l.google.com:19302' },
	]
	if (turnUrl) {
		if (turnUser && turnPass) {
			iceServers.push({
				urls: turnUrl,
				username: turnUser,
				credential: turnPass,
			} as any)
		} else {
			iceServers.push({ urls: turnUrl } as any)
		}
	}
	const ensureOverlay = () => {
		overlay = document.getElementById('rtcOverlay') as HTMLDivElement | null
		if (!overlay) {
			overlay = document.createElement('div')
			overlay.id = 'rtcOverlay'
			overlay.style.position = 'fixed'
			overlay.style.left = '50%'
			overlay.style.top = '50%'
			overlay.style.transform = 'translate(-50%, -50%)'
			overlay.style.width = '70vw'
			overlay.style.height = '70vh'
			overlay.style.pointerEvents = 'auto'
			overlay.style.display = 'flex'
			overlay.style.justifyContent = 'space-between'
			overlay.style.alignItems = 'center'
			overlay.style.gap = '12px'
			overlay.style.padding = '12px'
			overlay.style.background = 'rgba(0,0,0,0.2)'
			overlay.style.zIndex = '9999'
			document.body.appendChild(overlay)
		}
		localEl = document.getElementById('rtcLocal') as HTMLVideoElement | null
		remoteEl = document.getElementById(
			'rtcRemote'
		) as HTMLVideoElement | null
		if (!localEl) {
			localEl = document.createElement('video')
			localEl.id = 'rtcLocal'
			localEl.autoplay = true
			localEl.muted = true
			localEl.playsInline = true
			localEl.style.width = '48%'
			localEl.style.height = '100%'
			localEl.style.objectFit = 'cover'
			localEl.style.borderRadius = '12px'
			localEl.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.2)'
			localEl.style.pointerEvents = 'auto'
			overlay.appendChild(localEl)
		}
		if (!remoteEl) {
			remoteEl = document.createElement('video')
			remoteEl.id = 'rtcRemote'
			remoteEl.autoplay = true
			remoteEl.playsInline = true
			remoteEl.style.width = '48%'
			remoteEl.style.height = '100%'
			remoteEl.style.objectFit = 'cover'
			remoteEl.style.borderRadius = '12px'
			remoteEl.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.2)'
			remoteEl.style.pointerEvents = 'auto'
			overlay.appendChild(remoteEl)
		}
		controls = document.getElementById(
			'rtcControls'
		) as HTMLDivElement | null
		if (!controls) {
			controls = document.createElement('div')
			controls.id = 'rtcControls'
			controls.style.position = 'absolute'
			controls.style.left = '50%'
			controls.style.bottom = '8px'
			controls.style.transform = 'translateX(-50%)'
			controls.style.display = 'flex'
			controls.style.gap = '12px'
			controls.style.pointerEvents = 'auto'
			overlay.appendChild(controls)
			const mkBtn = (id: string, label: string) => {
				const b = document.createElement('button')
				b.id = id
				b.textContent = label
				b.style.padding = '8px 12px'
				b.style.borderRadius = '8px'
				b.style.border = '1px solid #98ffb3'
				b.style.background = 'rgba(0,0,0,0.6)'
				b.style.color = '#e6f7ff'
				b.style.cursor = 'pointer'
				return b
			}
			const micBtn = mkBtn('rtcMic', 'Mic: On')
			const camBtn = mkBtn('rtcCam', 'Cam: On')
			const minBtn = mkBtn('rtcMin', 'Minimize')
			micBtn.onclick = () => {
				audioEnabled = !audioEnabled
				toggleAudio(audioEnabled)
				micBtn.textContent = audioEnabled ? 'Mic: On' : 'Mic: Off'
			}
			camBtn.onclick = () => {
				videoEnabled = !videoEnabled
				toggleVideo(videoEnabled)
				camBtn.textContent = videoEnabled ? 'Cam: On' : 'Cam: Off'
			}
			minBtn.onclick = () => {
				minimized = !minimized
				minimize(minimized)
				minBtn.textContent = minimized ? 'Restore' : 'Minimize'
			}
			controls.appendChild(micBtn)
			controls.appendChild(camBtn)
			controls.appendChild(minBtn)
		}
	}
	const start = async () => {
		if (started) return
		started = true
		ensureOverlay()
		localStream = await navigator.mediaDevices
			.getUserMedia({
				video: videoEnabled ? { width: 1280, height: 720 } : false,
				audio: audioEnabled,
			})
			.catch(() => null)
		if (!localStream) {
			started = false
			return
		}
		if (localEl) localEl.srcObject = localStream
		pc = new RTCPeerConnection({
			iceServers,
		})
		pc.ontrack = ev => {
			const first = ev.streams?.[0] || null
			if (first) {
				if (remoteEl) remoteEl.srcObject = first
				remoteStream = first
			} else {
				if (!remoteStream) remoteStream = new MediaStream()
				try {
					remoteStream.addTrack(ev.track)
				} catch (_) {}
				if (remoteEl) remoteEl.srcObject = remoteStream
			}
			try {
				;(remoteEl as any).muted = false
			} catch (_) {}
		}
		pc.onicecandidate = ev => {
			if (ev.candidate) {
				signaler.send({
					type: 'rtc:ice',
					payload: ev.candidate,
				})
			}
		}
		for (const tr of localStream.getTracks()) {
			pc.addTrack(tr, localStream)
		}
		signaler.on('message', (raw: string) => {
			let msg: any = null
			try {
				msg = JSON.parse(raw)
			} catch (_) {}
			if (!msg || typeof msg !== 'object') return
			if (msg.type === 'rtc:offer') {
				if (!pc) return
				;(async () => {
					await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))
					const ans = await pc.createAnswer()
					await pc.setLocalDescription(ans)
					signaler.send({
						type: 'rtc:answer',
						payload: ans,
					})
					try {
						for (const c of pendingIce.splice(0, pendingIce.length)) {
							await pc.addIceCandidate(new RTCIceCandidate(c))
						}
					} catch (_) {}
				})()
			}
			if (msg.type === 'rtc:answer') {
				if (!pc) return
				;(async () => {
					await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))
					try {
						for (const c of pendingIce.splice(0, pendingIce.length)) {
							await pc.addIceCandidate(new RTCIceCandidate(c))
						}
					} catch (_) {}
				})()
			}
			if (msg.type === 'rtc:ice') {
				if (!pc) return
				;(async () => {
					try {
						if (!pc.remoteDescription) {
							pendingIce.push(msg.payload)
						} else {
							await pc.addIceCandidate(new RTCIceCandidate(msg.payload))
						}
					} catch (_) {}
				})()
			}
		})
		pc.onnegotiationneeded = async () => {
			try {
				if (role === 'A') {
					const offer = await pc!.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
					await pc!.setLocalDescription(offer)
					signaler.send({ type: 'rtc:offer', payload: offer })
				}
			} catch (_) {}
		}
		if (role === 'A') {
			const offer = await pc.createOffer({
				offerToReceiveAudio: true,
				offerToReceiveVideo: true,
			})
			await pc.setLocalDescription(offer)
			signaler.send({
				type: 'rtc:offer',
				payload: offer,
			})
		}
	}
	const stop = () => {
		started = false
		try {
			for (const t of localStream?.getTracks?.() || []) t.stop()
		} catch (_) {}
		try {
			for (const t of remoteStream?.getTracks?.() || []) t.stop()
		} catch (_) {}
		try {
			pc?.close()
		} catch (_) {}
		pc = null
		localStream = null
		remoteStream = null
		try {
			if (overlay) overlay.remove()
		} catch (_) {}
		overlay = null
	}
	const toggleAudio = (enabled: boolean) => {
		audioEnabled = !!enabled
		for (const t of localStream?.getAudioTracks?.() || []) {
			try {
				t.enabled = audioEnabled
			} catch (_) {}
		}
	}
	const toggleVideo = (enabled: boolean) => {
		videoEnabled = !!enabled
		for (const t of localStream?.getVideoTracks?.() || []) {
			try {
				t.enabled = videoEnabled
			} catch (_) {}
		}
	}
	const minimize = (min: boolean) => {
		minimized = !!min
		if (!overlay || !localEl || !remoteEl) return
		if (minimized) {
			overlay.style.left = '0'
			overlay.style.top = ''
			overlay.style.bottom = '0'
			overlay.style.transform = ''
			overlay.style.width = '100%'
			overlay.style.height = '160px'
			localEl.style.width = '200px'
			localEl.style.height = '140px'
			remoteEl.style.width = '200px'
			remoteEl.style.height = '140px'
		} else {
			overlay.style.left = '50%'
			overlay.style.top = '50%'
			overlay.style.bottom = ''
			overlay.style.transform = 'translate(-50%, -50%)'
			overlay.style.width = '70vw'
			overlay.style.height = '70vh'
			localEl.style.width = '48%'
			localEl.style.height = '100%'
			remoteEl.style.width = '48%'
			remoteEl.style.height = '100%'
		}
	}
	return { start, stop, toggleAudio, toggleVideo, minimize } as RTCController
}
