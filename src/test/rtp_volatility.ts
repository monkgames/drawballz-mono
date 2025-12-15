import { evaluateBatchCompact } from '../engine'
import { CompactBatchRequest, EpochConfig, PlayerConfig } from '../types'

function mkEpoch(seed: string, table: Record<number, number>): EpochConfig {
	return {
		maskSizeDistribution: {
			0: 0.0,
			1: 0.2,
			2: 0.25,
			3: 0.25,
			4: 0.2,
			5: 0.1,
		},
		fixedPrizeTable: table,
		seed,
		numberMin: 0,
		numberMax: 9,
		maxMaskSize: 5,
	}
}

function mkPlayer(id: string): PlayerConfig {
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

function measureRTP(
	seed: string,
	table: Record<number, number>,
	N: number,
	betMin = 1,
	betMax = 1,
	randomizeBet = false
) {
	const req: CompactBatchRequest = {
		epoch: mkEpoch(seed, table),
		playerA: mkPlayer('A'),
		playerB: mkPlayer('B'),
		N,
		betMin,
		betMax,
		randomizeBet,
		sampleOutcomes: 0,
		randomizePlayers: false,
		offset: 0,
	}
	const res = evaluateBatchCompact(req)
	return Number(res.metrics.rtp || 0)
}

async function main() {
	const N = 120000
	const table: Record<number, number> = {
		0: 0,
		1: 10,
		2: 20,
		3: 50,
		4: 200,
		5: 1000,
	}
	const seeds = ['vol-A', 'vol-B', 'vol-C', 'vol-D']
	const r0 = measureRTP(seeds[0], table, N)
	for (const s of seeds.slice(1)) {
		const r = measureRTP(s, table, N)
		const diff = Math.abs(r - r0) * 100
		if (diff > 1.0) {
			throw new Error(
				`Seed volatility exceeded ±1% (diff=${diff.toFixed(2)}%)`
			)
		}
	}
	// eslint-disable-next-line no-console
	console.log('OK: RTP stable within ±1% across different seeds')

	const rRun1 = measureRTP('vol-run', table, N)
	const rRun2 = measureRTP('vol-run', table, N)
	const runDiff = Math.abs(rRun2 - rRun1) * 100
	if (runDiff > 1.0) {
		throw new Error(
			`Run-to-run volatility exceeded ±1% (diff=${runDiff.toFixed(2)}%)`
		)
	}
	// eslint-disable-next-line no-console
	console.log('OK: RTP stable within ±1% across repeated runs with same seed')
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
