import express from 'express'
import { evaluateBatch, evaluateBatchCompact, evaluateMatch } from './engine'
import { BatchRequest, CompactBatchRequest, MatchInput } from './types'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => {
	res.setHeader(
		'Cache-Control',
		'no-store, no-cache, must-revalidate, proxy-revalidate'
	)
	res.setHeader('Pragma', 'no-cache')
	res.setHeader('Expires', '0')
	next()
})
app.use(
	express.static('public', {
		etag: false,
		lastModified: false,
		cacheControl: true,
		maxAge: 0,
	})
)

app.get('/health', (_req, res) => {
	res.json({ ok: true })
})

app.post('/simulate/match', (req, res) => {
	try {
		const input = req.body as MatchInput
		const out = evaluateMatch(input)
		res.json(out)
	} catch (e: any) {
		res.status(400).json({ error: String(e.message ?? e) })
	}
})

app.post('/simulate/batch', (req, res) => {
	try {
		const body = req.body
		if (body && Array.isArray(body.matches)) {
			const input = body as BatchRequest
			const out = evaluateBatch(input)
			res.json(out)
			return
		}
		if (
			body &&
			body.epoch &&
			body.playerA &&
			body.playerB &&
			typeof body.N === 'number' &&
			body.N >= 1
		) {
			const input = body as CompactBatchRequest
			const out = evaluateBatchCompact(input)
			res.json(out)
			return
		}
		res.status(400).json({ error: 'invalid batch body' })
	} catch (e: any) {
		console.error('Batch error:', e)
		res.status(400).json({ error: String(e?.message ?? e) })
	}
})

const port = process.env.PORT ? Number(process.env.PORT) : 3001
app.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`Fresh server listening on http://localhost:${port}`)
})
