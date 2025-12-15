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
	randomizePlayers: boolean
) {
	const req: CompactBatchRequest = {
		epoch: mkEpoch(seed, table),
		playerA: mkPlayer('A'),
		playerB: mkPlayer('B'),
		N,
		betMin: 1,
		betMax: 10,
		randomizeBet: true,
		sampleOutcomes: 0,
		randomizePlayers,
		offset: 0,
	}
	const res = evaluateBatchCompact(req)
	return Number(res.metrics.rtp || 0)
}

function clampStep(step: number) {
	if (step > 1.01) return 1.01
	if (step < 0.99) return 0.99
	return step
}

function scaleTable(
	table: Record<number, number>,
	step: number
): Record<number, number> {
	return {
		0: Math.max(0, Math.round(table[0] * step)),
		1: Math.max(0, Math.round(table[1] * step)),
		2: Math.max(0, Math.round(table[2] * step)),
		3: Math.max(0, Math.round(table[3] * step)),
		4: Math.max(0, Math.round(table[4] * step)),
		5: Math.max(0, Math.round(table[5] * step)),
	}
}

async function main() {
	const seed = 'step-bound'
	const N = 60000
	const base: Record<number, number> = {
		0: 0,
		1: 10,
		2: 20,
		3: 50,
		4: 200,
		5: 1000,
	}
	const before = measureRTP(seed, base, N, true)
	for (const requested of [1.2, 0.8, 1.05, 0.95]) {
		const step = clampStep(requested)
		const after = measureRTP(seed, scaleTable(base, step), N, true)
		const jump = Math.abs(after - before) * 100
		if (jump > 1.1) {
			throw new Error(
				`Step ${requested} caused RTP jump >±1.1% after clamp (jump=${jump.toFixed(
					2
				)}%)`
			)
		}
	}
	console.log('OK: per-step RTP change bounded within ±1% after clamp')
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
