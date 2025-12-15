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

function rtpForTable(
	seed: string,
	table: Record<number, number>,
	N: number,
	betMin = 1,
	betMax = 10
) {
	const req: CompactBatchRequest = {
		epoch: mkEpoch(seed, table),
		playerA: mkFixedPlayer('A'),
		playerB: mkFixedPlayer('B'),
		N,
		betMin,
		betMax,
		randomizeBet: true,
		sampleOutcomes: 0,
		randomizePlayers: true,
		offset: 0,
	}
	const res = evaluateBatchCompact(req)
	return Number(res.metrics.rtp || 0)
}

async function calibrate(targetPct: number) {
	const target = targetPct / 100
	const N = 12000
	let table: Record<number, number> = {
		0: 0,
		1: 10,
		2: 20,
		3: 50,
		4: 200,
		5: 1000,
	}
	const seed = 'auto-tune-rtp'
	let current = rtpForTable(seed, table, N)
	if (!(current > 0)) throw new Error('RTP must be > 0 before tuning')
	let fTable: Record<number, number> = { ...table }
	function intTable(): Record<number, number> {
		return {
			0: Math.max(0, Math.round(fTable[0])),
			1: Math.max(0, Math.round(fTable[1])),
			2: Math.max(0, Math.round(fTable[2])),
			3: Math.max(0, Math.round(fTable[3])),
			4: Math.max(0, Math.round(fTable[4])),
			5: Math.max(0, Math.round(fTable[5])),
		}
	}
	function applyScale(scale: number) {
		fTable = {
			0: fTable[0] * scale,
			1: fTable[1] * scale,
			2: fTable[2] * scale,
			3: fTable[3] * scale,
			4: fTable[4] * scale,
			5: fTable[5] * scale,
		}
	}
	let iterations = 0
	let after = current
	for (let i = 0; i < 500; i++) {
		const diff = Math.abs(after - target)
		if (diff <= 0.01) break
		let step = target / after
		if (!Number.isFinite(step) || step <= 0) break
		if (step > 1.01) step = 1.01
		if (step < 0.99) step = 0.99
		applyScale(step)
		const next = rtpForTable(seed, intTable(), N)
		after = next
		iterations++
	}
	table = intTable()
	return { after, iterations, table }
}

async function main() {
	const targets = [90, 95, 98]
	for (const t of targets) {
		const { after, iterations } = await calibrate(t)
		const err = Math.abs(after - t / 100)
		if (err > 0.01) {
			throw new Error(
				`Auto-tune failed to achieve target RTP=${t}% (err=${(
					err * 100
				).toFixed(2)}%, iterations=${iterations})`
			)
		}
		// eslint-disable-next-line no-console
		console.log(
			`OK: auto-tune achieved RTP≈${(after * 100).toFixed(
				2
			)}% for target ${t}% in ${iterations} iterations`
		)
	}
}

main().catch(e => {
	// eslint-disable-next-line no-console
	console.error(e)
	process.exit(1)
})
