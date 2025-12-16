"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkEpoch(seed) {
    return {
        maskSizeDistribution: {
            0: 0.05,
            1: 0.2,
            2: 0.3,
            3: 0.25,
            4: 0.15,
            5: 0.05,
        },
        fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
        seed,
        numberMin: 0,
        numberMax: 9,
        maxMaskSize: 5,
    };
}
function mkFixedPlayer(id) {
    return {
        id,
        balls: [
            { number: 0, color: 1 },
            { number: 1, color: 2 },
            { number: 2, color: 3 },
            { number: 3, color: 4 },
            { number: 4, color: 5 },
        ],
    };
}
function sumCounts(obj) {
    let s = 0;
    for (const k of [1, 2, 3, 4, 5])
        s += Number(obj[k] || 0);
    return s;
}
async function testRandomizationAndMetrics() {
    const N = 2000;
    const epoch = mkEpoch('rand-seed');
    const req = {
        epoch,
        playerA: mkFixedPlayer('A'),
        playerB: mkFixedPlayer('B'),
        N,
        betMin: 1,
        betMax: 10,
        randomizeBet: true,
        sampleOutcomes: N,
        randomizePlayers: true,
        offset: 0,
    };
    const result = (0, engine_1.evaluateBatchCompact)(req);
    if (result.metrics.count !== N) {
        throw new Error(`Count mismatch: expected ${N}, got ${result.metrics.count}`);
    }
    const totalPresence = sumCounts(result.metrics.colorPresence || {});
    const totalMaskFreq = sumCounts(result.metrics.maskColorFrequency || {});
    if (totalPresence <= 0) {
        throw new Error('Color presence should be > 0 with randomized players');
    }
    if (totalMaskFreq <= 0) {
        throw new Error('Mask color frequency should be > 0');
    }
    const cancelTotal = sumCounts(result.metrics.cancellationsPerColor || {});
    if (cancelTotal <= 0) {
        throw new Error('Cancellations should be > 0 across N runs');
    }
    const expectedAvgBet = (1 + 10) / 2;
    const expectedRevenue = expectedAvgBet * N;
    const actualRevenue = Number(result.metrics.totalBetRevenue || 0);
    const tol = expectedRevenue * 0.2; // 20% tolerance
    if (Math.abs(actualRevenue - expectedRevenue) > tol) {
        throw new Error(`Total bet revenue out of expected range: got ${actualRevenue}, expected ~${expectedRevenue}`);
    }
    // eslint-disable-next-line no-console
    console.log('OK: randomization produces non-zero color metrics and valid bet revenue');
}
async function testDifferentOffsetsProduceDifferentMetrics() {
    const N = 1500;
    const epoch = mkEpoch('rand-seed-2');
    const baseReq = {
        epoch,
        playerA: mkFixedPlayer('A'),
        playerB: mkFixedPlayer('B'),
        betMin: 1,
        betMax: 10,
        randomizeBet: true,
        sampleOutcomes: N,
        randomizePlayers: true,
    };
    const r0 = { ...baseReq, N, offset: 0 };
    const r1 = { ...baseReq, N, offset: N };
    const a = (0, engine_1.evaluateBatchCompact)(r0).metrics;
    const b = (0, engine_1.evaluateBatchCompact)(r1).metrics;
    const aKey = JSON.stringify({
        m: a.distributionM,
        freq: a.maskColorFrequency,
        pres: a.colorPresence,
        canc: a.cancellationsPerColor,
        rev: a.totalBetRevenue,
    });
    const bKey = JSON.stringify({
        m: b.distributionM,
        freq: b.maskColorFrequency,
        pres: b.colorPresence,
        canc: b.cancellationsPerColor,
        rev: b.totalBetRevenue,
    });
    if (aKey === bKey) {
        throw new Error('Metrics identical across different offsets; expected variation due to randomization');
    }
    // eslint-disable-next-line no-console
    console.log('OK: different offsets yield different aggregated metrics');
}
async function main() {
    await testRandomizationAndMetrics();
    await testDifferentOffsetsProduceDifferentMetrics();
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
