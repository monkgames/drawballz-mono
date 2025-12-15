"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
function mkEpoch(seed) {
    return {
        maskSizeDistribution: { 0: 0.0, 1: 0.2, 2: 0.25, 3: 0.25, 4: 0.2, 5: 0.1 },
        fixedPrizeTable: { 0: 0, 1: 1, 2: 2, 3: 5, 4: 20, 5: 100 },
        seed,
        numberMin: 0,
        numberMax: 9,
        maxMaskSize: 5,
    };
}
function mkFixedPlayer(id, bet) {
    return {
        id,
        balls: [
            { number: 0, color: 1 },
            { number: 1, color: 2 },
            { number: 2, color: 3 },
            { number: 3, color: 4 },
            { number: 4, color: 5 },
        ],
        betAmount: bet,
    };
}
function countMaskSizesFromRows(rows) {
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) {
        const k = r.ms;
        if (k >= 0 && k <= 5)
            dist[k] = (dist[k] ?? 0) + 1;
    }
    return dist;
}
async function main() {
    const N = 6000;
    const epoch = mkEpoch('modal-mask-filter-consistency');
    const req = {
        epoch,
        playerA: mkFixedPlayer('A', 2),
        playerB: mkFixedPlayer('B', 3),
        N,
        betMin: 1,
        betMax: 1,
        randomizeBet: false,
        sampleOutcomes: N,
        randomizePlayers: true,
        offset: 0,
    };
    const res = (0, engine_1.evaluateBatchCompact)(req);
    const sampleRows = res.outcomes.map((o, i) => {
        const ms = Array.isArray(o.winningMask) ? o.winningMask.length : 0;
        const mA = Number(o.m); // matches total; per-player mA/mB not in compact outcome, but irrelevant here
        return {
            i: i + 1,
            ms,
            prize: Number(o.prize) || 0,
            mA,
        };
    });
    const distAll = countMaskSizesFromRows(sampleRows);
    for (const k of [0, 1, 2, 3, 4, 5]) {
        const filtered = sampleRows.filter(r => r.ms === k);
        const expected = distAll[k] ?? 0;
        const actual = filtered.length;
        if (expected !== actual) {
            throw new Error(`Mask size filter mismatch (wins-only OFF): ms=${k} expected=${expected} actual=${actual}`);
        }
    }
    const winsOnlyRows = sampleRows.filter(r => r.prize > 0);
    const distWins = countMaskSizesFromRows(winsOnlyRows);
    for (const k of [0, 1, 2, 3, 4, 5]) {
        const filtered = winsOnlyRows.filter(r => r.ms === k);
        const expected = distWins[k] ?? 0;
        const actual = filtered.length;
        if (expected !== actual) {
            throw new Error(`Mask size filter mismatch (wins-only ON): ms=${k} expected=${expected} actual=${actual}`);
        }
    }
    // eslint-disable-next-line no-console
    console.log('OK: mask size filter counts match distributions (wins-only OFF/ON)');
}
main().catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
