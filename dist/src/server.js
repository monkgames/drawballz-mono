"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const engine_1 = require("./engine");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '10mb' }));
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});
app.use(express_1.default.static('public', {
    etag: false,
    lastModified: false,
    cacheControl: true,
    maxAge: 0,
}));
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/simulate/match', (req, res) => {
    try {
        const input = req.body;
        const out = (0, engine_1.evaluateMatch)(input);
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
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Fresh server listening on http://localhost:${port}`);
});
