import { evaluateBatchCompact } from '../engine'
import { CompactBatchRequest, EpochConfig, PlayerConfig } from '../types'

function mkEpoch(seed: string): EpochConfig {
	return {
		maskSizeDistribution: {
			0: 0.1,
			1: 0.2,
			2: 0.2,
			3: 0.2,
			4: 0.2,
			5: 0.1,
		},
		fixedPrizeTable: { 0: 0, 1: 10, 2: 20, 3: 50, 4: 200, 5: 1000 },
		seed,
		numberMin: 0,
		numberMax: 9,
		maxMaskSize: 5,
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

async function main() {
	const N = 5000
	const epoch = mkEpoch('prize-precision')
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
	const res = evaluateBatchCompact(req)
	const anyNonInteger = res.outcomes.some(o => !Number.isInteger(o.prize))
	if (anyNonInteger) {
		throw new Error(
			'Expected all outcome prizes to be integers with integer multipliers'
		)
	}
	// eslint-disable-next-line no-console
	console.log('OK: prize multipliers are enforced as integers (X suffix)')
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
