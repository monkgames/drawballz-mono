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

async function getJSON(url: string) {
	const res = await fetch(url)
	return res.json()
}

async function postJSON(url: string, body: any) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	return res.json()
}

function normalizeBase(u: string) {
	return u.replace(/\/+$/, '')
}

async function main() {
	http.request
	const base =
		(process.env.TEST_BASE as string) ||
		'http://localhost:' + (process.env.PORT || '3001')
	const origin = normalizeBase(base)
	await waitForHealth(`${origin}/health`)

	await postJSON(`${origin}/round/start`, {})

	await postJSON(`${origin}/player/A/ball`, {
		color: 'green',
		number: 10,
		betAmount: 100,
	})
	await postJSON(`${origin}/player/A/ball`, {
		color: 'pink',
		number: 20,
	})
	await postJSON(`${origin}/player/A/ball`, {
		color: 'orange',
		number: 30,
	})
	await postJSON(`${origin}/player/A/ball`, {
		color: 'yellow',
		number: 40,
	})
	await postJSON(`${origin}/player/A/ball`, {
		color: 'blue',
		number: 50,
	})
	await postJSON(`${origin}/player/B/ball`, {
		color: 'green',
		number: 10,
		betAmount: 120,
	})
	await postJSON(`${origin}/player/B/ball`, {
		color: 'pink',
		number: 21,
	})
	await postJSON(`${origin}/player/B/ball`, {
		color: 'orange',
		number: 30,
	})
	await postJSON(`${origin}/player/B/ball`, {
		color: 'yellow',
		number: 41,
	})
	await postJSON(`${origin}/player/B/ball`, {
		color: 'blue',
		number: 52,
	})

	const playerA = await getJSON(`${origin}/player/A`)
	const playerB = await getJSON(`${origin}/player/B`)
	if (
		!playerA ||
		!Array.isArray((playerA as any).balls) ||
		!playerB ||
		!Array.isArray((playerB as any).balls)
	) {
		throw new Error('players invalid after configuration')
	}
	const prize = await getJSON(`${origin}/prize`)
	const epoch = {
		maskSizeDistribution: { 5: 1 },
		fixedPrizeTable: (prize as any).table,
		seed: 'ballcfg-' + Date.now(),
		numberMin: 0,
		numberMax: 99,
		maxMaskSize: 5,
	}
	const input = { epoch, playerA, playerB }
	const sim = await postJSON(`${origin}/simulate/match`, input)
	if (
		!sim ||
		!Array.isArray((sim as any).remainingA) ||
		!Array.isArray((sim as any).remainingB) ||
		!Array.isArray((sim as any).cancelled)
	) {
		throw new Error('simulate match invalid outcome shape')
	}
	if ((sim as any).remainingA.length !== 3) {
		throw new Error('remainingA length mismatch (expected 3)')
	}
	if ((sim as any).remainingB.length !== 3) {
		throw new Error('remainingB length mismatch (expected 3)')
	}
	if ((sim as any).cancelled.length !== 2) {
		throw new Error('cancelled length mismatch (expected 2)')
	}
	const stackdata = (sim as any).stackdata || []
	if (!Array.isArray(stackdata) || stackdata.length !== 2) {
		throw new Error('stackdata invalid or unexpected length')
	}
	const rewardPool = (sim as any).rewardPool || null
	if (!rewardPool || rewardPool.type !== 'shared') {
		throw new Error('rewardPool type expected shared')
	}
	const combined = (rewardPool.combinedBalls || []) as any[]
	if (!Array.isArray(combined) || combined.length !== 6) {
		throw new Error('combinedBalls length mismatch (expected 6)')
	}
	const status = await getJSON(`${origin}/round/status`)
	if (
		!status ||
		!status.active ||
		!status.lastOutcome ||
		!Array.isArray((status.lastOutcome as any).stackdata)
	) {
		throw new Error('round status missing lastOutcome stackdata')
	}
	console.log('Ball config and stackdata e2e passed')
}

main().catch(err => {
	console.error('Ball config e2e failed:', err)
	process.exit(1)
})
