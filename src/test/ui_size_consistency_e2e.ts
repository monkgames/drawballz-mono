import { spawn } from 'child_process'
import puppeteer from 'puppeteer'

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHttp(url: string, timeoutMs = 15000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url)
			if (res.ok) return true
		} catch (_) {}
		await wait(300)
	}
	throw new Error(`waitForHttp timeout: ${url}`)
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
	try {
		await waitForHttp('http://localhost:3001/')
		const browser = await puppeteer.launch({ headless: true })
		const page = await browser.newPage()
		await page.goto('http://localhost:3001/')
		await page.waitForSelector('#nameSubmit', { timeout: 8000 })
		await page.type('#nameInput', 'Tester')
		await page.click('#nameSubmit')
		await page.waitForFunction(() => !!(window as any).__home, {
			timeout: 8000,
		})
		const baseline = await page.evaluate(() => {
			const st = (window as any).__home.__getState()
			return st.slots.map((s: any) => s.renderW)
		})
		// remove configs for orange and yellow to get bubbles
		await page.evaluate(() => {
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			delete map['orange']
			delete map['yellow']
			localStorage.setItem(key, JSON.stringify(map))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// configure yellow on orange slot via configurator
		await page.evaluate(() => {
			;((window as any).__home as any).emit(
				'configureBall',
				'orange',
				2,
				[]
			)
		})
		await page.waitForFunction(() => !!(window as any).__configurator, {
			timeout: 8000,
		})
		await page.evaluate(() => {
			;((window as any).__configurator as any).emit('configuratorSave', {
				color: 'yellow',
				number: 27,
				playerId: 'A',
			})
		})
		await page.waitForFunction(() => !(window as any).__configurator, {
			timeout: 8000,
		})
		const after = await page.evaluate(() => {
			const st = (window as any).__home.__getState()
			return st.slots.map((s: any) => s.renderW)
		})
		// ensure widths per slot remain constant (allow minor rounding tolerance)
		const tol = 2
		for (let i = 0; i < baseline.length; i++) {
			const a = Number(baseline[i]) || 0
			const b = Number(after[i]) || 0
			if (a > 0) {
				if (Math.abs(a - b) > tol) {
					throw new Error(
						`slot ${i} width mismatch: baseline=${a}, after=${b}`
					)
				}
			}
		}
		await browser.close()
		console.log('UI size consistency e2e passed')
	} finally {
		try {
			preview?.kill('SIGINT')
		} catch (_) {}
	}
}

main().catch(err => {
	console.error('UI size consistency e2e failed:', err)
	process.exit(1)
})
