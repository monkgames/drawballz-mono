"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateMatch = evaluateMatch;
exports.evaluateBatch = evaluateBatch;
exports.evaluateBatchCompact = evaluateBatchCompact;
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
    const ra = [];
    const rb = [];
    const cancelled = [];
    const stackdata = [];
    const origA = (input.playerA.balls || []).slice(0, 5);
    const origB = (input.playerB.balls || []).slice(0, 5);
    const byColorA = new Map();
    const byColorB = new Map();
    for (let i = 0; i < origA.length; i++) {
        const b = origA[i];
        byColorA.set(b.color, { ball: b, idx: i });
    }
    for (let i = 0; i < origB.length; i++) {
        const b = origB[i];
        byColorB.set(b.color, { ball: b, idx: i });
    }
    let stepIdx = 0;
    const cancelledIdxA = new Set();
    const cancelledIdxB = new Set();
    for (let c = 1; c <= 5; c = (c + 1)) {
        const a = byColorA.get(c);
        const b = byColorB.get(c);
        if (a && b && a.ball.number === b.ball.number) {
            cancelled.push(a.ball);
            stepIdx++;
            stackdata.push({ step: stepIdx, cancelled: [a.ball, b.ball] });
            cancelledIdxA.add(a.idx);
            cancelledIdxB.add(b.idx);
        }
    }
    for (let i = 0; i < origA.length; i++) {
        if (!cancelledIdxA.has(i))
            ra.push(origA[i]);
    }
    for (let i = 0; i < origB.length; i++) {
        if (!cancelledIdxB.has(i))
            rb.push(origB[i]);
    }
    {
        const salt = input.salt ? String(input.salt) : '';
        const W = {
            1: 0.25,
            2: 0.5,
            3: 1.0,
            4: 1.25,
            5: 1.5,
        };
        const maxPos = Math.min(ra.length, rb.length);
        for (let i = 0; i < maxPos; i++) {
            const a = ra[i];
            const b = rb[i];
            if (a && b && a.color === b.color) {
                const wa = W[a.color] || 0;
                const wb = W[b.color] || 0;
                let cancelA = false;
                if (wa > wb)
                    cancelA = true;
                else if (wb > wa)
                    cancelA = false;
                else {
                    const r = rng(epoch.seed + ':acolor:' + salt + ':' + i);
                    cancelA = r() < 0.5;
                }
                const picked = cancelA ? a : b;
                if (cancelA) {
                    ra.splice(i, 1);
                }
                else {
                    rb.splice(i, 1);
                }
                cancelled.push(picked);
                stepIdx++;
                stackdata.push({ step: stepIdx, cancelled: [picked] });
                i--;
            }
        }
        const pairs = [];
        const bound = Math.min(ra.length, rb.length);
        for (let i = 0; i < bound; i++) {
            if (ra[i].number === rb[i].number) {
                pairs.push({ idx: i, num: ra[i].number });
            }
        }
        if (pairs.length > 0) {
            pairs.sort((x, y) => y.num - x.num);
            const chosen = pairs[0];
            const r = rng(epoch.seed +
                ':anum:' +
                salt +
                ':' +
                String(chosen.idx) +
                ':' +
                String(chosen.num));
            const cancelA = r() < 0.5;
            const pick = cancelA ? ra[chosen.idx] : rb[chosen.idx];
            if (cancelA)
                ra.splice(chosen.idx, 1);
            else
                rb.splice(chosen.idx, 1);
            cancelled.push(pick);
            stepIdx++;
            stackdata.push({ step: stepIdx, cancelled: [pick] });
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
