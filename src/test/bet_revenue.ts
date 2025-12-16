import { evaluateBatchCompact } from '../engine'
import { CompactBatchRequest, EpochConfig, PlayerConfig } from '../types'

function mkEpoch(seed: string): EpochConfig {
	return {
		maskSizeDistribution: {
			0: 0.0,
			1: 0.2,
			2: 0.25,
			3: 0.25,
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

function xorshift32(state: number): number {
	let x = state >>> 0
	x ^= x << 13
	x ^= x >>> 17
	x ^= x << 5
	return x >>> 0
}

function hashSeed(str: string): number {
	let h = 2166136261 >>> 0
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function rng(seedStr: string) {
	let s = hashSeed(seedStr)
	return () => {
		s = xorshift32(s)
		return (s >>> 0) / 4294967296
	}
}

async function main() {
	const N = 25000
	const betMin = 1
	const betMax = 10
	const epoch = mkEpoch('bet-revenue-seed')
	const req: CompactBatchRequest = {
		epoch,
		playerA: mkPlayer('A'),
		playerB: mkPlayer('B'),
		N,
		betMin,
		betMax,
		randomizeBet: true,
		sampleOutcomes: 0,
		randomizePlayers: false,
		offset: 0,
	}
	const res = evaluateBatchCompact(req)
	const span = Math.max(0, betMax - betMin)
	let expected = 0
	for (let i = 0; i < N; i++) {
		const idx = i
		const r = rng(epoch.seed + ':bet:' + idx)
		const a = betMin + Math.floor(r() * (span + 1))
		const b = betMin + Math.floor(r() * (span + 1))
		expected += (a + b) / 2
	}
	const actual = Number(res.metrics.totalBetRevenue || 0)
	if (Math.abs(actual - expected) > 0) {
		throw new Error(
			`Total bet revenue mismatch: expected=${expected} actual=${actual}`
		)
	}
	console.log('OK: totalBetRevenue equals sum of randomized bets across N')
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
