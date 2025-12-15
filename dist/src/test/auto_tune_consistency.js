"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkEpoch(seed, table) {
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
    };
}
function mkPlayer(id) {
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
function rtp(seed, table, N, randomizePlayers, betMin = 1, betMax = 10, randomizeBet = true) {
    const req = {
        epoch: mkEpoch(seed, table),
        playerA: mkPlayer('A'),
        playerB: mkPlayer('B'),
        N,
        betMin,
        betMax,
        randomizeBet,
        sampleOutcomes: 0,
        randomizePlayers,
        offset: 0,
    };
    const res = (0, engine_1.evaluateBatchCompact)(req);
    return Number(res.metrics.rtp || 0);
}
function applyScale(table, scale) {
    return {
        0: Math.max(0, Math.round(table[0] * scale)),
        1: Math.max(0, Math.round(table[1] * scale)),
        2: Math.max(0, Math.round(table[2] * scale)),
        3: Math.max(0, Math.round(table[3] * scale)),
        4: Math.max(0, Math.round(table[4] * scale)),
        5: Math.max(0, Math.round(table[5] * scale)),
    };
}
async function calibrateStrict(targetPct) {
    const target = targetPct / 100;
    const N = 60000;
    let table = {
        0: 0,
        1: 10,
        2: 20,
        3: 50,
        4: 200,
        5: 1000,
    };
    const seed = 'auto-consistency';
    let current = rtp(seed, table, N, true);
    if (!(current > 0))
        throw new Error('RTP must be > 0 before tuning');
    for (let i = 0; i < 300; i++) {
        const diff = Math.abs(current - target);
        if (diff <= 0.01)
            break;
        let step = target / current;
        if (!Number.isFinite(step) || step <= 0)
            break;
        if (step > 1.01)
            step = 1.01;
        if (step < 0.99)
            step = 0.99;
        const nextTable = applyScale(table, step);
        const next = rtp(seed, nextTable, N, true);
        const jump = Math.abs(next - current);
        if (jump > 0.01) {
            throw new Error(`RTP jump exceeded ±1% (jump=${(jump * 100).toFixed(2)}%)`);
        }
        table = nextTable;
        current = next;
    }
    return { table, rtpAfter: current };
}
async function main() {
    const target = 95;
    const { table, rtpAfter } = await calibrateStrict(target);
    const N = 60000;
    const seed = 'auto-consistency';
    const rRnd = rtp(seed, table, N, true);
    const diffRnd = Math.abs(rRnd - rtpAfter) * 100;
    if (diffRnd > 1.0) {
        throw new Error(`Modal RTP deviates >±1% from batch (diff=${diffRnd.toFixed(2)}%)`);
    }
    console.log(`OK: auto-tune consistent; modal≈${(rRnd * 100).toFixed(2)}%`);
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
