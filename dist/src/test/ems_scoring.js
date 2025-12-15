"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkPlayers() {
    const A = {
        id: 'A',
        balls: [
            { number: 11, color: 1 },
            { number: 22, color: 2 },
            { number: 33, color: 3 },
            { number: 44, color: 4 },
            { number: 55, color: 5 },
        ],
    };
    const B = {
        id: 'B',
        balls: [
            { number: 11, color: 1 }, // same as A (cancellation on same color)
            { number: 23, color: 2 },
            { number: 34, color: 3 },
            { number: 45, color: 4 },
            { number: 56, color: 5 },
        ],
    };
    return { A, B };
}
function mkEpoch(seed) {
    return {
        maskSizeDistribution: { 0: 0.0, 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.2, 5: 0.2 },
        fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
        prizeMode: 'multiplier',
        seed,
        numberMin: 1,
        numberMax: 99,
        fairMode: true,
        maxMaskSize: 5,
        useEMS: true,
        emsThresholds: [0.5, 1.5, 2.5, 3.5, 4.5],
        fixedPrizeTableTier: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
    };
}
function computeEMSRemVsMask(rem, wm) {
    function scoreForBall(b) {
        for (const w of wm) {
            if (b.number === w.number && b.color === w.color)
                return 1;
        }
        for (const w of wm) {
            if (b.number === w.number && b.color !== w.color)
                return 0.25;
        }
        for (const w of wm) {
            if (b.color === w.color && b.number !== w.number)
                return 0.25;
        }
        return 0;
    }
    let s = 0;
    for (const b of rem)
        s += scoreForBall(b);
    return s;
}
async function main() {
    const epoch = mkEpoch('ems-test-seed');
    const { A, B } = mkPlayers();
    const input = { epoch, playerA: A, playerB: B, ticketPrice: 1 };
    const out = (0, engine_1.evaluateMatch)(input);
    const remAll = [...out.remainingA, ...out.remainingB];
    const ems = computeEMSRemVsMask(remAll, out.winningMask);
    if (Math.abs(ems - Number(out.ems ?? 0)) > 1e-9) {
        throw new Error(`EMS mismatch: expected=${ems} got=${out.ems}`);
    }
    const thresholds = epoch.emsThresholds ?? [];
    let tier = 0;
    const sorted = [...thresholds].sort((a, b) => a - b);
    for (const t of sorted)
        if (ems >= t)
            tier++;
    if (tier !== Number(out.tier ?? 0)) {
        throw new Error(`Tier mismatch: expected=${tier} got=${out.tier}`);
    }
    const base = (epoch.fixedPrizeTableTier ?? {})[tier] ?? 0;
    const expectedPrize = base * (Number(input.ticketPrice ?? 1));
    if (Math.abs(expectedPrize - Number(out.prize)) > 1e-9) {
        throw new Error(`Prize mismatch: expected=${expectedPrize} got=${out.prize}`);
    }
    // eslint-disable-next-line no-console
    console.log('OK: EMS scoring consistent');
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
