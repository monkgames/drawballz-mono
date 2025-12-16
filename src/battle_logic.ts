import { Ball, Color, BattlePhase, BattleResult } from './types'

function xorshift32(state: number) {
	state ^= state << 13
	state ^= state >>> 17
	state ^= state << 5
	return state >>> 0
}

function hashSeed(seed: string) {
	let h = 0x811c9dc5
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i)
		h = Math.imul(h, 0x01000193)
	}
	return h >>> 0
}

function createRng(seedStr: string) {
	let s = hashSeed(seedStr)
	if (s === 0) s = 1
	return () => {
		s = xorshift32(s)
		return (s >>> 0) / 4294967296
	}
}

export function simulateBattle(
	leftBalls: Ball[],
	rightBalls: Ball[],
	weights: Record<string, number>,
	seed?: string
): BattleResult {
	const rand = createRng(seed || String(Math.random()))

	// Work with indices to track what's removed
	const leftActive = leftBalls.map((_, i) => true)
	const rightActive = rightBalls.map((_, i) => true)
	const phases: BattlePhase[] = []
	const len = Math.min(leftBalls.length, rightBalls.length)

	// Phase 1: Symmetric (Same Position, Same Color, Same Number)
	const symLeft: number[] = []
	const symRight: number[] = []
	const symActions: ('cancel' | 'swap' | 'cancel_left' | 'cancel_right')[] =
		[]

	for (let i = 0; i < len; i++) {
		const l = leftBalls[i]
		const r = rightBalls[i]
		if (l.color === r.color && l.number === r.number) {
			symLeft.push(i)
			symRight.push(i)
			symActions.push('cancel')
			leftActive[i] = false
			rightActive[i] = false
		}
	}

	if (symLeft.length > 0) {
		phases.push({
			type: 'exact',
			leftIndices: symLeft,
			rightIndices: symRight,
			actions: symActions,
		})
	}

	// Phase 2: Color Swap (Same Position, Same Color, irrespective of number)
	// Logic: SWAP balls
	const clashLeft: number[] = []
	const clashRight: number[] = []
	const clashActions: ('cancel' | 'swap' | 'cancel_left' | 'cancel_right')[] =
		[]

	for (let i = 0; i < len; i++) {
		if (!leftActive[i] || !rightActive[i]) continue
		const l = leftBalls[i]
		const r = rightBalls[i]
		if (l.color === r.color) {
			// Numbers could be anything (though Phase 1 removed exact matches)
			clashLeft.push(i)
			clashRight.push(i)
			clashActions.push('swap')

			// Swap in memory
			const tmp = leftBalls[i]
			leftBalls[i] = rightBalls[i]
			rightBalls[i] = tmp
		}
	}

	if (clashLeft.length > 0) {
		phases.push({
			type: 'color',
			leftIndices: clashLeft,
			rightIndices: clashRight,
			actions: clashActions,
		})
	}

	// Phase 3: Number Cancel (Same Position, Same Number, irrespective of color)
	// Logic: Randomize numbers, then cancel highest
	const randLeft: number[] = []
	const randRight: number[] = []
	const randActions: (
		| 'cancel'
		| 'swap'
		| 'cancel_left'
		| 'cancel_right'
		| 'randomize'
	)[] = []
	const randValues: { left: number; right: number }[] = []

	for (let i = 0; i < len; i++) {
		if (!leftActive[i] || !rightActive[i]) continue
		const l = leftBalls[i]
		const r = rightBalls[i]
		if (l.number === r.number) {
			// Colors could be anything
			randLeft.push(i)
			randRight.push(i)
			randActions.push('randomize')

			let newL, newR
			do {
				newL = Math.floor(rand() * 10) // 0-9
				newR = Math.floor(rand() * 10) // 0-9
			} while (newL === newR)

			randValues.push({ left: newL, right: newR })

			// Update balls
			leftBalls[i].number = newL
			rightBalls[i].number = newR

			// Cancel highest
			if (newL > newR) {
				leftActive[i] = false
			} else {
				rightActive[i] = false
			}
		}
	}

	if (randLeft.length > 0) {
		phases.push({
			type: 'number',
			leftIndices: randLeft,
			rightIndices: randRight,
			actions: randActions,
			randomizedValues: randValues,
		})
	}

	// REMOVED Phase 5: General Number Cancel

	// Result
	const remainingLeftIndices = leftBalls
		.map((_, i) => i)
		.filter(i => leftActive[i])
	const remainingRightIndices = rightBalls
		.map((_, i) => i)
		.filter(i => rightActive[i])

	return {
		phases,
		remainingLeftIndices,
		remainingRightIndices,
	}
}

function getColorName(c: Color): string {
	switch (c) {
		case 1:
			return 'green'
		case 2:
			return 'pink'
		case 3:
			return 'orange'
		case 4:
			return 'yellow'
		case 5:
			return 'blue'
		default:
			return 'green'
	}
}
