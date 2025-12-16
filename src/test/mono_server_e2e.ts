import http from 'http'
import { WebSocket } from 'ws'

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHealth(url: string, timeoutMs = 10000) {
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
	throw new Error('Health check timed out')
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
		setTimeout(() => fail(new Error('WebSocket pair timed out')), 12000)
	})
}

async function main() {
	const child = http.request // placeholder to keep import active
	// assume dev server is already started via npm run dev
	const base = 'http://localhost:3001'
	const wsUrl = 'ws://localhost:3001/ws'
	await waitForHealth(`${base}/health`)
	const info = await getJSON(`${base}/server/info`).catch(() => null)
	if (!info || !Number.isFinite(Number((info as any).pid))) {
		throw new Error('Server info endpoint invalid or missing')
	}
	const indexHTML = await getText(`${base}/`)
	if (!indexHTML.toLowerCase().includes('<html')) {
		throw new Error('Frontend not serving HTML at /')
	}
	const viteClientOccurrences = (indexHTML.match(/\/@vite\/client/g) || [])
		.length
	if (viteClientOccurrences !== 1) {
		throw new Error('Duplicate or missing Vite client script tag')
	}
	const playerA = await getJSON(`${base}/player/A`)
	if (!playerA || !Array.isArray((playerA as any).balls)) {
		throw new Error('Player A API invalid')
	}
	await testWebSocketPair(wsUrl)
	const prize = await getJSON(`${base}/prize`)
	if (!prize || !prize.table) {
		throw new Error('Prize API invalid')
	}
	const epoch = {
		maskSizeDistribution: { 5: 1 },
		fixedPrizeTable: (prize as any).table,
		seed: 'e2e-' + Date.now(),
		numberMin: 0,
		numberMax: 99,
		maxMaskSize: 5,
	}
	const playerB = await getJSON(`${base}/player/B`)
	const input = {
		epoch,
		playerA,
		playerB,
	}
	const simRes = await fetch(`${base}/simulate/match`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
	})
	const sim = await simRes.json()
	if (!sim || !Array.isArray((sim as any).winningMask)) {
		throw new Error('Simulate match failed to return winningMask')
	}
	// eslint-disable-next-line no-console
	console.log('Mono server e2e tests passed')
}

main().catch(err => {
	// eslint-disable-next-line no-console
	console.error('Mono server e2e failed:', err)
	process.exit(1)
})
