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
		await wait(250)
	}
	throw new Error('health timeout')
}

async function main() {
	const base =
		(process.env.TEST_BASE as string) ||
		'http://localhost:' + (process.env.PORT || '3001')
	const origin = base.replace(/\/+$/, '')
	const wsUrl =
		(process.env.TEST_WS as string) ||
		(origin.startsWith('https')
			? origin.replace(/^https/, 'wss')
			: origin.replace(/^http/, 'ws')) + '/ws'
	await waitForHealth(`${origin}/health`)
	const roundInfo: { seed?: string; id?: string } = {}
	const roundInfo2: { seed?: string; id?: string } = {}
	await new Promise<void>((resolve, reject) => {
		const ws1 = new WebSocket(wsUrl)
		let ws2: WebSocket | null = null
		let assigned1 = false
		let assigned2 = false
		let proposal1 = false
		let proposal2 = false
		ws1.on('open', () => {
			ws1.send(JSON.stringify({ type: 'join' }))
		})
		ws1.on('message', (d: any) => {
			let msg: any = null
			try {
				msg = JSON.parse(String(d))
			} catch (_) {}
			if (!msg) return
			if (msg.type === 'assigned') {
				assigned1 = true
				ws2 = new WebSocket(wsUrl)
				ws2.on('open', () =>
					ws2?.send(JSON.stringify({ type: 'join' }))
				)
				ws2.on('message', (d2: any) => {
					let m: any = null
					try {
						m = JSON.parse(String(d2))
					} catch (_) {}
					if (!m) return
					if (m.type === 'assigned') {
						assigned2 = true
						if (ws2 && ws2.readyState === WebSocket.OPEN) {
							ws2.send(JSON.stringify({ type: 'player:ready' }))
						}
					}
					if (m.type === 'match:proposal') {
						proposal2 = true
						if (ws2 && ws2.readyState === WebSocket.OPEN) {
							ws2.send(JSON.stringify({ type: 'match:accept' }))
						}
					}
					if (m.type === 'match:start') {
						roundInfo2.seed = String(m.seed || '')
						roundInfo2.id = String(m.roundId || '')
						if (roundInfo.seed && roundInfo2.seed) {
							resolve()
						}
					}
				})
				ws2.on('error', reject)
				ws2.on('close', () => {})
				if (ws1.readyState === WebSocket.OPEN) {
					ws1.send(JSON.stringify({ type: 'player:ready' }))
				}
			}
			if (msg.type === 'ready:update') {
				if (msg.A && msg.B) {
					if (ws1.readyState === WebSocket.OPEN) {
						ws1.send(JSON.stringify({ type: 'match:request' }))
					}
				}
			}
			if (msg.type === 'match:proposal') {
				proposal1 = true
				if (ws1.readyState === WebSocket.OPEN) {
					ws1.send(JSON.stringify({ type: 'match:accept' }))
				}
			}
			if (msg.type === 'match:start') {
				roundInfo.seed = String(msg.seed || '')
				roundInfo.id = String(msg.roundId || '')
				if (roundInfo.seed && roundInfo2.seed) {
					resolve()
				}
			}
		})
		ws1.on('error', reject)
		setTimeout(() => reject(new Error('round consistency timeout')), 15000)
	})
	if (!roundInfo.seed || !roundInfo2.seed) {
		throw new Error('missing round info on match:start')
	}
	if (roundInfo.seed !== roundInfo2.seed || roundInfo.id !== roundInfo2.id) {
		throw new Error('round mismatch between players')
	}
	// eslint-disable-next-line no-console
	console.log('Round consistency verified:', roundInfo.id, roundInfo.seed)
}

main().catch(err => {
	// eslint-disable-next-line no-console
	console.error('Round consistency e2e failed:', err)
	process.exit(1)
})
