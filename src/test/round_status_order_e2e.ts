import { WebSocket } from 'ws'

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

function normalizeBase(u: string) {
	return u.replace(/\/+$/, '')
}

async function main() {
	const base =
		(process.env.TEST_BASE as string) ||
		'http://localhost:' + (process.env.PORT || '3001')
	const origin = normalizeBase(base)
	const wsUrl =
		(process.env.TEST_WS as string) ||
		(origin.startsWith('https')
			? origin.replace(/^https/, 'wss')
			: origin.replace(/^http/, 'ws')) + '/ws'
	await waitForHealth(`${origin}/health`)
	await fetch(`${origin}/players/reset`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
	})
	await new Promise<void>((resolve, reject) => {
		const wsA = new WebSocket(wsUrl)
		let wsB: WebSocket | null = null
		wsA.on('open', () => wsA.send(JSON.stringify({ type: 'join' })))
		wsA.on('message', (d: any) => {
			let msg: any = null
			try {
				msg = JSON.parse(String(d))
			} catch (_) {}
			if (!msg) return
			if (msg.type === 'assigned') {
				wsB = new WebSocket(wsUrl)
				wsB.on('open', () =>
					wsB?.send(JSON.stringify({ type: 'join' }))
				)
				wsB.on('message', (d2: any) => {
					let m: any = null
					try {
						m = JSON.parse(String(d2))
					} catch (_) {}
					if (!m) return
					if (m.type === 'assigned') {
						wsA?.send(JSON.stringify({ type: 'player:ready' }))
						wsB?.send(JSON.stringify({ type: 'player:ready' }))
					}
					if (m.type === 'match:proposal') {
						// Configure A with explicit slot indices
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'blue',
								number: 11,
								index: 0,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'yellow',
								number: 22,
								index: 1,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'orange',
								number: 33,
								index: 2,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'pink',
								number: 44,
								index: 3,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'green',
								number: 55,
								index: 4,
							})
						)
						// Configure B with explicit slot indices
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'green',
								number: 7,
								index: 0,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'pink',
								number: 17,
								index: 1,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'orange',
								number: 27,
								index: 2,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'yellow',
								number: 37,
								index: 3,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'blue',
								number: 47,
								index: 4,
							})
						)
						setTimeout(() => {
							wsA?.send(JSON.stringify({ type: 'match:accept' }))
							wsB?.send(JSON.stringify({ type: 'match:accept' }))
						}, 250)
					}
					if (m.type === 'match:start') {
						// Verify round/status returns same order
						;(async () => {
							try {
								await wait(300)
								const rs = await fetch(`${origin}/round/status`)
								if (!rs.ok) {
									reject(new Error('round status not ok'))
									return
								}
								const js = await rs.json()
								if (!js || !js.active) {
									reject(new Error('round not active'))
									return
								}
								const pa = (js?.players?.A as any) || null
								const pb = (js?.players?.B as any) || null
								const aNums = (
									Array.isArray(pa?.balls) ? pa.balls : []
								)
									.map((b: any) => Number(b.number))
									.join(',')
								const bNums = (
									Array.isArray(pb?.balls) ? pb.balls : []
								)
									.map((b: any) => Number(b.number))
									.join(',')
								console.log('round/status A order', aNums)
								console.log('round/status B order', bNums)
								if (aNums !== '11,22,33,44,55') {
									reject(
										new Error(
											'round/status players A order mismatch'
										)
									)
									return
								}
								if (bNums !== '7,17,27,37,47') {
									reject(
										new Error(
											'round/status players B order mismatch'
										)
									)
									return
								}
								resolve()
							} catch (e) {
								reject(e)
							}
						})()
					}
				})
				wsB.on('error', reject)
				wsB.on('close', () => {})
			}
		})
		wsA.on('error', reject)
		setTimeout(() => reject(new Error('round status order timeout')), 20000)
	})
	console.log('Round status order e2e passed')
}

main().catch(err => {
	console.error('Round status order e2e failed:', err)
	process.exit(1)
})
