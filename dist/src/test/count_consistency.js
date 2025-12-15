"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkEpoch(seed) {
    return {
        maskSizeDistribution: {
            0: 0.2,
            1: 0.2,
            2: 0.2,
            3: 0.2,
            4: 0.1,
            5: 0.1,
        },
        fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
        seed,
    };
}
function mkFixedPlayer(id) {
    return {
        id,
        balls: [
            { number: 11, color: 1 },
            { number: 22, color: 2 },
            { number: 33, color: 3 },
            { number: 44, color: 4 },
            { number: 55, color: 5 },
        ],
    };
}
function countFromOutcomes(outcomes) {
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const o of outcomes) {
        dist[o.m] = (dist[o.m] ?? 0) + 1;
    }
    return dist;
}
async function main() {
    const N = 2000;
    const epoch = mkEpoch('test-seed');
    const req = {
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
    };
    const result = (0, engine_1.evaluateBatchCompact)(req);
    const fromOutcomes = countFromOutcomes(result.outcomes);
    const fromMetrics = result.metrics.distributionM;
    let ok = true;
    for (const k of [0, 1, 2, 3, 4, 5]) {
        const a = fromOutcomes[k] ?? 0;
        const b = fromMetrics[k] ?? 0;
        if (a !== b)
            ok = false;
        // eslint-disable-next-line no-console
        console.log(`m${k}: outcomes=${a} metrics=${b}`);
    }
    if (!ok) {
        throw new Error('Distribution mismatch between outcomes and metrics');
    }
    // eslint-disable-next-line no-console
    console.log('OK: distributions match for all m');
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
