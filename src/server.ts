import express from 'express'
import http from 'http'
import { evaluateBatch, evaluateBatchCompact, evaluateMatch } from './engine'
import {
	BatchRequest,
	CompactBatchRequest,
	MatchInput,
	PlayerConfig,
	Ball,
	Color,
	Outcome,
} from './types'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => {
	res.setHeader(
		'Cache-Control',
		'no-store, no-cache, must-revalidate, proxy-revalidate'
	)
	res.setHeader('Pragma', 'no-cache')
	res.setHeader('Expires', '0')
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	if (req.method === 'OPTIONS') {
		res.status(204).end()
		return
	}
	next()
})
app.use(
	express.static('public', {
		etag: false,
		lastModified: false,
		cacheControl: true,
		maxAge: 0,
	})
)

const colorMap: Record<string, Color> = {
	green: 1,
	pink: 2,
	orange: 3,
	yellow: 4,
	blue: 5,
}
const players: Record<string, PlayerConfig> = {
	A: {
		id: 'A',
		balls: [
			{ number: 1, color: 1 },
			{ number: 2, color: 2 },
			{ number: 3, color: 3 },
			{ number: 4, color: 4 },
			{ number: 5, color: 5 },
		],
		betAmount: 100,
	},
	B: {
		id: 'B',
		balls: [
			{ number: 6, color: 1 },
			{ number: 7, color: 2 },
			{ number: 8, color: 3 },
			{ number: 9, color: 4 },
			{ number: 10, color: 5 },
		],
		betAmount: 100,
	},
}

app.get('/health', (_req, res) => {
	res.json({ ok: true })
})

// Expose current prize multipliers for UI
app.get('/prize', (_req, res) => {
	try {
		// Fixed table representing current configured multipliers
		const table = { 0: 0, 1: 10, 2: 20, 3: 50, 4: 200, 5: 1000 }
		res.json({ table })
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.get('/player/:id', (req, res) => {
	try {
		const id = String(req.params.id || '').toUpperCase()
		const p = players[id]
		if (!p) {
			res.status(404).json({ error: 'player not found' })
			return
		}
		res.json(p)
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.post('/player/:id/ball', (req, res) => {
	try {
		const id = String(req.params.id || '').toUpperCase()
		const p = players[id]
		if (!p) {
			res.status(404).json({ error: 'player not found' })
			return
		}
		const body = req.body as {
			color: Color | string
			number: number
			betAmount?: number
		}
		let color: Color | null = null
		if (typeof body.color === 'number') {
			color = body.color as Color
		} else if (typeof body.color === 'string') {
			color = colorMap[body.color.toLowerCase()] || null
		}
		const number = Number(body.number)
		if (!color || !Number.isFinite(number) || number < 1 || number > 99) {
			res.status(400).json({ error: 'invalid ball payload' })
			return
		}
		const idx = p.balls.findIndex(b => b.color === color)
		const updated: Ball = { color, number }
		if (idx >= 0) {
			p.balls = [
				...p.balls.slice(0, idx),
				updated,
				...p.balls.slice(idx + 1),
			]
		} else {
			p.balls = [...p.balls, updated]
		}
		if (body.betAmount !== undefined) {
			const amt = Math.max(1, Math.floor(Number(body.betAmount)))
			p.betAmount = amt
		}
		players[id] = { ...p }
		res.json({ ok: true, player: players[id] })
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.post('/simulate/match', (req, res) => {
	try {
		const input = req.body as MatchInput
		const out = evaluateMatch(input)
		if (currentRound) {
			currentRound.lastOutcome = out
		}
		res.json(out)
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.post('/simulate/batch', (req, res) => {
	try {
		const body = req.body
		if (body && Array.isArray(body.matches)) {
			const input = body as BatchRequest
			const out = evaluateBatch(input)
			res.json(out)
			return
		}
		if (
			body &&
			body.epoch &&
			body.playerA &&
			body.playerB &&
			typeof body.N === 'number' &&
			body.N >= 1
		) {
			const input = body as CompactBatchRequest
			const out = evaluateBatchCompact(input)
			res.json(out)
			return
		}
		res.status(400).json({ error: 'invalid batch body' })
	} catch (e: any) {
		console.error('Batch error:', e)
		res.status(400).json({ error: String(e?.message ?? e) })
	}
})

const server = http.createServer(app)

let currentRound: {
	id: string
	seed: string
	startedAt: number
	lastOutcome?: Outcome
} | null = null

app.post('/round/start', (_req, res) => {
	try {
		const id = Math.random().toString(36).slice(2)
		const seed = 'round-' + Date.now() + '-' + id
		currentRound = { id, seed, startedAt: Date.now() }
		res.json({ ok: true, id, seed })
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.get('/round/status', (_req, res) => {
	try {
		if (!currentRound) {
			res.json({ ok: true, active: false })
			return
		}
		res.json({
			ok: true,
			active: true,
			id: currentRound.id,
			seed: currentRound.seed,
			startedAt: currentRound.startedAt,
			lastOutcome: currentRound.lastOutcome || null,
		})
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

let pendingSeat: { roomId: string; A?: any; B?: any } | null = null
type Client = {
	socket: any
	playerId: 'A' | 'B'
	roomId: string
	name?: string
	ready?: boolean
}
let clients: Set<Client> = new Set()
const readyStateByRoom: Record<string, { A?: boolean; B?: boolean }> = {}
const proposalAcceptedByRoom: Record<string, { A?: boolean; B?: boolean }> = {}
const matchRequestByRoom: Record<string, { A?: boolean; B?: boolean }> = {}
const proposalSentByRoom: Record<string, boolean> = {}
const globalReadyClients: Set<Client> = new Set()

try {
	const wsLib: any = require('ws')
	const wss = new wsLib.WebSocketServer({ server, path: '/ws' })
	wss.on('connection', (ws: any) => {
		let assigned: Client | null = null
		ws.on('message', (data: any) => {
			let msg: any = null
			try {
				msg = JSON.parse(String(data))
			} catch (_) {}
			if (!msg || typeof msg !== 'object') return
			if (msg.type === 'join') {
				if (!pendingSeat) {
					pendingSeat = {
						roomId: Math.random().toString(36).slice(2),
					}
				}
				const roomId = pendingSeat.roomId
				const playerId = pendingSeat.A ? 'B' : 'A'
				assigned = { socket: ws, playerId, roomId }
				clients.add(assigned)
				if (playerId === 'A') pendingSeat.A = assigned
				else pendingSeat.B = assigned
				ws.send(
					JSON.stringify({
						type: 'assigned',
						playerId,
						roomId,
					})
				)
				const other =
					playerId === 'A'
						? pendingSeat.B?.socket
						: pendingSeat.A?.socket
				other?.send(JSON.stringify({ type: 'opponent_joined' }))
				if (pendingSeat.A && pendingSeat.B) {
					// room is full; reset pending
					pendingSeat = null
				}
				return
			}
			if (msg.type === 'name:set') {
				const name = String(msg.name || '').slice(0, 24)
				if (!name) return
				if (assigned) assigned.name = name
				for (const c of clients) {
					if (c === assigned) {
						c.socket.send(
							JSON.stringify({ type: 'name:ack', name })
						)
					} else if (c.roomId === (assigned?.roomId || '')) {
						c.socket.send(
							JSON.stringify({
								type: 'opponent:name',
								name,
							})
						)
					}
				}
				return
			}
			if (msg.type === 'config:update') {
				const id = String(msg.playerId || '').toUpperCase()
				const color = msg.color
				const number = Number(msg.number)
				const betAmount = Number(msg.betAmount)
				if (!players[id]) return
				if (!color || !Number.isFinite(number)) return
				const idx = players[id].balls.findIndex(b => b.color === color)
				const updated = { color, number }
				if (idx >= 0) {
					players[id].balls = [
						...players[id].balls.slice(0, idx),
						updated,
						...players[id].balls.slice(idx + 1),
					]
				} else {
					players[id].balls = [...players[id].balls, updated as Ball]
				}
				if (Number.isFinite(betAmount) && betAmount >= 1) {
					players[id].betAmount = Math.floor(betAmount)
				}
				// broadcast to all in same room
				for (const c of clients) {
					if (c.roomId === (assigned?.roomId || '')) {
						c.socket.send(
							JSON.stringify({
								type: 'config:updated',
								playerId: id,
								player: players[id],
							})
						)
					}
				}
			}
			if (msg.type === 'player:ready') {
				const room = assigned?.roomId || ''
				if (!room) return
				const state = (readyStateByRoom[room] ||= {})
				if (assigned?.playerId === 'A') state.A = true
				if (assigned?.playerId === 'B') state.B = true
				if (assigned) {
					assigned.ready = true
					globalReadyClients.add(assigned)
				}
				for (const c of clients) {
					c.socket.send(
						JSON.stringify({
							type: 'ready:count',
							count: globalReadyClients.size,
						})
					)
				}
				// notify both clients
				for (const c of clients) {
					if (c.roomId === room) {
						c.socket.send(
							JSON.stringify({
								type: 'ready:update',
								A: !!state.A,
								B: !!state.B,
								readyCount:
									(state.A && state.B ? 1 : 0) +
									(!state.A && !state.B ? 0 : 0),
							})
						)
					}
				}
				// auto propose when both are ready
				if (state.A && state.B && !proposalSentByRoom[room]) {
					const A = [...clients].find(
						c => c.roomId === room && c.playerId === 'A'
					)
					const B = [...clients].find(
						c => c.roomId === room && c.playerId === 'B'
					)
					if (A && B) {
						proposalAcceptedByRoom[room] = { A: false, B: false }
						proposalSentByRoom[room] = true
						A.socket.send(
							JSON.stringify({
								type: 'match:proposal',
								opponentName: B.name || 'Opponent',
							})
						)
						B.socket.send(
							JSON.stringify({
								type: 'match:proposal',
								opponentName: A.name || 'Opponent',
							})
						)
					}
				}
				return
			}
			if (msg.type === 'match:request') {
				if (!assigned || !assigned.ready) return
				const candidates = [...globalReadyClients].filter(
					c => c !== assigned
				)
				if (candidates.length < 1) return
				const opp =
					candidates[Math.floor(Math.random() * candidates.length)]
				const room = Math.random().toString(36).slice(2)
				if (assigned) {
					assigned.roomId = room
					assigned.playerId = 'A'
				}
				if (opp) {
					opp.roomId = room
					opp.playerId = 'B'
				}
				proposalAcceptedByRoom[room] = { A: false, B: false }
				proposalSentByRoom[room] = true
				assigned.socket.send(
					JSON.stringify({
						type: 'assigned',
						playerId: 'A',
						roomId: room,
					})
				)
				opp.socket.send(
					JSON.stringify({
						type: 'assigned',
						playerId: 'B',
						roomId: room,
					})
				)
				assigned.socket.send(
					JSON.stringify({
						type: 'match:proposal',
						opponentName: opp.name || 'Opponent',
					})
				)
				opp.socket.send(
					JSON.stringify({
						type: 'match:proposal',
						opponentName: assigned.name || 'Opponent',
					})
				)
				return
			}
			if (msg.type === 'match:cancel') {
				const room = assigned?.roomId || ''
				if (!room) return
				const req = (matchRequestByRoom[room] ||= {
					A: false,
					B: false,
				})
				if (assigned?.playerId === 'A') req.A = false
				if (assigned?.playerId === 'B') req.B = false
				proposalAcceptedByRoom[room] = { A: false, B: false }
				for (const c of clients) {
					if (c.roomId === room) {
						c.socket.send(
							JSON.stringify({ type: 'match:cancelled' })
						)
					}
				}
				proposalSentByRoom[room] = false
				return
			}
			if (msg.type === 'match:accept' || msg.type === 'match:decline') {
				const room = assigned?.roomId || ''
				if (!room) return
				const state = (proposalAcceptedByRoom[room] ||= {
					A: false,
					B: false,
				})
				const accept = msg.type === 'match:accept'
				if (assigned?.playerId === 'A') state.A = accept
				if (assigned?.playerId === 'B') state.B = accept
				if (!accept) {
					// notify both of decline and reset
					for (const c of clients) {
						if (c.roomId === room) {
							c.socket.send(
								JSON.stringify({ type: 'match:declined' })
							)
						}
					}
					proposalAcceptedByRoom[room] = { A: false, B: false }
					proposalSentByRoom[room] = false
					return
				}
				if (state.A && state.B) {
					for (const c of clients) {
						if (c.roomId === room) {
							c.socket.send(
								JSON.stringify({ type: 'match:start' })
							)
						}
					}
					proposalAcceptedByRoom[room] = { A: false, B: false }
					proposalSentByRoom[room] = false
				}
				return
			}
			if (msg.type === 'chat:send') {
				const room = assigned?.roomId || ''
				if (!room) return
				const text = String(msg.text || '').slice(0, 240)
				if (!text.trim()) return
				const from = assigned?.name || 'Player'
				const payload = {
					type: 'chat:message',
					from,
					text,
					ts: Date.now(),
				}
				for (const c of clients) {
					if (c.roomId === room) {
						c.socket.send(JSON.stringify(payload))
					}
				}
				return
			}
		})
		ws.on('close', () => {
			if (assigned) {
				clients.delete(assigned)
				globalReadyClients.delete(assigned)
			}
		})
	})
} catch (e) {
	// eslint-disable-next-line no-console
	console.error('WebSocket init failed:', e)
}

const port = process.env.PORT ? Number(process.env.PORT) : 3001
server.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`Fresh server listening on http://localhost:${port}`)
})
