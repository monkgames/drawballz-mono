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
            { number: 66, color: 1 },
            { number: 22, color: 3 }, // same number as A but different color
            { number: 33, color: 4 }, // same number as A but different color
            { number: 77, color: 2 },
            { number: 88, color: 5 },
        ],
    };
    return { A, B };
}
function mkEpoch(seed, fairMode) {
    return {
        maskSizeDistribution: { 0: 0.0, 1: 0.3, 2: 0.3, 3: 0.4, 4: 0.0, 5: 0.0 },
        fixedPrizeTable: { 0: 0, 1: 0.2, 2: 0.8, 3: 2, 4: 10, 5: 50 },
        prizeMode: 'fixed',
        seed,
        numberMin: 1,
        numberMax: 99,
        fairMode,
        maxMaskSize: 3,
    };
}
async function main() {
    const { A, B } = mkPlayers();
    const inputFair = {
        epoch: mkEpoch('fair-seed', true),
        playerA: A,
        playerB: B,
        ticketPrice: 1,
    };
    const inputNonFair = {
        epoch: mkEpoch('nonfair-seed', false),
        playerA: A,
        playerB: B,
        ticketPrice: 1,
    };
    const outFair = (0, engine_1.evaluateMatch)(inputFair);
    const outNonFair = (0, engine_1.evaluateMatch)(inputNonFair);
    const remFair = outFair.remainingA.length + outFair.remainingB.length;
    const remNonFair = outNonFair.remainingA.length + outNonFair.remainingB.length;
    if (remFair < remNonFair) {
        throw new Error('Fair mode should not result in fewer remaining balls');
    }
    // eslint-disable-next-line no-console
    console.log('OK: Fair mode preserves more balls than non-fair mode');
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
