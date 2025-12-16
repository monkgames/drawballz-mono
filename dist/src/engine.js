"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateMatch = evaluateMatch;
exports.evaluateBatch = evaluateBatch;
exports.evaluateBatchCompact = evaluateBatchCompact;
const battle_logic_1 = require("./battle_logic");
function validatePlayerBalls(balls, numMin, numMax) {
    const issues = [];
    if (balls.length !== 5)
        issues.push('player must have exactly 5 balls');
    const colorSet = new Set();
    for (const b of balls) {
        if (b.number < numMin || b.number > numMax)
            issues.push(`invalid number ${b.number}`);
        if (b.color < 1 || b.color > 5)
            issues.push(`invalid color ${b.color}`);
        if (colorSet.has(b.color))
            issues.push(`duplicate color ${b.color}`);
        colorSet.add(b.color);
    }
    return issues;
}
function hashSeed(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}
function xorshift32(state) {
    let x = state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
}
function rng(seedStr) {
    let s = hashSeed(seedStr);
    return () => {
        s = xorshift32(s);
        return (s >>> 0) / 4294967296;
    };
}
function sampleK(dist, r) {
    const keys = [0, 1, 2, 3, 4, 5];
    let acc = 0;
    const x = r();
    for (const k of keys) {
        const p = dist[k] ?? 0;
        acc += p;
        if (x <= acc)
            return k;
    }
    return 0;
}
function sampleMask(seedStr, dist, numMin, numMax, maxMaskSize) {
    const r = rng(seedStr);
    const k = sampleK(dist, r);
    const cap = Math.max(0, Math.min(5, Math.floor(maxMaskSize)));
    let kClamped = Math.min(k, cap);
    if (kClamped < 1)
        kClamped = 1;
    const colors = [1, 2, 3, 4, 5];
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const tmp = colors[i];
        colors[i] = colors[j];
        colors[j] = tmp;
    }
    const chosen = colors.slice(0, kClamped);
    const mask = [];
    for (const c of chosen) {
        const span = Math.max(0, numMax - numMin + 1);
        const num = numMin + Math.floor(r() * span);
        mask.push({ number: num, color: c });
    }
    return mask;
}
function randomPlayerFromSeed(id, seedStr, numMin, numMax) {
    const r = rng(seedStr);
    const balls = [];
    for (let c = 1; c <= 5; c = (c + 1)) {
        const span = Math.max(0, numMax - numMin + 1);
        const num = numMin + Math.floor(r() * span);
        balls.push({ number: num, color: c });
    }
    return { id, balls };
}
function evaluateMatch(input) {
    const epoch = input.epoch;
    const numMin = typeof epoch.numberMin === 'number' ? epoch.numberMin : 0;
    const numMax = typeof epoch.numberMax === 'number' ? epoch.numberMax : 9;
    const maskCap = typeof epoch.maxMaskSize === 'number'
        ? Math.floor(epoch.maxMaskSize)
        : 5;
    const issues = [
        ...validatePlayerBalls(input.playerA.balls, numMin, numMax),
        ...validatePlayerBalls(input.playerB.balls, numMin, numMax),
    ];
    if (issues.length) {
        throw new Error(issues.join('; '));
    }
    const colorWeights = {
        green: 10,
        pink: 20,
        orange: 30,
        yellow: 40,
        blue: 50,
    };
    const leftBalls = [...input.playerA.balls];
    const rightBalls = [...input.playerB.balls];
    const battleRes = (0, battle_logic_1.simulateBattle)(leftBalls, rightBalls, colorWeights, epoch.seed + ':' + (input.salt || ''));
    const ra = [];
    for (const i of battleRes.remainingLeftIndices)
        ra.push(leftBalls[i]);
    const rb = [];
    for (const i of battleRes.remainingRightIndices)
        rb.push(rightBalls[i]);
    const cancelled = [];
    const stackdata = [];
    let step = 1;
    for (const phase of battleRes.phases) {
        const phaseCancelled = [];
        for (let k = 0; k < phase.leftIndices.length; k++) {
            const lIdx = phase.leftIndices[k];
            const rIdx = phase.rightIndices[k];
            const action = phase.actions?.[k] || 'cancel';
            if (action === 'cancel' || action === 'cancel_left') {
                phaseCancelled.push(leftBalls[lIdx]);
            }
            if (action === 'cancel' || action === 'cancel_right') {
                phaseCancelled.push(rightBalls[rIdx]);
            }
        }
        if (phaseCancelled.length > 0) {
            stackdata.push({ step: step++, cancelled: phaseCancelled });
            cancelled.push(...phaseCancelled);
        }
    }
    const eliminatedNumbers = [];
    function sumNums(arr) {
        let s = 0;
        for (const b of arr)
            s += b.number;
        return s;
    }
    // Fair behavior: do not eliminate additional numbers beyond cancellations
    const rAll = [...ra, ...rb];
    const salt = input.salt ? String(input.salt) : '';
    const maskSeed = epoch.seed +
        ':' +
        salt +
        ':' +
        JSON.stringify(rAll.map(b => [b.number, b.color]));
    const winningMask = sampleMask(maskSeed, epoch.maskSizeDistribution, numMin, numMax, maskCap);
    const setRA = new Set(ra.map(b => `${b.number}-${b.color}`));
    const setRB = new Set(rb.map(b => `${b.number}-${b.color}`));
    let mA = 0;
    let mB = 0;
    for (const w of winningMask) {
        if (setRA.has(`${w.number}-${w.color}`))
            mA++;
        if (setRB.has(`${w.number}-${w.color}`))
            mB++;
    }
    const m = mA + mB;
    const basePrizeA = epoch.fixedPrizeTable[mA] ?? 0;
    const basePrizeB = epoch.fixedPrizeTable[mB] ?? 0;
    const betA = typeof input.playerA.betAmount === 'number' &&
        input.playerA.betAmount > 0
        ? input.playerA.betAmount
        : 1;
    const betB = typeof input.playerB.betAmount === 'number' &&
        input.playerB.betAmount > 0
        ? input.playerB.betAmount
        : 1;
    const prizeA = basePrizeA * betA;
    const prizeB = basePrizeB * betB;
    const prize = prizeA + prizeB;
    const rewardPool = ra.length > 0 && rb.length > 0
        ? {
            type: 'shared',
            combinedBalls: [...ra, ...rb],
        }
        : {
            type: 'individual',
            byPlayer: { A: ra, B: rb },
        };
    return {
        m,
        prize,
        winningMask,
        remainingA: ra,
        remainingB: rb,
        cancelled,
        eliminatedNumbers,
        stackdata,
        rewardPool,
        phases: battleRes.phases,
    };
}
function evaluateBatch(req) {
    const outcomes = [];
    let totalPrize = 0;
    let totalM = 0;
    const distributionM = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const matchesPerColor = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const colorPresence = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const maskColorFrequency = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const cancellationsPerColor = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    for (const mInput of req.matches) {
        const out = evaluateMatch(mInput);
        outcomes.push(out);
        totalPrize += out.prize;
        totalM += out.m;
        const betA = typeof mInput.playerA.betAmount === 'number' &&
            mInput.playerA.betAmount > 0
            ? mInput.playerA.betAmount
            : 1;
        const betB = typeof mInput.playerB.betAmount === 'number' &&
            mInput.playerB.betAmount > 0
            ? mInput.playerB.betAmount
            : 1;
        const effectiveBet = (betA + betB) / 2;
        const totalBetRevenueInc = effectiveBet;
        distributionM[out.m] = (distributionM[out.m] ?? 0) + 1;
        for (const c of [1, 2, 3, 4, 5]) {
            if (out.remainingA.some(b => b.color === c) ||
                out.remainingB.some(b => b.color === c)) {
                colorPresence[c] = (colorPresence[c] ?? 0) + 1;
            }
        }
        for (const w of out.winningMask) {
            maskColorFrequency[w.color] = (maskColorFrequency[w.color] ?? 0) + 1;
            if (out.remainingA.some(b => b.number === w.number && b.color === w.color) ||
                out.remainingB.some(b => b.number === w.number && b.color === w.color)) {
                matchesPerColor[w.color] = (matchesPerColor[w.color] ?? 0) + 1;
            }
        }
        for (const z of out.cancelled) {
            cancellationsPerColor[z.color] =
                (cancellationsPerColor[z.color] ?? 0) + 1;
        }
    }
    const count = outcomes.length;
    let totalBetRevenue = 0;
    for (const mInput of req.matches) {
        const betA = typeof mInput.playerA.betAmount === 'number' &&
            mInput.playerA.betAmount > 0
            ? mInput.playerA.betAmount
            : 1;
        const betB = typeof mInput.playerB.betAmount === 'number' &&
            mInput.playerB.betAmount > 0
            ? mInput.playerB.betAmount
            : 1;
        totalBetRevenue += (betA + betB) / 2;
    }
    const rtp = totalBetRevenue > 0 ? totalPrize / totalBetRevenue : 0;
    const payoutRatio = rtp;
    const houseEdge = 1 - rtp;
    const bankProfit = totalBetRevenue - totalPrize;
    const metrics = {
        count,
        totalPrize,
        totalBetRevenue,
        payoutRatio,
        rtp,
        houseEdge,
        bankProfit,
        avgPrize: count > 0 ? totalPrize / count : 0,
        avgM: count > 0 ? totalM / count : 0,
        distributionM,
        matchesPerColor,
        colorPresence,
        maskColorFrequency,
        cancellationsPerColor,
    };
    return { outcomes, metrics };
}
function evaluateBatchCompact(req) {
    const outcomes = [];
    let totalPrize = 0;
    let totalM = 0;
    let totalBetRevenue = 0;
    const distributionM = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const matchesPerColor = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const colorPresence = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const maskColorFrequency = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const cancellationsPerColor = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    const sampleMax = typeof req.sampleOutcomes === 'number' && req.sampleOutcomes > 0
        ? req.sampleOutcomes
        : 50;
    const base = typeof req.offset === 'number' && req.offset > 0 ? req.offset : 0;
    for (let i = 0; i < req.N; i++) {
        const idx = base + i;
        const rnd = !!req.randomizePlayers;
        const numMin = 0;
        const numMax = 9;
        const betMin = typeof req.betMin === 'number' && req.betMin > 0 ? req.betMin : 1;
        const betMax = typeof req.betMax === 'number' && req.betMax >= betMin
            ? req.betMax
            : Math.max(betMin, 10);
        const playerA = rnd
            ? randomPlayerFromSeed('A', req.epoch.seed + ':A:' + idx, numMin, numMax)
            : req.playerA;
        const playerB = rnd
            ? randomPlayerFromSeed('B', req.epoch.seed + ':B:' + idx, numMin, numMax)
            : req.playerB;
        let betA = 1;
        let betB = 1;
        if (req.randomizeBet) {
            const r = rng(req.epoch.seed + ':bet:' + idx);
            const span = Math.max(0, betMax - betMin);
            betA = betMin + Math.floor(r() * (span + 1));
            betB = betMin + Math.floor(r() * (span + 1));
        }
        else {
            betA =
                typeof playerA?.betAmount === 'number' && playerA.betAmount > 0
                    ? playerA.betAmount
                    : 1;
            betB =
                typeof playerB?.betAmount === 'number' && playerB.betAmount > 0
                    ? playerB.betAmount
                    : 1;
        }
        const playerAWithBet = {
            ...playerA,
            betAmount: betA,
        };
        const playerBWithBet = {
            ...playerB,
            betAmount: betB,
        };
        const mInput = {
            epoch: req.epoch,
            playerA: playerAWithBet,
            playerB: playerBWithBet,
            salt: String(idx + 1),
        };
        const out = evaluateMatch(mInput);
        if (outcomes.length < sampleMax)
            outcomes.push(out);
        totalPrize += out.prize;
        totalM += out.m;
        distributionM[out.m] = (distributionM[out.m] ?? 0) + 1;
        const effectiveBet = (betA + betB) / 2;
        totalBetRevenue += effectiveBet;
        // accumulate color metrics
        for (const c of [1, 2, 3, 4, 5]) {
            if (out.remainingA.some(b => b.color === c) ||
                out.remainingB.some(b => b.color === c)) {
                colorPresence[c] = (colorPresence[c] ?? 0) + 1;
            }
        }
        for (const w of out.winningMask) {
            maskColorFrequency[w.color] = (maskColorFrequency[w.color] ?? 0) + 1;
            if (out.remainingA.some(b => b.number === w.number && b.color === w.color) ||
                out.remainingB.some(b => b.number === w.number && b.color === w.color)) {
                matchesPerColor[w.color] = (matchesPerColor[w.color] ?? 0) + 1;
            }
        }
        for (const z of out.cancelled) {
            cancellationsPerColor[z.color] =
                (cancellationsPerColor[z.color] ?? 0) + 1;
        }
    }
    const count = req.N;
    const rtp = totalBetRevenue > 0 ? totalPrize / totalBetRevenue : 0;
    const payoutRatio = rtp;
    const houseEdge = 1 - rtp;
    const bankProfit = totalBetRevenue - totalPrize;
    const metrics = {
        count,
        totalPrize,
        totalBetRevenue,
        payoutRatio,
        rtp,
        houseEdge,
        bankProfit,
        avgPrize: count > 0 ? totalPrize / count : 0,
        avgM: count > 0 ? totalM / count : 0,
        distributionM,
        matchesPerColor,
        colorPresence,
        maskColorFrequency,
        cancellationsPerColor,
    };
    return { outcomes, metrics };
}
