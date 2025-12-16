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
		// clear configured map and assert all unconfigured
		await page.evaluate(() => {
			const key = 'configuredMap'
			localStorage.setItem(key, JSON.stringify({}))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// set GREEN and PINK as configured directly in localStorage
		await page.evaluate(() => {
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			map['green'] = 7
			map['pink'] = 12
			localStorage.setItem(key, JSON.stringify(map))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// reload page and wait for home
		await page.reload({ waitUntil: 'networkidle0' })
		await page.waitForFunction(() => !!(window as any).__home, {
			timeout: 8000,
		})
		const stateA = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s0 = stateA.slots[0] // green
		const s1 = stateA.slots[1] // pink
		const s2 = stateA.slots[2] // orange
		if (!s0 || !s0.hasBall || !s0.isConfigured) {
			throw new Error('green not configured with ball after reload')
		}
		if (!s1 || !s1.hasBall || !s1.isConfigured) {
			throw new Error('pink not configured with ball after reload')
		}
		if (!s2 || s2.isConfigured) {
			throw new Error('orange should be unconfigured after reload')
		}
		// now simulate a swap save: configure YELLOW via configurator from ORANGE slot
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
				number: 33,
				playerId: 'A',
			})
		})
		await page.waitForFunction(() => !(window as any).__configurator, {
			timeout: 8000,
		})
		// reload and assert persistence reflects slotColors (yellow stays at index 2)
		await page.reload({ waitUntil: 'networkidle0' })
		await page.waitForFunction(() => !!(window as any).__home, {
			timeout: 8000,
		})
		const stateB = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s2b = stateB.slots[2]
		if (
			!s2b ||
			s2b.color !== 'yellow' ||
			!s2b.hasBall ||
			!s2b.isConfigured
		) {
			throw new Error('yellow did not persist at slot 2 after reload')
		}
		// final check: localStorage map persists
		const persisted = await page.evaluate(() => {
			return {
				map:
					JSON.parse(localStorage.getItem('configuredMap') || '{}') ||
					{},
				slots:
					JSON.parse(localStorage.getItem('slotColors') || '[]') ||
					[],
			}
		})
		if (!persisted || typeof persisted !== 'object') {
			throw new Error('configuredMap missing after reload')
		}
		if (
			!('green' in persisted.map) ||
			!('pink' in persisted.map) ||
			!('yellow' in persisted.map)
		) {
			throw new Error('configuredMap keys not preserved after reload')
		}
		if (!Array.isArray(persisted.slots) || persisted.slots.length !== 5) {
			throw new Error('slotColors missing or invalid after reload')
		}
		if (persisted.slots[2] !== 'yellow') {
			throw new Error('slotColors did not persist yellow at index 2')
		}
		await browser.close()
		console.log('UI persist reload e2e passed')
	} finally {
		try {
			preview?.kill('SIGINT')
		} catch (_) {}
	}
}

main().catch(err => {
	console.error('UI persist reload e2e failed:', err)
	process.exit(1)
})
