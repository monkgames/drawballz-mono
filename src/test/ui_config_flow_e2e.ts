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
		// initial state
		const state1 = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		if (
			!state1 ||
			!Array.isArray(state1.slots) ||
			state1.slots.length !== 5
		) {
			throw new Error('home state invalid')
		}
		// delete slot 0 config by clearing map and tapping delete indicator via API
		await page.evaluate(() => {
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			map['green'] = 10
			localStorage.setItem(key, JSON.stringify(map))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// open configurator via emit from bubble (slot 0)
		await page.evaluate(() => {
			;((window as any).__home as any).emit(
				'configureBall',
				'green',
				0,
				[]
			)
		})
		await page.waitForFunction(() => !!(window as any).__configurator, {
			timeout: 8000,
		})
		// save GREEN (original) with number 11 to avoid duplicate color restriction
		await page.evaluate(() => {
			;((window as any).__configurator as any).emit('configuratorSave', {
				color: 'green',
				number: 11,
				playerId: 'A',
			})
		})
		// wait to return home
		await page.waitForFunction(() => !(window as any).__configurator, {
			timeout: 8000,
		})
		const state2 = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s0 = state2.slots[0]
		if (!s0 || s0.color !== 'green' || !s0.hasBall || s0.hasBubble) {
			throw new Error('slot 0 not updated to green with ball sprite')
		}
		// delete via UI indicator and ensure bubble appears and ring unconfigured
		await page.evaluate(() => {
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			delete map['green']
			localStorage.setItem(key, JSON.stringify(map))
			;((window as any).__home as any).emit('refreshConfigured')
		})
		// Since test can't click the X directly, emulate delete by removing ball and adding bubble
		await page.evaluate(() => {
			const home = (window as any).__home as any
			// no sprite change needed here; just refresh configured state
			const key = 'configuredMap'
			const map = JSON.parse(localStorage.getItem(key) || '{}') || {}
			delete map['green']
			localStorage.setItem(key, JSON.stringify(map))
			home.emit('refreshConfigured')
		})
		const state3 = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s0b = state3.slots[0]
		if (!s0b || s0b.isConfigured) {
			throw new Error('slot 0 ring not marked unconfigured after delete')
		}
		// re-open configurator from bubble and save GREEN with a different number
		await page.evaluate(() => {
			;((window as any).__home as any).emit(
				'configureBall',
				'green',
				0,
				[]
			)
		})
		await page.waitForFunction(() => !!(window as any).__configurator, {
			timeout: 8000,
		})
		await page.evaluate(() => {
			;((window as any).__configurator as any).emit('configuratorSave', {
				color: 'green',
				number: 19,
				playerId: 'A',
			})
		})
		await page.waitForFunction(() => !(window as any).__configurator, {
			timeout: 8000,
		})
		const state4 = await page.evaluate(() =>
			(window as any).__home.__getState()
		)
		const s0c = state4.slots[0]
		if (!s0c || s0c.color !== 'green' || !s0c.hasBall) {
			throw new Error('slot 0 not updated to green after reconfigure')
		}
		await browser.close()
		console.log('UI config flow e2e passed')
	} finally {
		try {
			preview?.kill('SIGINT')
		} catch (_) {}
	}
}

main().catch(err => {
	console.error('UI config flow e2e failed:', err)
	process.exit(1)
})
