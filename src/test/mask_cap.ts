import { evaluateMatch } from '../engine'
import { EpochConfig, MatchInput, PlayerConfig } from '../types'

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

function mkEpoch(seed: string, maxMaskSize: number): EpochConfig {
	return {
		maskSizeDistribution: {
			0: 0.0,
			1: 0.3,
			2: 0.3,
			3: 0.3,
			4: 0.1,
			5: 0.0,
		},
		fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
		seed,
		numberMin: 0,
		numberMax: 9,
		maxMaskSize,
	}
}

async function main() {
	const { A, B } = mkPlayers()
	for (const k of [0, 1, 2, 3, 4, 5]) {
		const input: MatchInput = {
			epoch: mkEpoch('cap-seed-' + k, k),
			playerA: A,
			playerB: B,
		}
		const out = evaluateMatch(input)
		const expectedCap = Math.max(1, k)
		if (out.winningMask.length < 1) {
			throw new Error(
				`Mask must be non-empty: cap=${k} length=${out.winningMask.length}`
			)
		}
		if (out.winningMask.length > expectedCap) {
			throw new Error(
				`Mask cap failed: cap=${expectedCap} length=${out.winningMask.length}`
			)
		}
	}
	// eslint-disable-next-line no-console
	console.log('OK: mask size respects cap for all k')
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
