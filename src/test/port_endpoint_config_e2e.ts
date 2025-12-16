import { WebSocket } from 'ws'
import http from 'http'

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHealth(url: string, timeoutMs = 12000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url)
			if (res.ok) {
				const j = await res.json().catch(() => ({}))
				if ((j as any)?.ok) return true
			}
		} catch (_) {}
		await wait(300)
	}
	throw new Error('health timeout')
}

async function getText(url: string) {
	const res = await fetch(url)
	return res.text()
}

async function getJSON(url: string) {
	const res = await fetch(url)
	return res.json()
}

async function testWebSocketPair(url: string) {
	return new Promise<void>((resolve, reject) => {
		const ws1 = new WebSocket(url)
		let ws2: WebSocket | null = null
		let assigned1 = false
		let assigned2 = false
		let oppJoinedSeen = false
		let chatSeen = false
		const finish = () => {
			try {
				ws1.close()
			} catch (_) {}
			try {
				ws2?.close()
			} catch (_) {}
			resolve()
		}
		const fail = (err: any) => {
			try {
				ws1.close()
			} catch (_) {}
			try {
				ws2?.close()
			} catch (_) {}
			reject(err)
		}
		ws1.on('open', () => {
			ws1.send(JSON.stringify({ type: 'join' }))
		})
		ws1.on('message', (data: any) => {
			let msg: any = null
			try {
				msg = JSON.parse(String(data))
			} catch (_) {}
			if (!msg) return
			if (msg.type === 'assigned') {
				assigned1 = true
				ws2 = new WebSocket(url)
				ws2.on('open', () => {
					ws2?.send(JSON.stringify({ type: 'join' }))
				})
				ws2.on('message', (d: any) => {
					let m: any = null
					try {
						m = JSON.parse(String(d))
					} catch (_) {}
					if (!m) return
					if (m.type === 'assigned') assigned2 = true
					if (
						m.type === 'chat:message' &&
						String(m.text) === 'ping'
					) {
						chatSeen = true
					}
					if (assigned1 && assigned2 && oppJoinedSeen && chatSeen)
						finish()
				})
				ws2.on('error', fail)
			}
			if (msg.type === 'opponent_joined') {
				oppJoinedSeen = true
			}
			if (assigned1 && assigned2 && oppJoinedSeen && !chatSeen) {
				ws1.send(JSON.stringify({ type: 'chat:send', text: 'ping' }))
			}
			if (assigned1 && assigned2 && oppJoinedSeen && chatSeen) finish()
		})
		const onError = (err: any) => fail(err)
		ws1.on('error', onError)
		setTimeout(() => fail(new Error('ws pair timeout')), 15000)
	})
}

function normalizeBase(u: string) {
	return u.replace(/\/+$/, '')
}

async function main() {
	http.request
	const envPort = process.env.PORT || '3001'
	const base =
		(process.env.TEST_BASE as string) ||
		`http://localhost:${String(envPort)}`
	const origin = normalizeBase(base)
	const wsUrl =
		(process.env.TEST_WS as string) ||
		(origin.startsWith('https')
			? origin.replace(/^https/, 'wss')
			: origin.replace(/^http/, 'ws')) + '/ws'
	await waitForHealth(`${origin}/health`)
	const info = await getJSON(`${origin}/server/info`).catch(() => null)
	if (!info || !Number.isFinite(Number((info as any).pid))) {
		throw new Error('server info invalid')
	}
	const indexHTML = await getText(`${origin}/`)
	if (!indexHTML.toLowerCase().includes('<html')) {
		throw new Error('frontend index missing')
	}
	const rawA = await getJSON(`${origin}/player/A`)
	const rawB = await getJSON(`${origin}/player/B`)
	const toNum = (c: any): number =>
		typeof c === 'number'
			? c
			: String(c).toLowerCase() === 'green'
			? 1
			: String(c).toLowerCase() === 'pink'
			? 2
			: String(c).toLowerCase() === 'orange'
			? 3
			: String(c).toLowerCase() === 'yellow'
			? 4
			: 5
	function sanitizePlayer(p: any) {
		const byColor: Map<number, { number: number; color: number }> =
			new Map()
		const balls = Array.isArray(p?.balls) ? p.balls : []
		for (const b of balls) {
			const color = toNum((b as any)?.color)
			const number = Number((b as any)?.number) || 0
			if (color >= 1 && color <= 5 && number >= 0 && number <= 99) {
				byColor.set(color, { color, number })
			}
		}
		const outBalls = [1, 2, 3, 4, 5].map(c => {
			const v = byColor.get(c) || { color: c, number: c }
			return { color: v.color, number: v.number }
		})
		const betAmount =
			typeof p?.betAmount === 'number' && p.betAmount > 0
				? Math.floor(p.betAmount)
				: 100
		return { id: String(p?.id || 'X'), balls: outBalls, betAmount }
	}
	const playerA = sanitizePlayer(rawA)
	const playerB = sanitizePlayer(rawB)
	if (!playerA || !Array.isArray((playerA as any).balls)) {
		throw new Error('player A invalid')
	}
	if (!playerB || !Array.isArray((playerB as any).balls)) {
		throw new Error('player B invalid')
	}
	await testWebSocketPair(wsUrl)
	const prize = await getJSON(`${origin}/prize`)
	if (!prize || !(prize as any).table) {
		throw new Error('prize invalid')
	}
	const epoch = {
		maskSizeDistribution: { 5: 1 },
		fixedPrizeTable: (prize as any).table,
		seed: 'portcfg-' + Date.now(),
		numberMin: 0,
		numberMax: 99,
		maxMaskSize: 5,
	}
	const input = { epoch, playerA, playerB }
	const simRes = await fetch(`${origin}/simulate/match`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
	})
	const sim = await simRes.json()
	if (!sim || !Array.isArray((sim as any).winningMask)) {
		throw new Error('simulate match invalid')
	}
	console.log('Port and endpoint reconfiguration verified')
}

main().catch(err => {
	console.error('Port cfg e2e failed:', err)
	process.exit(1)
})
