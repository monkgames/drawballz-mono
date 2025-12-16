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
	const symActions: (
		| 'cancel'
		| 'swap'
		| 'cancel_left'
		| 'cancel_right'
		| 'randomize'
	)[] = []

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
			type: 'symmetric',
			leftIndices: symLeft,
			rightIndices: symRight,
			actions: symActions,
		})
	}

	// Phase 2: Symmetric Color Clash (Same Position, Same Color, Diff Number)
	// Logic: Cancel ball with HIGHER number
	const clashLeft: number[] = []
	const clashRight: number[] = []
	const clashActions: (
		| 'cancel'
		| 'swap'
		| 'cancel_left'
		| 'cancel_right'
		| 'randomize'
	)[] = []

	for (let i = 0; i < len; i++) {
		if (!leftActive[i] || !rightActive[i]) continue
		const l = leftBalls[i]
		const r = rightBalls[i]
		if (l.color === r.color) {
			// Numbers must be different (Phase 1 handled equality)
			clashLeft.push(i)
			clashRight.push(i)

			if (l.number > r.number) {
				clashActions.push('cancel_left')
				leftActive[i] = false
			} else {
				clashActions.push('cancel_right')
				rightActive[i] = false
			}
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

	// REMOVED Phase 3: General Color Cancel

	// Phase 4 (now 3): Symmetric Number Clash (Same Position, Same Number, Diff Color)
	// Logic: SWAP balls
	const randLeft: number[] = []
	const randRight: number[] = []
	const randActions: (
		| 'cancel'
		| 'swap'
		| 'cancel_left'
		| 'cancel_right'
		| 'randomize'
	)[] = []

	for (let i = 0; i < len; i++) {
		if (!leftActive[i] || !rightActive[i]) continue
		const l = leftBalls[i]
		const r = rightBalls[i]
		if (l.number === r.number) {
			// Colors must be different (Phase 1/2 handled same color)
			randLeft.push(i)
			randRight.push(i)
			randActions.push('swap')

			// Swap in memory
			const tmp = leftBalls[i]
			leftBalls[i] = rightBalls[i]
			rightBalls[i] = tmp
		}
	}

	if (randLeft.length > 0) {
		phases.push({
			type: 'number',
			leftIndices: randLeft,
			rightIndices: randRight,
			actions: randActions,
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
