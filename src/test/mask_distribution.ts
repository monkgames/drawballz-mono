import { evaluateBatchCompact } from '../engine'
import { CompactBatchRequest, EpochConfig, PlayerConfig } from '../types'

function mkEpoch(
	seed: string,
	dist: Record<number, number>,
	cap: number
): EpochConfig {
	return {
		maskSizeDistribution: dist,
		fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
		seed,
		numberMin: 0,
		numberMax: 9,
		maxMaskSize: cap,
	}
}

function mkFixedPlayer(id: string): PlayerConfig {
	return {
		id,
		balls: [
			{ number: 0, color: 1 },
			{ number: 1, color: 2 },
			{ number: 2, color: 3 },
			{ number: 3, color: 4 },
			{ number: 4, color: 5 },
		],
	}
}

function countMaskSizes(
	outcomes: ReadonlyArray<{
		winningMask: ReadonlyArray<{ number: number; color: number }>
	}>
) {
	const dist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
	for (const o of outcomes) {
		const k = o.winningMask?.length ?? 0
		if (k >= 0 && k <= 5) dist[k] = (dist[k] ?? 0) + 1
	}
	return dist
}

async function testZeroBucketNoOccurrences() {
	const N = 10000
	// p1 = 0, others all weight on p2
	const epoch = mkEpoch(
		'mask-zero-bucket',
		{ 0: 0, 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
		5
	)
	const req: CompactBatchRequest = {
		epoch,
		playerA: mkFixedPlayer('A'),
		playerB: mkFixedPlayer('B'),
		N,
		betMin: 1,
		betMax: 1,
		randomizeBet: false,
		sampleOutcomes: N,
		randomizePlayers: true,
		offset: 0,
	}
	const result = evaluateBatchCompact(req)
	const maskDist = countMaskSizes(result.outcomes)
	if ((maskDist[1] ?? 0) !== 0) {
		throw new Error(
			`Expected zero masks of size 1 when p1=0, got ${maskDist[1]}`
		)
	}
	if ((maskDist[2] ?? 0) !== N) {
		throw new Error(
			`Expected all masks of size 2 when p2=1, got ${maskDist[2]} out of ${N}`
		)
	}
	// eslint-disable-next-line no-console
	console.log('OK: zero bucket produces no masks; single bucket produces all')
}

async function testP0YieldsSizeOneMasks() {
	const N = 8000
	const epoch = mkEpoch(
		'mask-p0-all',
		{ 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
		5
	)
	const req: CompactBatchRequest = {
		epoch,
		playerA: mkFixedPlayer('A'),
		playerB: mkFixedPlayer('B'),
		N,
		betMin: 1,
		betMax: 1,
		randomizeBet: false,
		sampleOutcomes: N,
		randomizePlayers: true,
		offset: 0,
	}
	const result = evaluateBatchCompact(req)
	const maskDist = countMaskSizes(result.outcomes)
	if ((maskDist[0] ?? 0) !== 0) {
		throw new Error(
			`Expected zero masks of size 0 due to non-empty enforcement, got ${maskDist[0]}`
		)
	}
	if ((maskDist[1] ?? 0) !== N) {
		throw new Error(
			`Expected all masks to be size 1 when p0=1 with non-empty enforcement, got ${maskDist[1]} out of ${N}`
		)
	}
	// eslint-disable-next-line no-console
	console.log('OK: p0=1 yields size-1 masks (non-empty enforcement)')
}

async function testCapRespected() {
	const N = 9000
	const epoch = mkEpoch(
		'mask-cap-3',
		{ 0: 0, 1: 0, 2: 0, 3: 0.3, 4: 0.4, 5: 0.3 },
		3
	)
	const req: CompactBatchRequest = {
		epoch,
		playerA: mkFixedPlayer('A'),
		playerB: mkFixedPlayer('B'),
		N,
		betMin: 1,
		betMax: 1,
		randomizeBet: false,
		sampleOutcomes: N,
		randomizePlayers: true,
		offset: 0,
	}
	const result = evaluateBatchCompact(req)
	const maskDist = countMaskSizes(result.outcomes)
	const overCap = (maskDist[4] ?? 0) + (maskDist[5] ?? 0)
	if (overCap !== 0) {
		throw new Error(`Expected no masks over cap=3; got ${overCap}`)
	}
	// eslint-disable-next-line no-console
	console.log('OK: mask cap respected (no sizes > cap)')
}

async function main() {
	await testZeroBucketNoOccurrences()
	await testP0YieldsSizeOneMasks()
	await testCapRespected()
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
