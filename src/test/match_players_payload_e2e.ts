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
	await new Promise<void>((resolve, reject) => {
		const wsA = new WebSocket(wsUrl)
		let wsB: WebSocket | null = null
		let assignedA = false
		let assignedB = false
		let proposalA = false
		let proposalB = false
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
						proposalB = true
						// configure both players via ws
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'green',
								number: 9,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'pink',
								number: 19,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'orange',
								number: 29,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'yellow',
								number: 39,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'blue',
								number: 49,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'green',
								number: 7,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'pink',
								number: 17,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'orange',
								number: 27,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'yellow',
								number: 37,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'blue',
								number: 47,
							})
						)
						// wait for server to apply configs, verify via HTTP, then accept
						setTimeout(async () => {
							try {
								const pARes = await fetch(`${origin}/player/A`)
								const pBRes = await fetch(`${origin}/player/B`)
								const pA = await pARes.json()
								const pB = await pBRes.json()
								const aNums = (
									Array.isArray(pA?.balls) ? pA.balls : []
								)
									.map((b: any) => Number(b.number))
									.join(',')
								const bNums = (
									Array.isArray(pB?.balls) ? pB.balls : []
								)
									.map((b: any) => Number(b.number))
									.join(',')
								if (aNums !== '9,19,29,39,49') {
									reject(
										new Error(
											'server players A not updated before accept'
										)
									)
									return
								}
								if (bNums !== '7,17,27,37,47') {
									reject(
										new Error(
											'server players B not updated before accept'
										)
									)
									return
								}
								wsA?.send(
									JSON.stringify({ type: 'match:accept' })
								)
								wsB?.send(
									JSON.stringify({ type: 'match:accept' })
								)
							} catch (e) {
								reject(e)
							}
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
						if (aNums !== '9,19,29,39,49') {
							reject(new Error('payload players A mismatch'))
							return
						}
						if (bNums !== '7,17,27,37,47') {
							reject(new Error('payload players B mismatch'))
							return
						}
						resolve()
					}
				})
				wsB.on('error', reject)
				wsB.on('close', () => {})
			}
			if (msg.type === 'match:proposal') {
				proposalA = true
				// do not accept yet; wait for config sync verification
			}
		})
		wsA.on('error', reject)
		setTimeout(() => reject(new Error('players payload timeout')), 20000)
	})
	console.log('Match players payload e2e passed')
}

main().catch(err => {
	console.error('Match players payload e2e failed:', err)
	process.exit(1)
})
