import { evaluateMatch, evaluateBatchCompact } from '../engine'
import {
	CompactBatchRequest,
	EpochConfig,
	MatchInput,
	PlayerConfig,
} from '../types'

function mkEpochNoCap(seed: string): EpochConfig {
	return {
		maskSizeDistribution: {
			0: 0.0,
			1: 0.2,
			2: 0.2,
			3: 0.2,
			4: 0.2,
			5: 0.2,
		},
		fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
		seed,
		numberMin: 0,
		numberMax: 9,
		// intentionally omit maxMaskSize to assert default behavior
	} as any
}

function mkPlayers(): { A: PlayerConfig; B: PlayerConfig } {
	const A: PlayerConfig = {
		id: 'A',
		balls: [
			{ number: 0, color: 1 },
			{ number: 1, color: 2 },
			{ number: 2, color: 3 },
			{ number: 3, color: 4 },
			{ number: 4, color: 5 },
		],
	}
	const B: PlayerConfig = {
		id: 'B',
		balls: [
			{ number: 5, color: 1 },
			{ number: 6, color: 2 },
			{ number: 7, color: 3 },
			{ number: 8, color: 4 },
			{ number: 9, color: 5 },
		],
	}
	return { A, B }
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

async function testEvaluateMatchDefaultCap5() {
	const { A, B } = mkPlayers()
	for (const seed of ['def-cap-a', 'def-cap-b', 'def-cap-c']) {
		const input: MatchInput = {
			epoch: mkEpochNoCap(seed),
			playerA: A,
			playerB: B,
		}
		const out = evaluateMatch(input)
		if (out.winningMask.length < 1) {
			throw new Error(
				`Default cap must still produce non-empty mask; got ${out.winningMask.length}`
			)
		}
		if (out.winningMask.length > 5) {
			throw new Error(
				`Default cap failed: expected ≤5, got ${out.winningMask.length}`
			)
		}
	}
	// eslint-disable-next-line no-console
	console.log('OK: evaluateMatch respects default maxMaskSize=5 when omitted')
}

async function testEvaluateBatchDefaultCap5() {
	const N = 8000
	const req: CompactBatchRequest = {
		epoch: mkEpochNoCap('def-batch'),
		playerA: mkPlayers().A,
		playerB: mkPlayers().B,
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
	const overCap = (maskDist[6] ?? 0) + (maskDist[7] ?? 0)
	if (overCap !== 0) {
		throw new Error(`Default cap failed in batch: observed masks over 5`)
	}
	if ((maskDist[0] ?? 0) !== 0) {
		throw new Error(
			`Masks must be non-empty even with default cap; saw size-0=${maskDist[0]}`
		)
	}
	// eslint-disable-next-line no-console
	console.log(
		'OK: evaluateBatchCompact respects default maxMaskSize=5 when omitted'
	)
}

async function main() {
	await testEvaluateMatchDefaultCap5()
	await testEvaluateBatchDefaultCap5()
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
