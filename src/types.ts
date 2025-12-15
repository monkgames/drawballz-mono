export type Color = 1 | 2 | 3 | 4 | 5

export interface Ball {
	number: number
	color: Color
}

export interface PlayerConfig {
	id: string
	balls: ReadonlyArray<Ball>
	betAmount?: number
}

export interface EpochConfig {
	maskSizeDistribution: Record<number, number>
	fixedPrizeTable: Record<number, number>
	seed: string
	numberMin?: number
	numberMax?: number
	maxMaskSize?: number
}

export interface MatchInput {
	epoch: EpochConfig
	playerA: PlayerConfig
	playerB: PlayerConfig
	salt?: string
}

export interface Outcome {
	m: number
	prize: number
	winningMask: ReadonlyArray<Ball>
	remainingA: ReadonlyArray<Ball>
	remainingB: ReadonlyArray<Ball>
	cancelled: ReadonlyArray<Ball>
	eliminatedNumbers: ReadonlyArray<number>
}

export interface BatchRequest {
	matches: ReadonlyArray<MatchInput>
}

export interface CompactBatchRequest {
	epoch: EpochConfig
	playerA: PlayerConfig
	playerB: PlayerConfig
	N: number
	offset?: number
	betMin?: number
	betMax?: number
	randomizeBet?: boolean
	sampleOutcomes?: number
	randomizePlayers?: boolean
}

export interface BatchMetrics {
	count: number
	totalPrize: number
	totalBetRevenue: number
	payoutRatio: number
	rtp: number
	houseEdge: number
	bankProfit: number
	avgPrize: number
	avgM: number
	distributionM: Record<number, number>
	matchesPerColor: Record<Color, number>
	colorPresence: Record<Color, number>
	maskColorFrequency: Record<Color, number>
	cancellationsPerColor: Record<Color, number>
}

export interface BatchResult {
	outcomes: ReadonlyArray<Outcome>
	metrics: BatchMetrics
}
