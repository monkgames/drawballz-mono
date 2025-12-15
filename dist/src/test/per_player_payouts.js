"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkEpoch(seed) {
    return {
        maskSizeDistribution: {
            0: 0.1,
            1: 0.2,
            2: 0.2,
            3: 0.2,
            4: 0.2,
            5: 0.1,
        },
        fixedPrizeTable: { 0: 0, 1: 3, 2: 6, 3: 15, 4: 60, 5: 300 },
        seed,
        numberMin: 0,
        numberMax: 9,
        maxMaskSize: 5,
    };
}
function mkPlayers() {
    return {
        A: {
            id: 'A',
            balls: [
                { number: 0, color: 1 },
                { number: 1, color: 2 },
                { number: 2, color: 3 },
                { number: 3, color: 4 },
                { number: 4, color: 5 },
            ],
            betAmount: 2,
        },
        B: {
            id: 'B',
            balls: [
                { number: 5, color: 1 },
                { number: 6, color: 2 },
                { number: 7, color: 3 },
                { number: 8, color: 4 },
                { number: 9, color: 5 },
            ],
            betAmount: 3,
        },
    };
}
function isBall(b) {
    return (b &&
        typeof b.number === 'number' &&
        typeof b.color === 'number' &&
        b.color >= 1 &&
        b.color <= 5);
}
function countMatches(mask, rem) {
    const set = new Set(rem.map(b => `${b.number}-${b.color}`));
    let k = 0;
    for (const w of mask) {
        if (set.has(`${w.number}-${w.color}`))
            k++;
    }
    return k;
}
async function main() {
    const epoch = mkEpoch('per-player-payouts');
    const { A, B } = mkPlayers();
    const N = 4000;
    const req = {
        epoch,
        playerA: A,
        playerB: B,
        N,
        betMin: 1,
        betMax: 1,
        randomizeBet: false,
        sampleOutcomes: N,
        randomizePlayers: false,
        offset: 0,
    };
    const res = (0, engine_1.evaluateBatchCompact)(req);
    let expected = 0;
    for (const o of res.outcomes) {
        const mA = countMatches(o.winningMask, o.remainingA);
        const mB = countMatches(o.winningMask, o.remainingB);
        const pA = (epoch.fixedPrizeTable[mA] ?? 0) * (A.betAmount ?? 1);
        const pB = (epoch.fixedPrizeTable[mB] ?? 0) * (B.betAmount ?? 1);
        expected += pA + pB;
    }
    const actual = Number(res.metrics.totalPrize || 0);
    if (Math.abs(actual - expected) > 0) {
        throw new Error(`Total prize mismatch with per-player payouts: expected=${expected} actual=${actual}`);
    }
    console.log('OK: totalPrize equals sum of per-player prizes across N');
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
