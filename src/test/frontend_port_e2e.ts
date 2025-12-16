function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHTML(url: string, timeoutMs = 12000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url)
			if (res.ok) {
				const html = await res.text()
				if (html.toLowerCase().includes('<html')) return true
			}
		} catch (_) {}
		await wait(300)
	}
	throw new Error('frontend not responding on expected port')
}

function normalizeBase(u: string) {
	return u.replace(/\/+$/, '')
}

async function main() {
	const envPort = process.env.PORT || '3001'
	const base =
		(process.env.TEST_BASE as string) ||
		`http://localhost:${String(envPort)}`
	const origin = normalizeBase(base)
	await waitForHTML(`${origin}/`)
	console.log(`Frontend responding at ${origin}`)
}

main().catch(err => {
	console.error('Frontend port e2e failed:', err)
	process.exit(1)
})
