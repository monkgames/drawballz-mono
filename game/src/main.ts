import {
	Application,
	Container,
	Graphics,
	Sprite,
	Text,
	Texture,
	Assets,
} from 'pixi.js'
import { SocketClient } from '@/net/socket'
import { isMobileDevice, isSlowNetwork } from './util/env'
import {
	prefetchBGM,
	startBGMOnce,
	ensureAudioUnlocked,
	tryStartBGMNow,
	isAudioRunning,
	isBGMStarted,
	startBGMElement,
	stopBGMElement,
} from '@/audio/bgm'
import { createCutsceneScene } from '@/scene/splash'
import { createBattleScene } from '@/scene/battle'
import { createConfiguratorScene } from '@/scene/configurator'
;(function () {
	const noop = () => {}
	try {
		console.warn = noop
	} catch (_) {}
})()

const app = new Application()
let home: Container
let placeholder: Graphics | null = null
let socket: any = null
let playerId: 'A' | 'B' | null = null
let roomId: string | null = null
let displayName: string | null = null
let opponentName: string | null = null
let pendingReady: boolean = false
let battle: Container | null = null
let configurator: Container | null = null
const DEV_AUTO_BATTLE = false
const DEV_DEMO_CANCEL = false
let SERVER_BASE: string | null = null
let suppressConfigureUntil = 0
async function resolveServerBase(): Promise<string> {
	const env = (import.meta as any).env
	if (env?.VITE_API_URL) {
		return env.VITE_API_URL
	}
	const origin = window.location.origin
	try {
		const r = await fetch(`${origin}/health`, { method: 'GET' })
		if (r.ok) return origin
	} catch (_) {}
	const host = window.location.hostname || 'localhost'
	const scheme = 'http'
	const base3001 = `${scheme}://${host}:3001`
	try {
		const r = await fetch(`${base3001}/health`, { method: 'GET' })
		if (r.ok) return base3001
	} catch (_) {}
	return `http://localhost:3001`
}
let debugState: {
	playerId?: 'A' | 'B' | null
	roomId?: string | null
	A?: boolean
	B?: boolean
	opponentName?: string | null
	displayName?: string | null
	phase?: string
} = {}
let hud: Container | null = null
let hudPanel: Graphics | null = null
let hudText: Text | null = null
let walletUSD: number = 0
let dbg: Container | null = null
let dbgPanel: Graphics | null = null
let dbgText: Text | null = null

let matchPhase:
	| 'idle'
	| 'connected'
	| 'assigned'
	| 'ready'
	| 'matching'
	| 'proposal'
	| 'accept'
	| 'pending'
	| 'start'
	| 'cancelled'
	| 'declined' = 'idle'
let lastMatchEventAt = 0
let requestRetryTimer: any = null
let acceptRetryTimer: any = null
let startPollTimer: any = null
function clearRequestRetry() {
	try {
		if (requestRetryTimer) {
			clearInterval(requestRetryTimer)
			requestRetryTimer = null
		}
	} catch (_) {}
}
function clearAcceptRetry() {
	try {
		if (acceptRetryTimer) {
			clearInterval(acceptRetryTimer)
			acceptRetryTimer = null
		}
	} catch (_) {}
}
function clearStartPoll() {
	try {
		if (startPollTimer) {
			clearInterval(startPollTimer)
			startPollTimer = null
		}
	} catch (_) {}
}

async function getPlayerName(): Promise<string> {
	const stored = localStorage.getItem('playerName')
	if (stored && stored.trim()) {
		displayName = stored.trim()
		const overlay = document.getElementById(
			'nameOverlay'
		) as HTMLElement | null
		if (overlay) {
			overlay.classList.add('hidden')
			overlay.style.display = 'none'
		}
		return displayName
	}
	return await new Promise<string>(resolve => {
		const overlay = document.getElementById(
			'nameOverlay'
		) as HTMLElement | null
		const input = document.getElementById(
			'nameInput'
		) as HTMLInputElement | null
		const btn = document.getElementById(
			'nameSubmit'
		) as HTMLButtonElement | null
		const submit = () => {
			const val = (input?.value || '').trim()
			displayName = val.length >= 1 ? val : 'Player'
			localStorage.setItem('playerName', displayName)
			if (overlay) {
				overlay.classList.add('hidden')
				overlay.style.display = 'none'
			}
			console.log('Player name set:', displayName)
			resolve(displayName)
		}
		if (btn) {
			btn.addEventListener('click', submit)
		}
		if (input) {
			input.addEventListener('keydown', e => {
				if ((e as KeyboardEvent).key === 'Enter') submit()
			})
			// Force focus after a short delay to ensure visibility
			setTimeout(() => input.focus(), 100)
		}
	})
}

async function loadScene(name: 'home', w: number, h: number) {
	if (name === 'home') {
		const { createHomeScene } = await import('./scene/home')
		return await createHomeScene(w, h)
	}
	return new Container()
}
async function loadSplashTexture(name: string): Promise<Texture | null> {
	const candidates = [
		`/assets/bg/${name}.png`,
		`/bg/${name}.png`,
		`/assets/bg/${name}.webp`,
		`/bg/${name}.webp`,
	]
	for (const u of candidates) {
		try {
			const tex = await Assets.load(u)
			if (tex) return tex as Texture
		} catch (_) {}
	}
	return null
}

function ensureWallet() {
	const stored = localStorage.getItem('walletUSD')
	if (stored && !Number.isNaN(Number(stored))) {
		walletUSD = Math.max(0, Number(stored))
	} else {
		walletUSD = 1000
		localStorage.setItem('walletUSD', String(walletUSD))
	}
}

function formatUSD(n: number) {
	return `$${n.toFixed(2)}`
}

function createHUD(w: number, h: number) {
	if (!hud) hud = new Container()
	if (!hudPanel) hudPanel = new Graphics()
	if (!hudText)
		hudText = new Text({
			text: '',
			style: { fontFamily: 'system-ui', fontSize: 14, fill: 0xe6f7ff },
		})
	hud.removeChildren()
	hudPanel.clear()
	hudPanel.roundRect(0, 0, 220, 40, 10)
	hudPanel.fill({ color: 0x0a0f12, alpha: 0.85 })
	hudPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	hud.addChild(hudPanel)
	hudText.anchor = 0.5
	hudText.x = 110
	hudText.y = 20
	hud.addChild(hudText)
	updateHUD()
	const margin = 12
	hud.x = Math.round(w - 220 - margin)
	hud.y = Math.round(h - 40 - margin)
	if (!app.stage.children.includes(hud)) {
		app.stage.addChild(hud)
	} else {
		// ensure HUD is topmost
		try {
			app.stage.removeChild(hud)
		} catch (_) {}
		app.stage.addChild(hud)
	}
}

function updateHUD() {
	if (!hudText) return
	const name = displayName || 'Player'
	const bal = formatUSD(walletUSD)
	hudText.text = `${name} • ${bal}`
}

function createDebugPanel(w: number, h: number) {
	if (!dbg) dbg = new Container()
	if (!dbgPanel) dbgPanel = new Graphics()
	if (!dbgText)
		dbgText = new Text({
			text: '',
			style: { fontFamily: 'system-ui', fontSize: 13, fill: 0xe6f7ff },
		})
	dbg.removeChildren()
	const dbgW = 260
	const dbgH = 120
	dbgPanel.clear()
	dbgPanel.roundRect(0, 0, dbgW, dbgH, 12)
	dbgPanel.fill({ color: 0x0a0f12, alpha: 0.88 })
	dbgPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	dbg.addChild(dbgPanel)
	dbgText.x = 12
	dbgText.y = 10
	dbg.addChild(dbgText)
	dbg.x = 20
	dbg.y = Math.round(h - dbgH - 20)
	if (!app.stage.children.includes(dbg)) {
		app.stage.addChild(dbg)
	} else {
		try {
			app.stage.removeChild(dbg)
		} catch (_) {}
		app.stage.addChild(dbg)
	}
}

function updateDebugPanel(s: any) {
	if (!dbgText) return
	const lines = [
		`Room: ${s?.roomId || '-'}`,
		`Me: ${s?.displayName || '-'} (${s?.playerId || '-'})`,
		`Opponent: ${s?.opponentName || '-'}`,
		`Ready A:${s?.A ? 'Y' : 'N'} B:${s?.B ? 'Y' : 'N'}`,
		`Phase: ${s?.phase || '-'}`,
	]
	dbgText.text = lines.join('\n')
}
async function playQuickSplashes(w: number, h: number) {
	const root = new Container()
	const bg = new Graphics()
	bg.rect(0, 0, w, h)
	bg.fill({ color: 0x0e0e12 })
	root.addChild(bg)
	app.stage.addChild(root)
	const names = ['splash_mg', 'splash_ig5']
	for (const n of names) {
		const tex = await loadSplashTexture(n)
		if (!tex) continue
		const sprite = new Sprite({ texture: tex })
		sprite.anchor = 0.5
		sprite.x = Math.round(w / 2)
		sprite.y = Math.round(h / 2)
		const s = Math.max(w / tex.width, h / tex.height)
		sprite.scale.set(s)
		sprite.alpha = 0
		root.addChild(sprite)
		const { gsap } = await import('gsap')
		await new Promise<void>(resolve =>
			gsap.to(sprite, {
				alpha: 1,
				duration: 0.3,
				ease: 'power1.out',
				onComplete: resolve,
			})
		)
		await new Promise<void>(resolve => setTimeout(resolve, 700))
		await new Promise<void>(resolve =>
			gsap.to(sprite, {
				alpha: 0,
				duration: 0.25,
				ease: 'power1.in',
				onComplete: resolve,
			})
		)
		root.removeChild(sprite)
	}
	try {
		root.destroy({ children: true })
	} catch (_) {}
	app.stage.removeChild(root)
}

function pushFullConfig() {
	try {
		const key = 'configuredMap'
		let map: Record<string, number> = {}
		try {
			map = JSON.parse(localStorage.getItem(key) || '{}') || {}
		} catch (_) {}
		const betRaw = localStorage.getItem('betAmount') || ''
		const betAmount = Math.max(1, Math.floor(Number(betRaw) || 0))
		// Prefer persisted slot ordering to preserve UI-configured order
		let slotColors: string[] = []
		try {
			const raw = localStorage.getItem('slotColors') || ''
			const arr = JSON.parse(raw || '[]') || []
			if (Array.isArray(arr) && arr.length === 5) {
				slotColors = arr.map(c => String(c))
			}
		} catch (_) {}
		if (slotColors.length !== 5) {
			slotColors = ['green', 'pink', 'orange', 'yellow', 'blue']
		}
		for (let i = 0; i < slotColors.length; i++) {
			const color = slotColors[i]
			const num = Math.max(1, Math.floor(Number(map[color] || 0)))
			if (num <= 0) continue
			try {
				socket?.send({
					type: 'config:update',
					playerId: playerId || 'A',
					color,
					number: num,
					index: i,
					slotOrder: slotColors,
					betAmount,
				})
			} catch (_) {}
		}
	} catch (_) {}
}
async function loadUiLogoTexture(): Promise<Texture | null> {
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

async function layout() {
	const vw = window.innerWidth
	const vh = window.innerHeight
	const unit = Math.min(vw / 16, vh / 9)
	const canvasW = Math.floor(16 * unit)
	const canvasH = Math.floor(9 * unit)

	app.renderer.resize(canvasW, canvasH)
	app.canvas.style.width = `${canvasW}px`
	app.canvas.style.height = `${canvasH}px`
	app.canvas.style.position = 'fixed'
	app.canvas.style.left = '50%'
	app.canvas.style.top = '50%'
	app.canvas.style.transform = 'translate(-50%, -50%)'

	if (!placeholder) {
		placeholder = new Graphics()
	}
	placeholder.clear()
	placeholder.rect(0, 0, canvasW, canvasH)
	placeholder.fill({ color: 0x0e0e12 })
	if (!app.stage.children.includes(placeholder)) {
		app.stage.addChildAt(placeholder, 0)
	}
	try {
		home = await loadScene('home', canvasW, canvasH)
		app.stage.removeChild(placeholder)
		try {
			placeholder.destroy()
		} catch (_) {}
		placeholder = null
		app.stage.addChild(home)
		try {
			;(window as any).__home = home
			;(window as any).__app = app
			try {
				const key = 'configuredMap'
				const raw = localStorage.getItem(key) || '{}'
				const map = JSON.parse(raw || '{}') || {}
				console.log('LocalStorage/configuredMap on home load', map)
			} catch (_) {}
		} catch (_) {}
		home.on('requestMatchmaking', async () => {
			try {
				const proto =
					window.location.protocol === 'https:' ? 'wss' : 'ws'
				if (!SERVER_BASE) SERVER_BASE = await resolveServerBase()
				const url = SERVER_BASE.startsWith('https')
					? SERVER_BASE.replace(/^https/, 'wss') + '/ws'
					: SERVER_BASE.replace(/^http/, 'ws') + '/ws'
				const { SocketClient } = await import('@/net/socket')
				socket = new SocketClient(url)
				socket.on('open', () => {
					socket.send({ type: 'join' })
					home.emit('matchStatus', 'Connecting…')
					if (displayName) {
						socket.send({ type: 'name:set', name: displayName })
					}
					matchPhase = 'connected'
					lastMatchEventAt = Date.now()
					debugState.phase = 'connected'
					debugState.displayName = displayName
					home.emit('debugUpdate', { ...debugState })
					updateDebugPanel({ ...debugState })
				})
				socket.on('message', (raw: string) => {
					let msg: any = null
					try {
						msg = JSON.parse(raw)
					} catch (_) {}
					if (!msg || typeof msg !== 'object') return
					if (msg.type === 'assigned') {
						matchPhase = 'assigned'
						lastMatchEventAt = Date.now()
						clearRequestRetry()
						clearAcceptRetry()
						playerId = msg.playerId === 'A' ? 'A' : 'B'
						roomId = String(msg.roomId || '')
						home.emit(
							'matchStatus',
							`Joined as ${displayName || 'You'}`
						)
						if (pendingReady) {
							try {
								socket?.send({
									type: 'player:ready',
								})
							} catch (_) {}
						}
						// fallback: if 5/5 already configured, ensure ready is sent
						try {
							const mapRaw =
								localStorage.getItem('configuredMap') || '{}'
							const map = JSON.parse(mapRaw || '{}') || {}
							const cnt = Object.keys(map).length
							const betOk =
								Math.max(
									1,
									Math.floor(
										Number(
											localStorage.getItem('betAmount') ||
												0
										)
									)
								) > 0
							if (cnt >= 5 && betOk) {
								pendingReady = true
								socket?.send({ type: 'player:ready' })
								debugState.phase = 'ready'
								home.emit('debugUpdate', { ...debugState })
								updateDebugPanel({ ...debugState })
							}
						} catch (_) {}
						debugState.playerId = playerId
						debugState.roomId = roomId
						debugState.phase = 'assigned'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'opponent_joined') {
						home.emit(
							'matchStatus',
							opponentName
								? `Opponent joined: ${opponentName}`
								: 'Opponent joined'
						)
					}
					if (msg.type === 'name:ack') {
						const n = String(msg.name || '').trim()
						if (n) {
							displayName = n
							updateHUD()
							home.emit('matchStatus', `Joined as ${displayName}`)
							debugState.displayName = displayName
							home.emit('debugUpdate', { ...debugState })
							updateDebugPanel({ ...debugState })
						}
					}
					if (msg.type === 'opponent:name') {
						const n = String(msg.name || '').trim()
						if (n) {
							opponentName = n
							home.emit('opponentName', opponentName)
							debugState.opponentName = opponentName
							home.emit('debugUpdate', { ...debugState })
							updateDebugPanel({ ...debugState })
						}
					}
					if (msg.type === 'config:updated') {
						// no-op: could reflect opponent updates
					}
					if (msg.type === 'ready:update') {
						matchPhase = 'ready'
						lastMatchEventAt = Date.now()
						const A = !!msg.A
						const B = !!msg.B
						let rc = 0
						if (playerId === 'A') rc = B ? 1 : 0
						else if (playerId === 'B') rc = A ? 1 : 0
						else rc = A || B ? 1 : 0
						home.emit('readyCount', rc)
						debugState.A = A
						debugState.B = B
						debugState.phase = 'ready'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'ready:count') {
						const n = Number(msg.count) || 0
						home.emit('readyCount', Math.max(0, Math.floor(n)))
					}
					if (msg.type === 'match:start') {
						matchPhase = 'start'
						lastMatchEventAt = Date.now()
						clearRequestRetry()
						clearAcceptRetry()
						clearStartPoll()
						home.emit('matchStatus', 'Match starting')
						const w = app.renderer.width
						const h = app.renderer.height
						;(async () => {
							const betEl = document.getElementById(
								'betOverlay'
							) as HTMLElement | null
							if (betEl) {
								try {
									betEl.remove()
								} catch (_) {}
							}
							const toColor = (c: number) =>
								c === 1
									? 'green'
									: c === 2
									? 'pink'
									: c === 3
									? 'orange'
									: c === 4
									? 'yellow'
									: 'blue'
							const selfId = playerId || 'A'
							const oppId = selfId === 'A' ? 'B' : 'A'
							let selfBalls: { color: any; number: number }[] = []
							let oppBalls: { color: any; number: number }[] = []
							try {
								// Prefer live payload from match:start
								const liveA = (msg?.players?.A as any) || null
								const liveB = (msg?.players?.B as any) || null
								if (selfId === 'A') {
									if (liveA && Array.isArray(liveA.balls)) {
										selfBalls = liveA.balls.map(
											(b: any) => ({
												color: toColor(Number(b.color)),
												number: Number(b.number) || 0,
											})
										)
									}
									if (liveB && Array.isArray(liveB.balls)) {
										oppBalls = liveB.balls.map(
											(b: any) => ({
												color: toColor(Number(b.color)),
												number: Number(b.number) || 0,
											})
										)
									}
								} else {
									if (liveB && Array.isArray(liveB.balls)) {
										selfBalls = liveB.balls.map(
											(b: any) => ({
												color: toColor(Number(b.color)),
												number: Number(b.number) || 0,
											})
										)
									}
									if (liveA && Array.isArray(liveA.balls)) {
										oppBalls = liveA.balls.map(
											(b: any) => ({
												color: toColor(Number(b.color)),
												number: Number(b.number) || 0,
											})
										)
									}
								}
								try {
									console.log('Match/start (authoritative)', {
										roundId: String(msg?.roundId || ''),
										seed: String(msg?.seed || ''),
										multipliers:
											(msg?.multipliers as any) || null,
										players: {
											A: liveA || null,
											B: liveB || null,
										},
									})
								} catch (_) {}
								// No fallback fetch; use authoritative payload only
								// Server is the source of truth for ball configs
							} catch (_) {}
							const serverNow =
								Number(msg?.serverNowTs) || Date.now()
							const localOffset = Date.now() - serverNow
							const cancelStartLocal =
								(Number(msg?.cancelStartTs) ||
									Date.now() + 1000) + localOffset
							const uiStartLocal =
								(Number(msg?.uiCountdownStartTs) ||
									cancelStartLocal -
										(Number(msg?.countdownMs) || 5000)) +
								localOffset
							const scene = await createBattleScene(
								w,
								h,
								displayName || 'You',
								opponentName || 'Opponent',
								selfBalls,
								oppBalls,
								SERVER_BASE || window.location.origin,
								String(msg?.seed || ''),
								String(msg?.roundId || ''),
								cancelStartLocal,
								Number(msg?.countdownMs) || 5000,
								uiStartLocal,
								selfId,
								(msg?.multipliers as any) || undefined
							)
							if (home && app.stage.children.includes(home)) {
								app.stage.removeChild(home)
							}
							if (battle) {
								try {
									app.stage.removeChild(battle)
									battle.destroy({ children: true })
								} catch (_) {}
								battle = null
							}
							battle = scene
							app.stage.addChild(battle)
							try {
								;(window as any).__battle = battle
							} catch (_) {}
							try {
								const { createRTC } = await import('@/net/rtc')
								const rtc = createRTC(
									socket as any,
									(selfId as any) || 'A'
								)
								await rtc.start()
								;(battle as any).once?.(
									'battle:cleanup',
									() => {
										try {
											rtc.stop()
										} catch (_) {}
									}
								)
							} catch (_) {}
							;(battle as any).on('sendChat', (text: string) => {
								try {
									socket?.send({ type: 'chat:send', text })
								} catch (_) {}
							})
						})()
						debugState.phase = 'start'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'match:pending') {
						matchPhase = 'pending'
						lastMatchEventAt = Date.now()
						home.emit('matchStatus', 'Waiting for opponent ready')
						debugState.phase = 'pending'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'match:proposal') {
						matchPhase = 'proposal'
						lastMatchEventAt = Date.now()
						clearRequestRetry()
						const n = String(msg.opponentName || '').trim()
						const name = n || opponentName || 'Opponent'
						opponentName = name
						home.emit('matchProposal', name)
						pushFullConfig()
						debugState.phase = 'proposal'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'match:cancelled') {
						matchPhase = 'cancelled'
						lastMatchEventAt = Date.now()
						clearRequestRetry()
						clearAcceptRetry()
						clearStartPoll()
						home.emit('matchStatus', 'Matching cancelled')
						home.emit('hideMatching')
						try {
							;(battle as any)?.emit?.('battle:cleanup')
						} catch (_) {}
						debugState.phase = 'cancelled'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'match:declined') {
						matchPhase = 'declined'
						lastMatchEventAt = Date.now()
						clearRequestRetry()
						clearAcceptRetry()
						clearStartPoll()
						home.emit('matchStatus', 'Opponent declined')
						home.emit('hideMatching')
						try {
							;(battle as any)?.emit?.('battle:cleanup')
						} catch (_) {}
						debugState.phase = 'declined'
						home.emit('debugUpdate', { ...debugState })
						updateDebugPanel({ ...debugState })
					}
					if (msg.type === 'chat:message') {
						const from = String(msg.from || '').trim()
						const text = String(msg.text || '')
						const ts = Number(msg.ts) || Date.now()
						if (battle) {
							;(battle as any).emit('chatMessage', {
								from,
								text,
								ts,
							})
						} else if (configurator) {
							;(configurator as any).emit?.('chatMessage', {
								from,
								text,
								ts,
							})
						}
					}
				})
				socket.on('error', () => {
					home.emit('matchStatus', 'Connection error')
					debugState.phase = 'error'
					home.emit('debugUpdate', { ...debugState })
					updateDebugPanel({ ...debugState })
				})
				socket.connect()
			} catch (_) {
				home.emit('matchStatus', 'Failed to connect')
			}
		})
		// do NOT auto-start matchmaking on boot; wait for user action
		home.on('requestMatch', () => {
			try {
				if (!socket) {
					home.emit('requestMatchmaking')
					setTimeout(() => {
						try {
							pushFullConfig()
							socket?.send({ type: 'match:request' })
						} catch (_) {}
					}, 500)
				} else {
					pushFullConfig()
					socket?.send({ type: 'match:request' })
				}
				matchPhase = 'matching'
				lastMatchEventAt = Date.now()
				clearRequestRetry()
				requestRetryTimer = setInterval(() => {
					try {
						if (
							matchPhase === 'matching' &&
							Date.now() - lastMatchEventAt > 1000
						) {
							pushFullConfig()
							socket?.send({ type: 'match:request' })
							lastMatchEventAt = Date.now()
							console.log('Matching/retry request sent')
						} else if (
							matchPhase === 'proposal' ||
							matchPhase === 'start' ||
							matchPhase === 'cancelled' ||
							matchPhase === 'declined'
						) {
							clearRequestRetry()
						}
					} catch (_) {}
				}, 1200)
				debugState.phase = 'matching'
				home.emit('debugUpdate', { ...debugState })
				updateDebugPanel({ ...debugState })
			} catch (_) {
				home.emit('matchStatus', 'Failed to request match')
			}
		})
		home.on('betUpdated', () => {
			try {
				const key = 'configuredMap'
				let map: Record<string, number> = {}
				try {
					map = JSON.parse(localStorage.getItem(key) || '{}') || {}
				} catch (_) {}
				const count = Object.keys(map).length
				const betOk =
					Math.max(
						1,
						Math.floor(
							Number(localStorage.getItem('betAmount') || 0)
						)
					) > 0
				if (count >= 5 && betOk) {
					home.emit('readyStatus', true)
					socket?.send({
						type: 'player:ready',
						playerId: playerId || 'A',
					})
				} else {
					home.emit('readyStatus', false)
				}
			} catch (_) {}
		})
		home.on('readyStatus', (ready: boolean) => {
			try {
				if (ready) {
					pendingReady = true
					if (playerId) {
						socket?.send({
							type: 'player:ready',
						})
					}
					matchPhase = 'ready'
					lastMatchEventAt = Date.now()
					debugState.phase = 'ready'
					home.emit('debugUpdate', { ...debugState })
					updateDebugPanel({ ...debugState })
				}
			} catch (_) {}
		})
		home.on('proposalResponse', (ok: boolean) => {
			try {
				socket?.send({ type: ok ? 'match:accept' : 'match:decline' })
				matchPhase = ok ? 'accept' : 'declined'
				lastMatchEventAt = Date.now()
				clearAcceptRetry()
				clearStartPoll()
				if (ok) {
					// Start accept retry loop
					acceptRetryTimer = setInterval(() => {
						try {
							if (
								matchPhase === 'accept' &&
								Date.now() - lastMatchEventAt > 900
							) {
								socket?.send({ type: 'match:accept' })
								pushFullConfig()
								lastMatchEventAt = Date.now()
							} else if (
								matchPhase === 'start' ||
								matchPhase === 'cancelled' ||
								matchPhase === 'declined'
							) {
								clearAcceptRetry()
							}
						} catch (_) {}
					}, 1000)
					// Fallback: poll round/status and create battle if active
					startPollTimer = setInterval(async () => {
						try {
							if (
								matchPhase !== 'accept' &&
								matchPhase !== 'proposal' &&
								matchPhase !== 'ready'
							) {
								clearStartPoll()
								return
							}
							const base =
								SERVER_BASE || String(window.location.origin)
							const res = await fetch(`${base}/round/status`)
							if (!res.ok) return
							const js = await res
								.json()
								.catch(() => ({ ok: false }))
							if (!js || !js.active) return
							const w = app.renderer.width
							const h = app.renderer.height
							const toColor = (c: number) =>
								c === 1
									? 'green'
									: c === 2
									? 'pink'
									: c === 3
									? 'orange'
									: c === 4
									? 'yellow'
									: 'blue'
							const selfId = playerId || 'A'
							const liveA = (js?.players?.A as any) || null
							const liveB = (js?.players?.B as any) || null
							let selfBalls: { color: any; number: number }[] = []
							let oppBalls: { color: any; number: number }[] = []
							if (selfId === 'A') {
								if (liveA && Array.isArray(liveA.balls)) {
									selfBalls = liveA.balls.map((b: any) => ({
										color: toColor(Number(b.color)),
										number: Number(b.number) || 0,
									}))
								}
								if (liveB && Array.isArray(liveB.balls)) {
									oppBalls = liveB.balls.map((b: any) => ({
										color: toColor(Number(b.color)),
										number: Number(b.number) || 0,
									}))
								}
							} else {
								if (liveB && Array.isArray(liveB.balls)) {
									selfBalls = liveB.balls.map((b: any) => ({
										color: toColor(Number(b.color)),
										number: Number(b.number) || 0,
									}))
								}
								if (liveA && Array.isArray(liveA.balls)) {
									oppBalls = liveA.balls.map((b: any) => ({
										color: toColor(Number(b.color)),
										number: Number(b.number) || 0,
									}))
								}
							}
							const names = (js?.players?.names as any) || {}
							const oppName =
								selfId === 'A'
									? String(
											names?.B ||
												opponentName ||
												'Opponent'
									  )
									: String(
											names?.A ||
												opponentName ||
												'Opponent'
									  )
							const countdownMs = 5000
							const uiStart = Date.now() + 1200
							const cancelStart = uiStart + countdownMs
							const scene = await createBattleScene(
								w,
								h,
								displayName || 'You',
								oppName,
								selfBalls,
								oppBalls,
								SERVER_BASE || window.location.origin,
								String(js?.seed || ''),
								String(js?.id || ''),
								cancelStart,
								countdownMs,
								uiStart,
								(js?.multipliers as any) || undefined
							)
							if (home && app.stage.children.includes(home)) {
								app.stage.removeChild(home)
							}
							battle = scene
							app.stage.addChild(battle)
							try {
								;(window as any).__battle = battle
							} catch (_) {}
							clearStartPoll()
							clearAcceptRetry()
							clearRequestRetry()
							matchPhase = 'start'
							debugState.phase = 'start'
							home.emit('debugUpdate', { ...debugState })
							updateDebugPanel({ ...debugState })
						} catch (_) {}
					}, 900)
				}
				debugState.phase = ok ? 'accept' : 'decline'
				home.emit('debugUpdate', { ...debugState })
				updateDebugPanel({ ...debugState })
			} catch (_) {}
		})
		home.on('cancelMatching', () => {
			try {
				socket?.send({ type: 'match:cancel' })
				debugState.phase = 'cancel'
				home.emit('debugUpdate', { ...debugState })
				updateDebugPanel({ ...debugState })
			} catch (_) {}
		})
		home.on(
			'configureBall',
			async (color: string, index: number, usedColors: string[]) => {
				if (Date.now() < suppressConfigureUntil) return
				// derive availability from configured map only (colors with saved numbers)
				let map: Record<string, number> = {}
				try {
					map =
						JSON.parse(
							localStorage.getItem('configuredMap') || '{}'
						) || {}
				} catch (_) {}
				const configuredColors = Object.keys(map).filter(
					k => (Number(map[k]) || 0) > 0
				)
				try {
					console.log('Home/configureBall', {
						color,
						index,
						configuredColors,
						suppressMs: Math.max(
							0,
							suppressConfigureUntil - Date.now()
						),
					})
					console.log(
						'LocalStorage/configuredMap before configure',
						map
					)
				} catch (_) {}
				const scene = await createConfiguratorScene(
					canvasW,
					canvasH,
					color as any,
					(playerId || 'A') as any,
					configuredColors as any,
					Number(index) || 0,
					color as any
				)
				{
					const betEl = document.getElementById(
						'betOverlay'
					) as HTMLElement | null
					if (betEl) {
						try {
							betEl.remove()
						} catch (_) {}
					}
				}
				home.visible = false
				app.stage.addChild(scene)
				configurator = scene
				;(window as any).__configurator = scene
				scene.on('configuratorSave', (payload: any) => {
					try {
						console.log('Configurator/save received', payload)
						if (socket) {
							let slotOrder: string[] = []
							try {
								const raw =
									localStorage.getItem('slotColors') || ''
								const arr = JSON.parse(raw || '[]') || []
								if (Array.isArray(arr) && arr.length === 5) {
									slotOrder = arr.map(c => String(c))
								}
							} catch (_) {}
							const betRaw =
								localStorage.getItem('betAmount') || ''
							const betAmount = Math.max(
								1,
								Math.floor(Number(betRaw) || 0)
							)
							socket.send({
								type: 'config:update',
								...payload,
								slotOrder:
									slotOrder.length === 5
										? slotOrder
										: undefined,
								betAmount,
							})
						}
						const key = 'configuredMap'
						let map: Record<string, number> = {}
						try {
							map =
								JSON.parse(localStorage.getItem(key) || '{}') ||
								{}
						} catch (_) {}
						map[String(payload.color)] = Number(payload.number) || 0
						localStorage.setItem(key, JSON.stringify(map))
						try {
							console.log(
								'LocalStorage/configuredMap after save',
								map
							)
						} catch (_) {}
						const count = Object.keys(map).length
						const betOk =
							Math.max(
								1,
								Math.floor(
									Number(
										localStorage.getItem('betAmount') || 0
									)
								)
							) > 0
						if (count >= 5 && betOk) {
							home.emit('readyStatus', true)
							socket?.send({
								type: 'player:ready',
								playerId: playerId || 'A',
							})
						} else {
							home.emit('readyStatus', false)
						}
						home.emit(
							'updateBallSprite',
							index,
							String(payload.color)
						)
						console.log('Home/updateBallSprite emitted', {
							index,
							color: String(payload.color),
						})
						scene.emit('configuratorExit')
					} catch (_) {}
				})
				scene.once('configuratorExit', async () => {
					try {
						console.log('Configurator/exit begin')
						scene.visible = false
						scene.destroy({ children: true })
					} catch (_) {}
					app.stage.removeChild(scene)
					configurator = null
					try {
						delete (window as any).__configurator
					} catch (_) {}
					try {
						home.visible = true
						home.alpha = 1
						app.stage.removeChild(home)
						app.stage.addChild(home)
						home.emit('refreshConfigured')
						console.log('Home/shown after exit', {
							children: app.stage.children.length,
						})
						console.log(
							'Stage children after exit',
							app.stage.children.map(
								c => (c as any).constructor?.name || 'Container'
							)
						)
						try {
							const key = 'configuredMap'
							const raw = localStorage.getItem(key) || '{}'
							const map = JSON.parse(raw || '{}') || {}
							console.log(
								'LocalStorage/configuredMap on exit',
								map
							)
						} catch (_) {}
						home.eventMode = 'none'
						suppressConfigureUntil = Date.now() + 500
						setTimeout(() => {
							try {
								home.eventMode = 'static'
								console.log('Home/re-enabled interactions')
							} catch (_) {}
						}, 220)
					} catch (_) {}
				})
				;(scene as any).on?.('sendChat', (text: string) => {
					try {
						socket?.send({ type: 'chat:send', text })
					} catch (_) {}
				})
			}
		)
		createHUD(canvasW, canvasH)
		createDebugPanel(canvasW, canvasH)
	} catch (_) {
		// keep placeholder if home scene fails
	}
}
async function boot() {
	const lowEnd = isSlowNetwork() || isMobileDevice()
	const DPR = lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2)
	await app.init({
		antialias: lowEnd ? false : true,
		backgroundAlpha: 0,
		resolution: DPR,
	})
	document.body.appendChild(app.canvas)
	ensureWallet()
	await getPlayerName()
	const vw = window.innerWidth
	const vh = window.innerHeight
	const unit = Math.min(vw / 16, vh / 9)
	const canvasW = Math.floor(16 * unit)
	const canvasH = Math.floor(9 * unit)
	app.renderer.resize(canvasW, canvasH)
	app.canvas.style.width = `${canvasW}px`
	app.canvas.style.height = `${canvasH}px`
	app.canvas.style.position = 'fixed'
	app.canvas.style.left = '50%'
	app.canvas.style.top = '50%'
	app.canvas.style.transform = 'translate(-50%, -50%)'
	// Pre-add placeholder and start loading home to avoid a blank stage
	void layout()
	createHUD(canvasW, canvasH)
	createDebugPanel(canvasW, canvasH)
	await playQuickSplashes(canvasW, canvasH)
	{
		const muted = (localStorage.getItem('bgmMuted') || '') === '1'
		if (!muted) {
			void tryStartBGMNow()
			const retryStart = async () => {
				if (!isBGMStarted()) {
					await ensureAudioUnlocked()
					await startBGMOnce()
				}
			}
			setTimeout(() => void retryStart(), 800)
			setTimeout(() => void retryStart(), 3000)
			if (!isBGMStarted()) {
				void startBGMElement()
			}
			void prefetchBGM()
			const onFirstGesture = async () => {
				await ensureAudioUnlocked()
				await startBGMOnce()
				stopBGMElement()
			}
			document.addEventListener('pointerdown', onFirstGesture, {
				once: true,
			})
			document.addEventListener('keydown', onFirstGesture, { once: true })
		}
	}
	// background preload of heavier assets when network is decent
	if (!isSlowNetwork()) {
		const preload = [
			// avoid preloading heavy video on boot
			'/assets/bg/bg_base.webp',
			'/assets/bg/bg_layer.webp',
			'/assets/sprites/balls/green.svg',
			'/assets/sprites/balls/pink.svg',
			'/assets/sprites/balls/orange.svg',
			'/assets/sprites/balls/yellow.svg',
			'/assets/sprites/balls/blue.svg',
			'/assets/sprites/trails/green.svg',
			'/assets/sprites/trails/pink.svg',
			'/assets/sprites/trails/orange.svg',
			'/assets/sprites/trails/yellow.svg',
			'/assets/sprites/trails/blue.svg',
		]
		const idle = (fn: () => void) => {
			if ((window as any).requestIdleCallback) {
				;(window as any).requestIdleCallback(fn)
			} else {
				setTimeout(fn, 500)
			}
		}
		idle(
			() =>
				void Promise.allSettled(preload.map(u => Assets.load(u))).catch(
					() => {}
				)
		)
	}
	window.addEventListener('resize', () => {
		void layout()
	})
}
void boot()

export async function playCutscene(sources: string[]) {
	const w = app.renderer.width
	const h = app.renderer.height
	const scene = await createCutsceneScene(w, h, sources)
	if (home && app.stage.children.includes(home)) {
		app.stage.removeChild(home)
	}
	app.stage.addChild(scene)
	const onDone = () => {
		try {
			scene.destroy({ children: true })
		} catch (_) {}
		app.stage.removeChild(scene)
		if (home) app.stage.addChild(home)
	}
	scene.once('cutsceneCompleted', onDone)
}

const ENABLE_SOCKET = false
if (ENABLE_SOCKET) {
	const socket = new SocketClient('wss://echo.websocket.events')
	socket.connect()
	socket.on('open', () => socket.send({ hello: 'world' }))
	socket.on('error', () => {})
}
