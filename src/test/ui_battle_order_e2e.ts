import { spawn } from 'child_process'
import puppeteer from 'puppeteer'

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
async function waitForHttp(url: string, timeoutMs = 15000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url, { method: 'GET' })
			if (res.ok) return true
		} catch (_) {}
		await wait(300)
	}
	throw new Error('http timeout: ' + url)
}
async function postJSON(url: string, body: any) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	return res.json()
}

async function main() {
	const gameDir = process.cwd() + '/game'
	await new Promise<void>((resolve, reject) => {
		const p = spawn('npm', ['run', 'build'], {
			cwd: gameDir,
			stdio: 'inherit',
		})
		p.on('exit', code =>
			code === 0 ? resolve() : reject(new Error('build failed'))
		)
		p.on('error', reject)
	})
	let preview: ReturnType<typeof spawn> | null = null
	const ready = await waitForHttp('http://localhost:3001/').catch(
		() => false as any
	)
	if (!ready) {
		preview = spawn('npm', ['run', 'preview'], {
			cwd: gameDir,
			stdio: 'inherit',
		})
		await waitForHttp('http://localhost:3001/')
	}
	// Pre-seed server players order
	await postJSON('http://localhost:3001/player/A/ball', {
		color: 'green',
		number: 11,
	})
	await postJSON('http://localhost:3001/player/A/ball', {
		color: 'pink',
		number: 22,
	})
	await postJSON('http://localhost:3001/player/A/ball', {
		color: 'orange',
		number: 33,
	})
	await postJSON('http://localhost:3001/player/A/ball', {
		color: 'yellow',
		number: 44,
	})
	await postJSON('http://localhost:3001/player/A/ball', {
		color: 'blue',
		number: 55,
	})
	await postJSON('http://localhost:3001/player/B/ball', {
		color: 'blue',
		number: 10,
	})
	await postJSON('http://localhost:3001/player/B/ball', {
		color: 'yellow',
		number: 20,
	})
	await postJSON('http://localhost:3001/player/B/ball', {
		color: 'orange',
		number: 30,
	})
	await postJSON('http://localhost:3001/player/B/ball', {
		color: 'pink',
		number: 40,
	})
	await postJSON('http://localhost:3001/player/B/ball', {
		color: 'green',
		number: 50,
	})

	const browser = await puppeteer.launch({ headless: true })
	const pageA = await browser.newPage()
	const pageB = await browser.newPage()
	await pageA.goto('http://localhost:3001/')
	await pageB.goto('http://localhost:3001/')
	for (const page of [pageA, pageB]) {
		await page.waitForSelector('#nameSubmit', { timeout: 8000 })
		await page.type('#nameInput', 'Tester')
		await page.click('#nameSubmit')
		await page.waitForFunction(() => !!(window as any).__home, {
			timeout: 8000,
		})
		await page.evaluate(() => {
			localStorage.setItem('betAmount', String(100))
			localStorage.setItem(
				'configuredMap',
				JSON.stringify({
					green: 11,
					pink: 22,
					orange: 33,
					yellow: 44,
					blue: 55,
				})
			)
			;(window as any).__home.emit('betUpdated')
			;(window as any).__home.emit('requestMatch')
			setTimeout(() => {
				try {
					;(window as any).__home.emit('proposalResponse', true)
				} catch (_) {}
			}, 600)
		})
	}
	await pageA.waitForFunction(() => !!(window as any).__battle, {
		timeout: 15000,
	})
	await pageB.waitForFunction(() => !!(window as any).__battle, {
		timeout: 15000,
	})
	const ordersA = await pageA.evaluate(() => {
		const b = (window as any).__battle
		const u = (b && (b as any).userData) || {}
		return {
			left: (u.leftOrder as number[]) || [],
			right: (u.rightOrder as number[]) || [],
		}
	})
	const ordersB = await pageB.evaluate(() => {
		const b = (window as any).__battle
		const u = (b && (b as any).userData) || {}
		return {
			left: (u.leftOrder as number[]) || [],
			right: (u.rightOrder as number[]) || [],
		}
	})
	const seqA = [11, 22, 33, 44, 55]
	const seqB = [50, 40, 30, 20, 10]
	const goodA =
		JSON.stringify(ordersA.left) === JSON.stringify(seqA) &&
		JSON.stringify(ordersA.right) === JSON.stringify(seqB)
	const goodB =
		JSON.stringify(ordersB.left) === JSON.stringify(seqB) &&
		JSON.stringify(ordersB.right) === JSON.stringify(seqA)
	if (!goodA || !goodB) {
		throw new Error(
			'ui battle order mismatch: ' + JSON.stringify({ ordersA, ordersB })
		)
	}
	await browser.close()
	if (preview) {
		try {
			preview.kill('SIGINT')
		} catch (_) {}
	}
	// eslint-disable-next-line no-console
	console.log('UI battle order e2e passed')
}

main().catch(err => {
	// eslint-disable-next-line no-console
	console.error('UI battle order e2e failed:', err)
	process.exit(1)
})
