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

async function getJSON(url: string) {
	const res = await fetch(url)
	return res.json()
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
		wsA.on('open', () => {
			wsA.send(JSON.stringify({ type: 'join' }))
		})
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
						// Frontend sends configuration updates for exact numbers/colors
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'green',
								number: 12,
								betAmount: 101,
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
								number: 32,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'yellow',
								number: 42,
							})
						)
						wsA?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'A',
								color: 'blue',
								number: 52,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'green',
								number: 12,
								betAmount: 121,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'pink',
								number: 23,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'orange',
								number: 32,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'yellow',
								number: 43,
							})
						)
						wsB?.send(
							JSON.stringify({
								type: 'config:update',
								playerId: 'B',
								color: 'blue',
								number: 54,
							})
						)
						setTimeout(() => resolve(), 400)
					}
				})
				wsB.on('error', reject)
			}
		})
		wsA.on('error', reject)
		setTimeout(() => reject(new Error('ws config sync timeout')), 15000)
	})

	const pA = await getJSON(`${origin}/player/A`)
	const pB = await getJSON(`${origin}/player/B`)
	const numsA = (pA?.balls || []).map((b: any) => Number(b.number))
	const numsB = (pB?.balls || []).map((b: any) => Number(b.number))
	if (numsA.join(',') !== '12,22,32,42,52') {
		throw new Error('server player A balls mismatch with frontend config')
	}
	if (numsB.join(',') !== '12,23,32,43,54') {
		throw new Error('server player B balls mismatch with frontend config')
	}

	const prize = await getJSON(`${origin}/prize`)
	const epoch = {
		maskSizeDistribution: { 5: 1 },
		fixedPrizeTable: (prize as any).table,
		seed: 'cfgsync-' + Date.now(),
		numberMin: 0,
		numberMax: 99,
		maxMaskSize: 5,
	}
	const input = { epoch, playerA: pA, playerB: pB }
	const simRes = await fetch(`${origin}/simulate/match`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
	})
	const sim = await simRes.json()
	if (!sim || !Array.isArray((sim as any).cancelled)) {
		throw new Error('simulate match invalid outcome')
	}
	const cancelled = (sim as any).cancelled as any[]
	// Expect cancellations for exact matches (green 12, orange 32)
	const hasGreen12 = cancelled.some(
		z => Number(z.color) === 1 && Number(z.number) === 12
	)
	const hasOrange32 = cancelled.some(
		z => Number(z.color) === 3 && Number(z.number) === 32
	)
	if (!hasGreen12 || !hasOrange32) {
		throw new Error(
			'cancellations not reflecting frontend-configured matches'
		)
	}
	console.log('Frontend config sync e2e passed')
}

main().catch(err => {
	console.error('Frontend config sync e2e failed:', err)
	process.exit(1)
})
