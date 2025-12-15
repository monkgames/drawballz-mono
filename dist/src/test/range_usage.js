"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkPlayersInRange(min, max) {
    const A = {
        id: 'A',
        balls: [
            { number: min, color: 1 },
            { number: min + 1, color: 2 },
            { number: min + 2, color: 3 },
            { number: min + 3, color: 4 },
            { number: min + 4, color: 5 },
        ],
    };
    const B = {
        id: 'B',
        balls: [
            { number: max, color: 1 },
            { number: max - 1, color: 2 },
            { number: max - 2, color: 3 },
            { number: max - 3, color: 4 },
            { number: max - 4, color: 5 },
        ],
    };
    return { A, B };
}
function mkEpoch(seed, min, max) {
    return {
        maskSizeDistribution: {
            0: 0.0,
            1: 0.2,
            2: 0.2,
            3: 0.3,
            4: 0.2,
            5: 0.1,
        },
        fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
        seed,
        numberMin: min,
        numberMax: max,
        maxMaskSize: 5,
    };
}
async function main() {
    const min = 0;
    const max = 9;
    const { A, B } = mkPlayersInRange(min, max);
    const input = {
        epoch: mkEpoch('range-seed', min, max),
        playerA: A,
        playerB: B,
    };
    const out = (0, engine_1.evaluateMatch)(input);
    for (const b of out.remainingA) {
        if (b.number < min || b.number > max) {
            throw new Error(`RemainingA out of range: ${b.number}`);
        }
    }
    for (const b of out.remainingB) {
        if (b.number < min || b.number > max) {
            throw new Error(`RemainingB out of range: ${b.number}`);
        }
    }
    for (const w of out.winningMask) {
        if (w.number < min || w.number > max) {
            throw new Error(`WinningMask out of range: ${w.number}`);
        }
    }
    // eslint-disable-next-line no-console
    console.log('OK: number range respected in players and mask');
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
