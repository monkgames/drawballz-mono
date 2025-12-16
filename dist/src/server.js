"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const engine_1 = require("./engine");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '10mb' }));
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});
app.use('/sim', express_1.default.static('public', {
    etag: false,
    lastModified: false,
    cacheControl: true,
    maxAge: 0,
}));
const colorMap = {
    green: 1,
    pink: 2,
    orange: 3,
    yellow: 4,
    blue: 5,
};
const prizeTable = {
    0: 0,
    1: 10,
    2: 20,
    3: 50,
    4: 200,
    5: 1000,
};
const colorWeights = {
    green: 1,
    pink: 2,
    orange: 3,
    yellow: 4,
    blue: 5,
};
function resolveColor(c) {
    if (typeof c === 'number') {
        const n = Math.floor(c);
        return n >= 1 && n <= 5 ? n : null;
    }
    const m = colorMap[String(c).toLowerCase()];
    return m ? m : null;
}
function sanitizePlayer(p) {
    // Preserve order while removing duplicates and invalid entries
    const seen = new Set();
    const balls = [];
    for (const b of p.balls) {
        const cc = resolveColor(b.color);
        if (!cc)
            continue;
        if (seen.has(cc))
            continue;
        seen.add(cc);
        const num = Math.max(1, Math.min(99, Number(b.number) || 0));
        balls.push({ color: cc, number: num });
        if (balls.length >= 5)
            break;
    }
    // Canonicalize order by color ascending to ensure determinism for clients/tests
    const ordered = balls.slice().sort((a, b) => a.color - b.color);
    return { id: p.id, balls: ordered, betAmount: p.betAmount };
}
const players = {
    A: { id: 'A', balls: [], betAmount: 1 },
    B: { id: 'B', balls: [], betAmount: 1 },
};
const playerSlotsOrder = {
    A: [1, 2, 3, 4, 5],
    B: [1, 2, 3, 4, 5],
};
const playerSlotsBalls = {
    A: [],
    B: [],
};
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
// Expose current prize multipliers for UI
app.get('/prize', (_req, res) => {
    try {
        res.json({ table: prizeTable });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.get('/weights', (_req, res) => {
    try {
        res.json({ ok: true, weights: colorWeights });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.get('/player/:id', (req, res) => {
    try {
        const id = String(req.params.id || '').toUpperCase();
        const p = players[id];
        if (!p) {
            res.status(404).json({ error: 'player not found' });
            return;
        }
        const s = sanitizePlayer(p);
        players[id] = s;
        res.json(s);
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.post('/player/:id/ball', (req, res) => {
    try {
        const id = String(req.params.id || '').toUpperCase();
        const p = players[id];
        if (!p) {
            res.status(404).json({ error: 'player not found' });
            return;
        }
        const body = req.body;
        let color = null;
        if (typeof body.color === 'number') {
            color = body.color;
        }
        else if (typeof body.color === 'string') {
            color = colorMap[body.color.toLowerCase()] || null;
        }
        const number = Number(body.number);
        if (!color || !Number.isFinite(number) || number < 1 || number > 99) {
            res.status(400).json({ error: 'invalid ball payload' });
            return;
        }
        const idx = p.balls.findIndex(b => b.color === color);
        const updated = { color, number };
        if (idx >= 0) {
            p.balls = [
                ...p.balls.slice(0, idx),
                updated,
                ...p.balls.slice(idx + 1),
            ];
        }
        else {
            p.balls = [...p.balls, updated];
        }
        if (body.betAmount !== undefined) {
            const amt = Math.max(1, Math.floor(Number(body.betAmount)));
            p.betAmount = amt;
        }
        players[id] = { ...p };
        res.json({ ok: true, player: players[id] });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.post('/simulate/match', (req, res) => {
    try {
        const input = req.body;
        const out = (0, engine_1.evaluateMatch)(input);
        if (currentRound) {
            currentRound.lastOutcome = out;
        }
        res.json(out);
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.post('/simulate/batch', (req, res) => {
    try {
        const body = req.body;
        if (body && Array.isArray(body.matches)) {
            const input = body;
            const out = (0, engine_1.evaluateBatch)(input);
            res.json(out);
            return;
        }
        if (body &&
            body.epoch &&
            body.playerA &&
            body.playerB &&
            typeof body.N === 'number' &&
            body.N >= 1) {
            const input = body;
            const out = (0, engine_1.evaluateBatchCompact)(input);
            res.json(out);
            return;
        }
        res.status(400).json({ error: 'invalid batch body' });
    }
    catch (e) {
        console.error('Batch error:', e);
        res.status(400).json({ error: String(e?.message ?? e) });
    }
});
app.post('/players/reset', (_req, res) => {
    try {
        players['A'] = { id: 'A', balls: [], betAmount: 1 };
        players['B'] = { id: 'B', balls: [], betAmount: 1 };
        res.json({ ok: true });
    }
    catch (e) {
        res.status(400).json({ error: String(e?.message ?? e) });
    }
});
const server = http_1.default.createServer(app);
let currentRound = null;
let currentRoundPlayers = null;
const instanceId = Math.random().toString(36).slice(2);
const serverBootTs = Date.now();
app.get('/server/info', (_req, res) => {
    try {
        res.json({
            ok: true,
            pid: process.pid,
            instanceId,
            startedAt: serverBootTs,
        });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.post('/round/start', (_req, res) => {
    try {
        const id = Math.random().toString(36).slice(2);
        const seed = 'round-' + Date.now() + '-' + id;
        currentRound = { id, seed, startedAt: Date.now() };
        res.json({ ok: true, id, seed });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
app.get('/round/status', (_req, res) => {
    try {
        if (!currentRound) {
            res.json({ ok: true, active: false });
            return;
        }
        res.json({
            ok: true,
            active: true,
            id: currentRound.id,
            seed: currentRound.seed,
            startedAt: currentRound.startedAt,
            multipliers: prizeTable,
            players: (() => {
                const snapshot = currentRoundPlayers;
                const A = snapshot?.A || players['A'];
                const B = snapshot?.B || players['B'];
                return {
                    A: {
                        id: 'A',
                        balls: (A.balls || []).slice(0, 5),
                        betAmount: A.betAmount,
                    },
                    B: {
                        id: 'B',
                        balls: (B.balls || []).slice(0, 5),
                        betAmount: B.betAmount,
                    },
                    names: {
                        A: [...clients].find(c => c.playerId === 'A')?.name ||
                            '',
                        B: [...clients].find(c => c.playerId === 'B')?.name ||
                            '',
                    },
                };
            })(),
            lastOutcome: currentRound.lastOutcome || null,
        });
    }
    catch (e) {
        res.status(400).json({ error: String(e.message ?? e) });
    }
});
let pendingSeat = null;
let clients = new Set();
const readyStateByRoom = {};
const proposalAcceptedByRoom = {};
const matchRequestByRoom = {};
const proposalSentByRoom = {};
const globalReadyClients = new Set();
try {
    const wsLib = require('ws');
    const wss = new wsLib.WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
        let assigned = null;
        ws.on('message', (data) => {
            let msg = null;
            try {
                msg = JSON.parse(String(data));
            }
            catch (_) { }
            if (!msg || typeof msg !== 'object')
                return;
            if (msg.type === 'join') {
                if (!pendingSeat) {
                    pendingSeat = {
                        roomId: Math.random().toString(36).slice(2),
                    };
                }
                const roomId = pendingSeat.roomId;
                const playerId = pendingSeat.A ? 'B' : 'A';
                assigned = { socket: ws, playerId, roomId };
                clients.add(assigned);
                if (playerId === 'A')
                    pendingSeat.A = assigned;
                else
                    pendingSeat.B = assigned;
                ws.send(JSON.stringify({
                    type: 'assigned',
                    playerId,
                    roomId,
                }));
                const other = playerId === 'A'
                    ? pendingSeat.B?.socket
                    : pendingSeat.A?.socket;
                other?.send(JSON.stringify({ type: 'opponent_joined' }));
                if (pendingSeat.A && pendingSeat.B) {
                    // room is full; reset pending
                    pendingSeat = null;
                }
                return;
            }
            if (msg.type === 'name:set') {
                const name = String(msg.name || '').slice(0, 24);
                if (!name)
                    return;
                if (assigned)
                    assigned.name = name;
                for (const c of clients) {
                    if (c === assigned) {
                        c.socket.send(JSON.stringify({ type: 'name:ack', name }));
                    }
                    else if (c.roomId === (assigned?.roomId || '')) {
                        c.socket.send(JSON.stringify({
                            type: 'opponent:name',
                            name,
                        }));
                    }
                }
                return;
            }
            if (msg.type === 'config:update') {
                const id = String(msg.playerId || '').toUpperCase();
                let color = null;
                const rawColor = msg.color;
                if (typeof rawColor === 'number') {
                    color = rawColor;
                }
                else if (typeof rawColor === 'string') {
                    color = colorMap[String(rawColor).toLowerCase()] || null;
                }
                const number = Math.max(1, Math.min(99, Number(msg.number)));
                const betAmount = Number(msg.betAmount);
                const rawOrder = Array.isArray(msg.slotOrder)
                    ? msg.slotOrder
                    : null;
                if (rawOrder && rawOrder.length >= 1) {
                    const nextOrder = [];
                    for (let i = 0; i < Math.min(5, rawOrder.length); i++) {
                        const r = rawOrder[i];
                        let c = null;
                        if (typeof r === 'number') {
                            c = Number(r);
                        }
                        else if (typeof r === 'string') {
                            c = colorMap[String(r).toLowerCase()] || null;
                        }
                        if (c)
                            nextOrder.push(c);
                    }
                    if (nextOrder.length > 0) {
                        playerSlotsOrder[id] = [
                            ...nextOrder,
                            ...playerSlotsOrder[id].filter(x => !nextOrder.includes(x)),
                        ].slice(0, 5);
                        const byColor = new Map();
                        for (const b of players[id].balls) {
                            const c = resolveColor(b.color);
                            if (c)
                                byColor.set(c, b);
                        }
                        const ordered = [];
                        for (const c of playerSlotsOrder[id]) {
                            const found = byColor.get(c);
                            if (found)
                                ordered.push(found);
                        }
                        playerSlotsBalls[id] = ordered.slice(0, 5);
                        try {
                            console.log('config:update (slotOrder)', {
                                id,
                                slotOrder: playerSlotsOrder[id],
                                numbers: ordered.map(b => b.number),
                            });
                        }
                        catch (_) { }
                    }
                }
                if (!players[id])
                    return;
                if (!color || !Number.isFinite(number))
                    return;
                const updated = { color, number };
                const providedIndex = Number.isFinite(Number(msg.index))
                    ? Math.max(0, Math.min(4, Math.floor(Number(msg.index))))
                    : -1;
                if (providedIndex >= 0) {
                    // Remove any existing occurrence of this color elsewhere
                    const existingIdx = players[id].balls.findIndex(b => b.color === color);
                    if (existingIdx >= 0 && existingIdx !== providedIndex) {
                        players[id].balls = [
                            ...players[id].balls.slice(0, existingIdx),
                            ...players[id].balls.slice(existingIdx + 1),
                        ];
                    }
                    // Expand array if needed
                    let arr = [...players[id].balls];
                    while (arr.length <= providedIndex) {
                        arr = [...arr, { color: 1, number: 1 }];
                    }
                    arr[providedIndex] = updated;
                    players[id].balls = arr;
                    playerSlotsBalls[id] = arr.slice(0, 5);
                    try {
                        console.log('config:update (index)', {
                            id,
                            index: providedIndex,
                            order: arr.map(b => b.color),
                            numbers: arr.map(b => b.number),
                        });
                    }
                    catch (_) { }
                    // Track slot color order
                    const c = resolveColor(color);
                    const prev = playerSlotsOrder[id] || [1, 2, 3, 4, 5];
                    const otherIdx = prev.findIndex(x => x === c);
                    if (otherIdx >= 0 && otherIdx !== providedIndex) {
                        const next = prev.slice();
                        next[otherIdx] = next[providedIndex];
                        next[providedIndex] = c;
                        playerSlotsOrder[id] = next;
                    }
                    else {
                        const next = prev.slice();
                        next[providedIndex] = c;
                        playerSlotsOrder[id] = next;
                    }
                }
                else {
                    // Fallback: update by color, keep insertion order
                    const idx = players[id].balls.findIndex(b => b.color === color);
                    if (idx >= 0) {
                        players[id].balls = [
                            ...players[id].balls.slice(0, idx),
                            updated,
                            ...players[id].balls.slice(idx + 1),
                        ];
                    }
                    else {
                        players[id].balls = [
                            ...players[id].balls,
                            updated,
                        ];
                    }
                    playerSlotsBalls[id] = players[id].balls.slice(0, 5);
                    try {
                        console.log('config:update (color)', {
                            id,
                            order: players[id].balls.map(b => b.color),
                            numbers: players[id].balls.map(b => b.number),
                        });
                    }
                    catch (_) { }
                    // Update order by insertion if index not provided
                    const c = resolveColor(color);
                    const prev = playerSlotsOrder[id] || [1, 2, 3, 4, 5];
                    const has = prev.includes(c);
                    const next = has ? prev.slice() : [...prev, c];
                    playerSlotsOrder[id] = next.slice(0, 5);
                }
                players[id] = { ...players[id] };
                if (Number.isFinite(betAmount) && betAmount >= 1) {
                    players[id].betAmount = Math.floor(betAmount);
                }
                // broadcast to all in same room
                for (const c of clients) {
                    if (c.roomId === (assigned?.roomId || '')) {
                        c.socket.send(JSON.stringify({
                            type: 'config:updated',
                            playerId: id,
                            player: players[id],
                        }));
                    }
                }
            }
            if (msg.type === 'player:ready') {
                const room = assigned?.roomId || '';
                if (!room)
                    return;
                const state = (readyStateByRoom[room] || (readyStateByRoom[room] = {}));
                if (assigned?.playerId === 'A')
                    state.A = true;
                if (assigned?.playerId === 'B')
                    state.B = true;
                if (assigned) {
                    assigned.ready = true;
                    globalReadyClients.add(assigned);
                }
                for (const c of clients) {
                    c.socket.send(JSON.stringify({
                        type: 'ready:count',
                        count: globalReadyClients.size,
                    }));
                }
                // notify both clients
                for (const c of clients) {
                    if (c.roomId === room) {
                        c.socket.send(JSON.stringify({
                            type: 'ready:update',
                            A: !!state.A,
                            B: !!state.B,
                            readyCount: (state.A && state.B ? 1 : 0) +
                                (!state.A && !state.B ? 0 : 0),
                        }));
                    }
                }
                // auto propose when both are ready
                if (state.A && state.B && !proposalSentByRoom[room]) {
                    const A = [...clients].find(c => c.roomId === room && c.playerId === 'A');
                    const B = [...clients].find(c => c.roomId === room && c.playerId === 'B');
                    if (A && B) {
                        proposalAcceptedByRoom[room] = { A: false, B: false };
                        proposalSentByRoom[room] = true;
                        A.socket.send(JSON.stringify({
                            type: 'match:proposal',
                            opponentName: B.name || 'Opponent',
                        }));
                        B.socket.send(JSON.stringify({
                            type: 'match:proposal',
                            opponentName: A.name || 'Opponent',
                        }));
                    }
                }
                return;
            }
            if (msg.type === 'match:request') {
                if (!assigned || !assigned.ready)
                    return;
                const candidates = [...globalReadyClients].filter(c => c !== assigned);
                if (candidates.length < 1)
                    return;
                const opp = candidates[Math.floor(Math.random() * candidates.length)];
                const room = Math.random().toString(36).slice(2);
                if (assigned) {
                    assigned.roomId = room;
                    assigned.playerId = 'A';
                }
                if (opp) {
                    opp.roomId = room;
                    opp.playerId = 'B';
                }
                proposalAcceptedByRoom[room] = { A: false, B: false };
                proposalSentByRoom[room] = true;
                assigned.socket.send(JSON.stringify({
                    type: 'assigned',
                    playerId: 'A',
                    roomId: room,
                }));
                opp.socket.send(JSON.stringify({
                    type: 'assigned',
                    playerId: 'B',
                    roomId: room,
                }));
                assigned.socket.send(JSON.stringify({
                    type: 'match:proposal',
                    opponentName: opp.name || 'Opponent',
                }));
                opp.socket.send(JSON.stringify({
                    type: 'match:proposal',
                    opponentName: assigned.name || 'Opponent',
                }));
                return;
            }
            if (msg.type === 'match:cancel') {
                const room = assigned?.roomId || '';
                if (!room)
                    return;
                const req = (matchRequestByRoom[room] || (matchRequestByRoom[room] = {
                    A: false,
                    B: false,
                }));
                if (assigned?.playerId === 'A')
                    req.A = false;
                if (assigned?.playerId === 'B')
                    req.B = false;
                proposalAcceptedByRoom[room] = { A: false, B: false };
                for (const c of clients) {
                    if (c.roomId === room) {
                        c.socket.send(JSON.stringify({ type: 'match:cancelled' }));
                    }
                }
                proposalSentByRoom[room] = false;
                return;
            }
            if (msg.type === 'match:accept' || msg.type === 'match:decline') {
                const room = assigned?.roomId || '';
                if (!room)
                    return;
                const state = (proposalAcceptedByRoom[room] || (proposalAcceptedByRoom[room] = {
                    A: false,
                    B: false,
                }));
                const accept = msg.type === 'match:accept';
                if (assigned?.playerId === 'A')
                    state.A = accept;
                if (assigned?.playerId === 'B')
                    state.B = accept;
                if (!accept) {
                    // notify both of decline and reset
                    for (const c of clients) {
                        if (c.roomId === room) {
                            c.socket.send(JSON.stringify({ type: 'match:declined' }));
                        }
                    }
                    proposalAcceptedByRoom[room] = { A: false, B: false };
                    proposalSentByRoom[room] = false;
                    return;
                }
                if (state.A && state.B) {
                    // small delay to ensure any pending config:update messages are applied
                    setTimeout(() => {
                        const id = Math.random().toString(36).slice(2);
                        const seed = 'round-' + Date.now() + '-' + id;
                        currentRound = { id, seed, startedAt: Date.now() };
                        const countdownMs = 5000;
                        const bufferMs = 1500;
                        const uiCountdownStartTs = Date.now() + bufferMs;
                        const cancelStartTs = uiCountdownStartTs + countdownMs;
                        const serverNowTs = Date.now();
                        const aClient = [...clients].find(c => c.roomId === room && c.playerId === 'A');
                        const bClient = [...clients].find(c => c.roomId === room && c.playerId === 'B');
                        try {
                            playerSlotsOrder['A'] = (players['A'].balls || [])
                                .slice(0, 5)
                                .map(b => resolveColor(b.color) || 1);
                            playerSlotsOrder['B'] = (players['B'].balls || [])
                                .slice(0, 5)
                                .map(b => resolveColor(b.color) || 1);
                        }
                        catch (_) { }
                        for (const c of clients) {
                            if (c.roomId === room) {
                                const AA = (playerSlotsBalls['A'] &&
                                    playerSlotsBalls['A'].length >= 1
                                    ? playerSlotsBalls['A']
                                    : players['A'].balls).slice(0, 5);
                                const BB = (playerSlotsBalls['B'] &&
                                    playerSlotsBalls['B'].length >= 1
                                    ? playerSlotsBalls['B']
                                    : players['B'].balls).slice(0, 5);
                                c.socket.send(JSON.stringify({
                                    type: 'match:start',
                                    roundId: id,
                                    seed,
                                    cancelStartTs,
                                    countdownMs,
                                    uiCountdownStartTs,
                                    serverNowTs,
                                    multipliers: prizeTable,
                                    players: {
                                        A: {
                                            id: 'A',
                                            balls: AA,
                                            betAmount: players['A'].betAmount,
                                            name: aClient?.name || '',
                                        },
                                        B: {
                                            id: 'B',
                                            balls: BB,
                                            betAmount: players['B'].betAmount,
                                            name: bClient?.name || '',
                                        },
                                    },
                                }));
                            }
                        }
                        currentRoundPlayers = {
                            A: {
                                id: 'A',
                                balls: playerSlotsBalls['A']?.slice(0, 5) ||
                                    players['A'].balls.slice(0, 5),
                                betAmount: players['A'].betAmount,
                            },
                            B: {
                                id: 'B',
                                balls: playerSlotsBalls['B']?.slice(0, 5) ||
                                    players['B'].balls.slice(0, 5),
                                betAmount: players['B'].betAmount,
                            },
                        };
                    }, 300);
                    proposalAcceptedByRoom[room] = { A: false, B: false };
                    proposalSentByRoom[room] = false;
                }
                return;
            }
            if (msg.type === 'chat:send') {
                const room = assigned?.roomId || '';
                if (!room)
                    return;
                const text = String(msg.text || '').slice(0, 240);
                if (!text.trim())
                    return;
                const from = assigned?.name || 'Player';
                const payload = {
                    type: 'chat:message',
                    from,
                    text,
                    ts: Date.now(),
                };
                for (const c of clients) {
                    if (c.roomId === room) {
                        c.socket.send(JSON.stringify(payload));
                    }
                }
                return;
            }
        });
        ws.on('close', () => {
            if (assigned) {
                clients.delete(assigned);
                globalReadyClients.delete(assigned);
            }
        });
    });
}
catch (e) {
    // eslint-disable-next-line no-console
    console.error('WebSocket init failed:', e);
}
async function boot() {
    try {
        const isMono = process.env.MONO_DEV === '1';
        if (isMono) {
            const viteMod = await Promise.resolve().then(() => __importStar(require('vite')));
            const vite = await viteMod.createServer({
                root: path_1.default.resolve(process.cwd(), 'game'),
                appType: 'custom',
                server: { middlewareMode: true },
            });
            app.use(vite.middlewares);
            app.use('*', async (req, res) => {
                try {
                    const url = req.originalUrl;
                    const gameRoot = path_1.default.resolve(process.cwd(), 'game');
                    const indexPath = path_1.default.resolve(gameRoot, 'index.html');
                    const raw = fs_1.default.readFileSync(indexPath, 'utf-8');
                    const tpl = await vite.transformIndexHtml(url, raw);
                    res.status(200)
                        .setHeader('Content-Type', 'text/html')
                        .end(tpl);
                }
                catch (e) {
                    res.status(500).end(String(e?.message ?? e));
                }
            });
        }
        else {
            const gameDist = path_1.default.resolve(process.cwd(), 'game', 'dist');
            app.use(express_1.default.static(gameDist, {
                etag: false,
                lastModified: false,
                cacheControl: true,
                maxAge: 0,
            }));
            app.get('*', (_req, res) => {
                try {
                    const indexPath = path_1.default.resolve(gameDist, 'index.html');
                    res.sendFile(indexPath);
                }
                catch (e) {
                    res.status(404).end('Not Found');
                }
            });
        }
        const port = process.env.PORT ? Number(process.env.PORT) : 3001;
        server.listen(port, () => {
            // eslint-disable-next-line no-console
            console.log(`Fresh server listening on http://localhost:${port}`);
        });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error('Mono server boot failed:', e);
        process.exit(1);
    }
}
boot();
