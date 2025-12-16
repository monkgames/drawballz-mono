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
	// build game and start preview
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
		// enter a name to proceed
		await page.waitForSelector('#nameSubmit', { timeout: 8000 })
		await page.type('#nameInput', 'Tester')
		await page.click('#nameSubmit')
		// wait for home exposure
		await page.waitForFunction(() => !!(window as any).__home, {
			timeout: 8000,
		})
		// ensure both ORANGE and YELLOW are unconfigured (bubbles)
		await page.evaluate(() => {
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			delete map['orange']
			delete map['yellow']
			localStorage.setItem(key, JSON.stringify(map))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// open configurator via bubble at ORANGE slot index (2)
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
		// save YELLOW on former ORANGE slot, to simulate swap
		await page.evaluate(() => {
			;((window as any).__configurator as any).emit('configuratorSave', {
				color: 'yellow',
				number: 1,
				playerId: 'A',
			})
		})
		// wait to return home
		await page.waitForFunction(() => !(window as any).__configurator, {
			timeout: 8000,
		})
		// read home state
		const state = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s2 = state.slots[2]
		const s3 = state.slots[3]
		// expect: index 2 is YELLOW with a ball; index 3 remains bubble and not configured
		if (!s2 || s2.color !== 'yellow' || !s2.hasBall || s2.hasBubble) {
			throw new Error('slot 2 failed to show ball after swap save')
		}
		if (!s3 || s3.hasBall || !s3.hasBubble || s3.isConfigured) {
			throw new Error('slot 3 should remain bubble and unconfigured')
		}
		await browser.close()
		console.log('UI swap colors e2e passed')
	} finally {
		try {
			preview?.kill('SIGINT')
		} catch (_) {}
	}
}

main().catch(err => {
	console.error('UI swap colors e2e failed:', err)
	process.exit(1)
})
