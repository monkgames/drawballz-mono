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
		let assignedA = false
		let assignedB = false
		wsA.on('open', () => wsA.send(JSON.stringify({ type: 'join' })))
		wsA.on('message', (d: any) => {
			let msg: any = null
			try {
				msg = JSON.parse(String(d))
			} catch (_) {}
			if (!msg) return
			if (msg.type === 'assigned') {
				assignedA = true
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
						assignedB = true
						wsA?.send(JSON.stringify({ type: 'player:ready' }))
						wsB?.send(JSON.stringify({ type: 'player:ready' }))
					}
					if (m.type === 'match:proposal') {
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'green',
								number: 11,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'pink',
								number: 22,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'orange',
								number: 33,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'yellow',
								number: 44,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'blue',
								number: 55,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'blue',
								number: 10,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'yellow',
								number: 20,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'orange',
								number: 30,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'pink',
								number: 40,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'green',
								number: 50,
							})
						)
						setTimeout(() => {
							wsA?.send(JSON.stringify({ type: 'match:accept' }))
							wsB?.send(JSON.stringify({ type: 'match:accept' }))
						}, 250)
					}
					if (m.type === 'match:start') {
						const pa = m?.players?.A
						const pb = m?.players?.B
						const aNums = (Array.isArray(pa?.balls) ? pa.balls : [])
							.map((b: any) => Number(b.number))
							.join(',')
						const bNums = (Array.isArray(pb?.balls) ? pb.balls : [])
							.map((b: any) => Number(b.number))
							.join(',')
						if (aNums !== '11,22,33,44,55') {
							reject(new Error('order players A mismatch'))
							return
						}
						if (bNums !== '50,40,30,20,10') {
							reject(new Error('order players B mismatch'))
							return
						}
						resolve()
					}
				})
				wsB.on('error', reject)
				wsB.on('close', () => {})
			}
		})
		wsA.on('error', reject)
		setTimeout(() => reject(new Error('players order timeout')), 20000)
	})
	console.log('Players order e2e passed')
}

main().catch(err => {
	console.error('Players order e2e failed:', err)
	process.exit(1)
})
