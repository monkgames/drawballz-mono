export let toggleSettings: () => void = () => {}

export type RTCController = {
	start: () => Promise<void>
	stop: () => void
	toggleAudio: (enabled: boolean) => void
	toggleVideo: (enabled: boolean) => void
	minimize: (min: boolean) => void
}

export function createRTC(
	signaler: { send: (d: any) => void; on: (e: string, fn: any) => void },
	role: 'A' | 'B',
	initialMessages: any[] = []
) {
	console.log(
		'RTC: Created with role',
		role,
		'buffered messages:',
		initialMessages.length
	)
	let pc: RTCPeerConnection | null = null
	let localStream: MediaStream | null = null
	let remoteStream: MediaStream | null = null
	let localEl: HTMLVideoElement | null = null
	let remoteEl: HTMLVideoElement | null = null
	let started = false
	let minimized = true
	let audioEnabled = true
	let videoEnabled = true
	let pendingSignals: any[] = [...initialMessages]
	let overlay: HTMLDivElement | null = null
	let controls: HTMLDivElement | null = null
	let settingsPanel: HTMLDivElement | null = null
	let facingMode: 'user' | 'environment' = 'user'
	let noiseCancellation = true
	let backgroundBlur = false

	const getConstraints = (): MediaStreamConstraints => ({
		audio: {
			echoCancellation: noiseCancellation,
			noiseSuppression: noiseCancellation,
			autoGainControl: noiseCancellation,
		},
		video: videoEnabled
			? {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode,
					// @ts-ignore
					advanced: backgroundBlur ? [{ backgroundBlur: true }] : [],
			  }
			: false,
	})

	const restartStream = async () => {
		if (!started) return
		localStream?.getTracks().forEach(t => t.stop())
		try {
			localStream = await navigator.mediaDevices.getUserMedia(
				getConstraints()
			)
		} catch (err) {
			console.warn('RTC: getUserMedia failed', err)
			localStream = null
		}

		if (localStream) {
			localStream
				.getAudioTracks()
				.forEach(t => (t.enabled = audioEnabled))
			localStream
				.getVideoTracks()
				.forEach(t => (t.enabled = videoEnabled))
			if (localEl) localEl.srcObject = localStream
			if (pc) {
				const transceivers = pc.getTransceivers()
				localStream.getTracks().forEach(track => {
					const t = transceivers.find(
						tr => tr.receiver.track.kind === track.kind
					)
					if (t && t.sender) {
						t.sender.replaceTrack(track).catch(() => {})
					}
				})
			}
		}
	}

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
			// Tap to Start Overlay
			const tapOverlay = document.createElement('div')
			tapOverlay.className = 'rtc-tap-overlay'
			tapOverlay.style.position = 'absolute'
			tapOverlay.style.top = '0'
			tapOverlay.style.left = '0'
			tapOverlay.style.width = '100%'
			tapOverlay.style.height = '100%'
			tapOverlay.style.display = 'flex'
			tapOverlay.style.justifyContent = 'center'
			tapOverlay.style.alignItems = 'center'
			tapOverlay.style.background = 'rgba(0,0,0,0.4)'
			tapOverlay.style.borderRadius = '12px'
			tapOverlay.style.cursor = 'pointer'
			tapOverlay.style.zIndex = '10'
			const tapBtn = document.createElement('button')
			tapBtn.textContent = 'Start Video'
			tapBtn.style.padding = '6px 12px'
			tapBtn.style.borderRadius = '6px'
			tapBtn.style.border = 'none'
			tapBtn.style.background = '#98ffb3'
			tapBtn.style.color = '#000'
			tapBtn.style.pointerEvents = 'none' // Click passes to container
			tapOverlay.appendChild(tapBtn)

			const onStart = async (e: Event) => {
				e.stopPropagation()
				tapBtn.textContent = 'Starting...'
				await start()
			}
			tapOverlay.addEventListener('click', onStart)
			tapOverlay.addEventListener('touchend', onStart)

			// Wrapper to hold video + overlay
			const wrapper = document.createElement('div')
			wrapper.style.position = 'relative'
			wrapper.style.width = '48%'
			wrapper.style.height = '100%'
			wrapper.appendChild(localEl)
			wrapper.appendChild(tapOverlay)

			// Update localEl style to fill wrapper
			localEl.style.width = '100%'

			overlay.appendChild(wrapper)

			// Store wrapper reference if needed, or just know localEl is inside it
			localEl.onloadeddata = () => {
				tapOverlay.style.display = 'none'
			}
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

			// Tap to Play Overlay
			const tapOverlay = document.createElement('div')
			tapOverlay.style.position = 'absolute'
			tapOverlay.style.top = '0'
			tapOverlay.style.left = '0'
			tapOverlay.style.width = '100%'
			tapOverlay.style.height = '100%'
			tapOverlay.style.display = 'none' // Hidden by default
			tapOverlay.style.justifyContent = 'center'
			tapOverlay.style.alignItems = 'center'
			tapOverlay.style.background = 'rgba(0,0,0,0.4)'
			tapOverlay.style.borderRadius = '12px'
			tapOverlay.style.cursor = 'pointer'
			tapOverlay.style.zIndex = '10'
			const tapBtn = document.createElement('button')
			tapBtn.textContent = 'Tap to Play'
			tapBtn.style.padding = '6px 12px'
			tapBtn.style.borderRadius = '6px'
			tapBtn.style.border = 'none'
			tapBtn.style.background = '#e6f7ff'
			tapBtn.style.color = '#000'
			tapBtn.style.pointerEvents = 'none'
			tapOverlay.appendChild(tapBtn)

			const onPlay = (e: Event) => {
				e.stopPropagation()
				remoteEl
					?.play()
					.then(() => {
						tapOverlay.style.display = 'none'
					})
					.catch(() => {})
			}
			tapOverlay.addEventListener('click', onPlay)
			tapOverlay.addEventListener('touchend', onPlay)

			const wrapper = document.createElement('div')
			wrapper.style.position = 'relative'
			wrapper.style.width = '48%'
			wrapper.style.height = '100%'
			wrapper.appendChild(remoteEl)
			wrapper.appendChild(tapOverlay)

			remoteEl.style.width = '100%'

			remoteEl.onloadedmetadata = () => {
				remoteEl?.play().catch(() => {
					tapOverlay.style.display = 'flex'
				})
			}
			remoteEl.onpause = () => {
				if (remoteEl && remoteEl.readyState >= 2 && !remoteEl.ended) {
					tapOverlay.style.display = 'flex'
				}
			}
			remoteEl.onplay = () => {
				tapOverlay.style.display = 'none'
			}
			overlay.appendChild(wrapper)
		}

		// Controls
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
			const minBtn = mkBtn('rtcMin', minimized ? 'Restore' : 'Minimize')
			const setBtn = mkBtn('rtcSet', 'Settings')
			const refreshBtn = mkBtn('rtcRef', '↻')
			refreshBtn.title = 'Refresh Connection'

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
			setBtn.onclick = () => {
				if (!settingsPanel) return
				const v = settingsPanel.style.display !== 'none'
				settingsPanel.style.display = v ? 'none' : 'flex'
				setBtn.textContent = v ? 'Settings' : 'Close'
			}
			refreshBtn.onclick = async () => {
				// Restart ICE/Negotiation if possible, or just re-request media
				await restartStream()
				// Trigger negotiation
				if (pc) {
					pc.onnegotiationneeded?.(new Event('negotiationneeded'))
				}
			}

			toggleSettings = () => {
				if (setBtn && setBtn.onclick) {
					;(setBtn as any).onclick()
				}
			}

			controls.appendChild(micBtn)
			controls.appendChild(camBtn)
			controls.appendChild(minBtn)
			controls.appendChild(setBtn)
			controls.appendChild(refreshBtn)
		}

		// Settings Panel
		settingsPanel = document.getElementById(
			'rtcSettings'
		) as HTMLDivElement | null
		if (!settingsPanel) {
			settingsPanel = document.createElement('div')
			settingsPanel.id = 'rtcSettings'
			settingsPanel.style.position = 'absolute'
			settingsPanel.style.left = '50%'
			settingsPanel.style.bottom = '60px'
			settingsPanel.style.transform = 'translateX(-50%)'
			settingsPanel.style.background = 'rgba(0,0,0,0.95)'
			settingsPanel.style.padding = '16px'
			settingsPanel.style.borderRadius = '12px'
			settingsPanel.style.border = '1px solid #98ffb3'
			settingsPanel.style.display = 'none'
			settingsPanel.style.flexDirection = 'column'
			settingsPanel.style.gap = '12px'
			settingsPanel.style.zIndex = '10000'
			settingsPanel.style.minWidth = '220px'

			const mkToggle = (
				lbl: string,
				active: boolean,
				onClick: () => void
			) => {
				const r = document.createElement('div')
				r.style.display = 'flex'
				r.style.justifyContent = 'space-between'
				r.style.alignItems = 'center'
				r.style.color = '#e6f7ff'
				r.style.fontFamily = 'system-ui'
				r.style.fontSize = '14px'
				const txt = document.createElement('span')
				txt.textContent = lbl
				const btn = document.createElement('button')
				btn.textContent = active ? 'ON' : 'OFF'
				btn.style.padding = '4px 8px'
				btn.style.borderRadius = '4px'
				btn.style.border = '1px solid #98ffb3'
				btn.style.background = active ? '#98ffb3' : 'transparent'
				btn.style.color = active ? '#000' : '#98ffb3'
				btn.style.cursor = 'pointer'
				btn.onclick = () => {
					onClick()
					const newState = btn.textContent === 'OFF'
					btn.textContent = newState ? 'ON' : 'OFF'
					btn.style.background = newState ? '#98ffb3' : 'transparent'
					btn.style.color = newState ? '#000' : '#98ffb3'
				}
				r.appendChild(txt)
				r.appendChild(btn)
				return r
			}

			// Noise Cancellation
			settingsPanel.appendChild(
				mkToggle('Noise Cancel', noiseCancellation, () => {
					noiseCancellation = !noiseCancellation
					restartStream()
				})
			)
			// Backdrop Blur
			settingsPanel.appendChild(
				mkToggle('Backdrop Blur', backgroundBlur, () => {
					backgroundBlur = !backgroundBlur
					restartStream()
				})
			)
			// Camera Flip
			settingsPanel.appendChild(
				mkToggle('Front/Rear', facingMode === 'environment', () => {
					facingMode = facingMode === 'user' ? 'environment' : 'user'
					restartStream()
				})
			)

			overlay.appendChild(settingsPanel)
		}
		minimize(minimized)
	}
	const start = async () => {
		if (started) return
		started = true
		ensureOverlay()

		const tryGetMedia = async () => {
			try {
				localStream = await navigator.mediaDevices.getUserMedia(
					getConstraints()
				)
				if (localStream) {
					// Got stream!
					started = true
					if (localEl) localEl.srcObject = localStream
					startPeerConnection()
					// Clear error if exists
					const oldErr = document.getElementById('rtcError')
					if (oldErr) oldErr.remove()
				}
			} catch (err: any) {
				console.error('RTC: getUserMedia failed', err)
				// Force restore overlay to show error
				minimize(false)
				// Show permission error UI
				if (overlay) {
					let errDiv = document.getElementById(
						'rtcError'
					) as HTMLDivElement
					if (!errDiv) {
						errDiv = document.createElement('div')
						errDiv.id = 'rtcError'
						errDiv.style.position = 'absolute'
						errDiv.style.top = '50%'
						errDiv.style.left = '50%'
						errDiv.style.transform = 'translate(-50%, -50%)'
						errDiv.style.background = 'rgba(20,0,0,0.9)'
						errDiv.style.padding = '20px'
						errDiv.style.border = '1px solid #ff4444'
						errDiv.style.borderRadius = '8px'
						errDiv.style.textAlign = 'center'
						errDiv.style.zIndex = '10001'
						overlay.appendChild(errDiv)
					}

					// Clear content
					errDiv.innerHTML = ''

					const msg = document.createElement('div')
					msg.style.color = '#fff'
					msg.style.marginBottom = '12px'
					msg.style.maxWidth = '280px'

					let errText = 'Camera/Microphone access needed.'
					if (
						err.name === 'NotAllowedError' ||
						err.name === 'PermissionDeniedError'
					) {
						errText =
							'Access blocked. Please enable Camera/Microphone in browser settings/URL bar.'
					} else if (err.name === 'NotFoundError') {
						errText = 'No camera or microphone found.'
					} else if (err.name === 'NotReadableError') {
						errText = 'Camera/Microphone is in use by another app.'
					}
					msg.textContent = errText
					errDiv.appendChild(msg)

					const retryBtn = document.createElement('button')
					retryBtn.textContent = 'Try Again'
					retryBtn.style.padding = '8px 16px'
					retryBtn.style.background = '#ff4444'
					retryBtn.style.color = '#fff'
					retryBtn.style.border = 'none'
					retryBtn.style.borderRadius = '4px'
					retryBtn.style.cursor = 'pointer'
					retryBtn.onclick = async () => {
						retryBtn.textContent = 'Requesting...'
						retryBtn.disabled = true
						retryBtn.style.opacity = '0.7'
						await tryGetMedia()
					}
					errDiv.appendChild(retryBtn)
				}
				started = false
			}
		}

		await tryGetMedia()
	}

	const updateConnectionStatus = (state: string) => {
		if (overlay) {
			const statusEl =
				document.getElementById('rtcStatus') ||
				document.createElement('div')
			statusEl.id = 'rtcStatus'
			statusEl.style.position = 'absolute'
			statusEl.style.top = '10px'
			statusEl.style.left = '50%'
			statusEl.style.transform = 'translateX(-50%)'
			statusEl.style.padding = '4px 8px'
			statusEl.style.borderRadius = '4px'
			statusEl.style.fontSize = '12px'
			statusEl.style.fontWeight = 'bold'
			statusEl.style.color = '#fff'
			statusEl.style.zIndex = '10000'

			if (state === 'connected' || state === 'completed') {
				statusEl.style.background = 'rgba(0, 255, 0, 0.5)'
				statusEl.textContent = 'Connected'
			} else if (state === 'failed' || state === 'disconnected') {
				statusEl.style.background = 'rgba(255, 0, 0, 0.5)'
				statusEl.textContent = 'Disconnected'
			} else {
				statusEl.style.background = 'rgba(255, 165, 0, 0.5)'
				statusEl.textContent = state
			}
			if (!document.getElementById('rtcStatus'))
				overlay.appendChild(statusEl)
		}
	}

	const startPeerConnection = () => {
		console.log(
			'RTC: startPeerConnection called, localStream:',
			!!localStream
		)
		if (!localStream) return
		pc = new RTCPeerConnection({
			iceServers,
		})

		// Use explicit transceivers to ensure correct direction and track assignment
		const videoTrack = localStream
			.getVideoTracks()
			.find(t => t.kind === 'video')
		const audioTrack = localStream
			.getAudioTracks()
			.find(t => t.kind === 'audio')

		const videoTransceiver = pc.addTransceiver(videoTrack || 'video', {
			direction: 'sendrecv',
			streams: videoTrack && localStream ? [localStream] : [],
		})
		const audioTransceiver = pc.addTransceiver(audioTrack || 'audio', {
			direction: 'sendrecv',
			streams: audioTrack && localStream ? [localStream] : [],
		})
		console.log('RTC: Transceivers added', {
			video: {
				mid: videoTransceiver.mid,
				direction: videoTransceiver.direction,
			},
			audio: {
				mid: audioTransceiver.mid,
				direction: audioTransceiver.direction,
			},
		})

		pc.ontrack = ev => {
			console.log('RTC: ontrack', ev.track.kind, ev.streams.length)

			// Force track enabled
			ev.track.enabled = true

			const first = ev.streams?.[0] || null
			if (first) {
				if (remoteEl && remoteEl.srcObject !== first) {
					remoteEl.srcObject = first
					remoteEl
						.play()
						.catch(e => console.warn('RTC: remote play fail', e))
				}
				remoteStream = first
			} else {
				if (!remoteStream) remoteStream = new MediaStream()
				try {
					// Check if track already added
					if (
						remoteStream
							.getTracks()
							.every(t => t.id !== ev.track.id)
					) {
						remoteStream.addTrack(ev.track)
					}
				} catch (_) {}
				if (remoteEl && remoteEl.srcObject !== remoteStream) {
					remoteEl.srcObject = remoteStream
					remoteEl
						.play()
						.catch(e => console.warn('RTC: remote play fail', e))
				}
			}
			try {
				;(remoteEl as any).muted = false
				;(remoteEl as any).volume = 1.0
			} catch (_) {}

			// Visual indicator if video is missing
			if (ev.track.kind === 'video' && remoteEl) {
				const checkVideo = setInterval(() => {
					if (remoteEl && remoteEl.videoWidth > 0) {
						clearInterval(checkVideo)
						console.log(
							'RTC: Remote video playing',
							remoteEl.videoWidth,
							remoteEl.videoHeight,
							'muted:',
							remoteEl.muted,
							'paused:',
							remoteEl.paused,
							'srcObject:',
							!!remoteEl.srcObject
						)
					} else {
						console.log(
							'RTC: Waiting for remote video dimensions...',
							'readyState:',
							remoteEl?.readyState,
							'paused:',
							remoteEl?.paused,
							'srcObject:',
							!!remoteEl?.srcObject
						)
					}
				}, 1000)
			}

			const unlock = () => {
				try {
					remoteEl?.play?.().catch(() => {})
				} catch (_) {}
				document.removeEventListener('pointerdown', unlock)
				document.removeEventListener('keydown', unlock)
			}
			document.addEventListener('pointerdown', unlock, { once: true })
			document.addEventListener('keydown', unlock, { once: true })
		}
		pc.onicecandidate = ev => {
			if (ev.candidate) {
				signaler.send({
					type: 'rtc:ice',
					payload: ev.candidate,
				})
			}
		}
		pc.onnegotiationneeded = async () => {
			try {
				if (role === 'A') {
					console.log('RTC: creating offer...')
					const offer = await pc!.createOffer({
						offerToReceiveAudio: true,
						offerToReceiveVideo: true,
					})
					await pc!.setLocalDescription(offer)
					signaler.send({ type: 'rtc:offer', payload: offer })
				}
			} catch (err) {
				console.error('RTC: negotiation error', err)
			}
		}
		pc.onconnectionstatechange = () => {
			console.log('RTC: Connection state:', pc?.connectionState)
			if (pc?.connectionState === 'failed') {
				console.error('RTC: Connection failed! Need restart?')
			}
		}
		pc.oniceconnectionstatechange = () => {
			console.log('RTC: ICE State:', pc?.iceConnectionState)
			updateConnectionStatus(pc?.iceConnectionState || 'new')
		}
		pc.onicegatheringstatechange = () => {
			console.log('RTC: ICE gathering:', pc?.iceGatheringState)
		}

		// Flush pending signals that arrived before PC was ready
		if (pendingSignals.length > 0) {
			console.log(
				'RTC: flushing',
				pendingSignals.length,
				'buffered signals after init'
			)
			pendingSignals.forEach(handleSignal)
			pendingSignals = []
		}
	}

	const handleSignal = async (msg: any) => {
		// Fix: Buffer signals until media is initialized (started = true)
		if (!pc || !started) {
			console.log(
				'RTC: Buffering signal (waiting for start)...',
				msg.type
			)
			pendingSignals.push(msg)
			return
		}
		console.log(
			'RTC: handleSignal',
			msg.type,
			'Role:',
			role,
			'PC Ready:',
			!!pc
		)

		if (msg.type === 'rtc:offer') {
			console.log(
				'RTC: received offer',
				msg.payload?.sdp?.substring(0, 50) + '...'
			)
			// Glare handling: if we have a local offer and we are the "polite" peer (role B), rollback.
			// Or simplified: if we are role B, we always accept the offer.
			// If we are role A, we ignore incoming offers (we are the offerer).
			if (role === 'A') {
				console.warn(
					'RTC: received offer but I am Offerer (A). Ignoring to prevent glare.'
				)
				return
			}
			try {
				if (pc.signalingState !== 'stable') {
					console.warn(
						'RTC: signaling state not stable during offer',
						pc.signalingState
					)
					// If we are B, we should rollback? But we don't send offers if B.
					// So if state is not stable, it might be 'have-remote-offer' (duplicate offer)?
					// Or 'have-local-offer' (which shouldn't happen for B unless logic is wrong).
					// Let's assume standard flow for B.
					await Promise.all([
						pc.setLocalDescription({ type: 'rollback' }),
						pc.setRemoteDescription(
							new RTCSessionDescription(msg.payload)
						),
					])
				} else {
					await pc.setRemoteDescription(
						new RTCSessionDescription(msg.payload)
					)
				}

				// Fix: Ensure local tracks are attached to the negotiated transceivers
				if (localStream) {
					console.log(
						'RTC: Checking for transceiver track mismatch...'
					)
					const transceivers = pc.getTransceivers()
					for (const t of transceivers) {
						// If this transceiver is negotiated (has mid) but has no sender track
						if (t.mid && !t.sender.track && t.receiver.track) {
							const kind = t.receiver.track.kind
							const localTrack = localStream
								.getTracks()
								.find(tr => tr.kind === kind)
							if (localTrack) {
								console.log(
									`RTC: Attaching local ${kind} track to negotiated transceiver ${t.mid}`
								)
								await t.sender.replaceTrack(localTrack)
								t.direction = 'sendrecv'
							}
						} else if (
							t.mid &&
							t.sender.track &&
							t.direction !== 'sendrecv'
						) {
							// Ensure direction is correct if track is present
							console.log(
								`RTC: Forcing sendrecv on transceiver ${t.mid}`
							)
							t.direction = 'sendrecv'
						}
					}
				}

				const ans = await pc.createAnswer()
				await pc.setLocalDescription(ans)
				console.log('RTC: Created and set local answer', {
					sdpHeader: ans.sdp?.substring(0, 100),
					hasSendRecv: ans.sdp?.includes('a=sendrecv'),
					hasRecvOnly: ans.sdp?.includes('a=recvonly'),
					hasSendOnly: ans.sdp?.includes('a=sendonly'),
				})
				signaler.send({
					type: 'rtc:answer',
					payload: ans,
				})

				// Flush early ICE
				if (pc.remoteDescription && (pc as any)._earlyIce?.length) {
					console.log(
						'RTC: flushing early ICE',
						(pc as any)._earlyIce.length
					)
					for (const candidate of (pc as any)._earlyIce) {
						try {
							await pc.addIceCandidate(
								new RTCIceCandidate(candidate)
							)
						} catch (_) {}
					}
					;(pc as any)._earlyIce = []
				}
			} catch (e) {
				console.error('RTC: handle offer error', e)
			}
		}
		if (msg.type === 'rtc:answer') {
			console.log('RTC: received answer', {
				sdpHeader: msg.payload?.sdp?.substring(0, 100),
				hasSendRecv: msg.payload?.sdp?.includes('a=sendrecv'),
				hasRecvOnly: msg.payload?.sdp?.includes('a=recvonly'),
				hasSendOnly: msg.payload?.sdp?.includes('a=sendonly'),
			})
			try {
				await pc.setRemoteDescription(
					new RTCSessionDescription(msg.payload)
				)
				console.log('RTC: Remote description set from answer')
			} catch (e) {
				console.error('RTC: handle answer error', e)
			}
		}
		if (msg.type === 'rtc:ice') {
			console.log('RTC: received ICE candidate')
			try {
				if (pc.remoteDescription) {
					await pc.addIceCandidate(new RTCIceCandidate(msg.payload))
				} else {
					// Queue candidate if remote description not set
					// We can reuse pendingSignals for this? No, handleSignal loop will re-trigger this.
					// We need a separate queue for ICE candidates that arrive *after* PC but *before* Offer?
					// Actually, standard WebRTC practice: buffer candidates until remote desc is set.
					// Let's implement internal buffer for ICE.
					// But wait, if we call addIceCandidate before setRemoteDescription, it fails.
					// So we need a small internal queue here.
					// OR, simpler: just push back to pendingSignals if !remoteDescription?
					// BUT pendingSignals is flushed only once.
					// So we need `pendingIce` logic back, BUT scoped to this function or instance?
					// Let's assume standard behavior:
					// If !remoteDescription, we store it.
					// But handleSignal is called.
					// Let's add it to a dedicated `earlyIce` queue?
					// Or just attach it to PC anyway? (Modern browsers buffer? No, they throw).
					// Re-implementing pendingIce logic inside here.

					// Re-using pendingSignals logic is risky if we loop.
					// Let's use a property on the PC or a closure variable.
					// We removed pendingIce variable. Let's restore it as `earlyIce`.
					;(pc as any)._earlyIce = (pc as any)._earlyIce || []
					if (!pc.remoteDescription) {
						;(pc as any)._earlyIce.push(msg.payload)
					} else {
						await pc.addIceCandidate(
							new RTCIceCandidate(msg.payload)
						)
					}
				}
			} catch (e) {
				console.error('RTC: ICE candidate error', e)
			}
		}

		// Flush early ICE if remote desc is set (checked after offer/answer handling)
		if (pc.remoteDescription && (pc as any)._earlyIce?.length) {
			console.log(
				`RTC: flushing ${(pc as any)._earlyIce.length} early ICE`
			)
			for (const c of (pc as any)._earlyIce) {
				await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
			}
			;(pc as any)._earlyIce = []
		}
	}

	signaler.on('message', (raw: string) => {
		let msg: any = null
		try {
			msg = JSON.parse(raw)
		} catch (e) {
			console.error('RTC: signal parse error', e)
		}
		if (!msg || typeof msg !== 'object') return
		handleSignal(msg)
	})

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
		const ov = overlay
		if (!ov || !localEl || !remoteEl) return
		if (minimized) {
			// Move to TOP to avoid collision with Bet UI at bottom
			ov.style.left = '0'
			ov.style.top = '0'
			ov.style.bottom = ''
			ov.style.transform = ''
			ov.style.width = '100%'
			ov.style.height = '140px'
			// Smaller videos in strip
			localEl.style.width = '180px'
			localEl.style.height = '120px'
			remoteEl.style.width = '180px'
			remoteEl.style.height = '120px'
		} else {
			ov.style.left = '50%'
			ov.style.top = '50%'
			ov.style.bottom = ''
			ov.style.transform = 'translate(-50%, -50%)'
			ov.style.width = '80vw'
			ov.style.height = '80vh'
			localEl.style.width = '48%'
			localEl.style.height = '100%'
			remoteEl.style.width = '48%'
			remoteEl.style.height = '100%'
		}
	}
	return { start, stop, toggleAudio, toggleVideo, minimize } as RTCController
}
