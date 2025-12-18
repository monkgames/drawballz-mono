import { Container, Graphics, Text } from 'pixi.js'
import { createBall, BallColor } from '@/modules/ball'
import { playBeep } from '@/audio/sfx'
import { toggleSettings } from '@/net/rtc'

type BattleBall = { color: BallColor; number: number }

interface BattlePhase {
	type: 'exact' | 'color' | 'number'
	leftIndices: number[]
	rightIndices: number[]
	actions?: (
		| 'cancel'
		| 'swap'
		| 'cancel_left'
		| 'cancel_right'
		| 'randomize'
	)[]
	randomizedValues?: { left: number; right: number }[]
}

interface BattleResult {
	phases: BattlePhase[]
	remainingLeftIndices: number[]
	remainingRightIndices: number[]
}

export async function createBattleScene(
	w: number,
	h: number,
	selfName: string,
	opponentName: string,
	selfBalls: BattleBall[],
	opponentBalls: BattleBall[],
	apiBase?: string,
	roundSeedArg?: string,
	roundIdArg?: string,
	cancelStartTsArg?: number,
	countdownMsArg?: number,
	uiCountdownStartTsArg?: number,
	selfIdArg: string = 'A',
	multipliersArg?: Record<number, number>
) {
	const root = new Container()
	const content = new Container()
	content.sortableChildren = true
	root.addChild(content)
	const API = String(apiBase || window.location.origin)
	const DISABLE_COUNTDOWN = true
	const UI_CHAT_H = 160
	const UI_WIN_PANEL_H = 175
	const UI_WIN_PANEL_MARGIN = 24
	const PLAYER_SCALE_MUL = 0.65
	let colorWeights: Record<BallColor, number> = {
		green: 1,
		pink: 2,
		orange: 3,
		yellow: 4,
		blue: 5,
	}
	const chatTopY = Math.round(h - UI_CHAT_H - 120)
	// Move players down to center vertically and avoid overlap with top countdown
	const playersRowY = Math.round(h * 0.5)
	const winningRowY = Math.min(
		Math.round(
			chatTopY - Math.round(UI_WIN_PANEL_H / 2) - UI_WIN_PANEL_MARGIN
		),
		playersRowY + Math.round(196 * 1.8)
	)
	const titleY = Math.max(180, winningRowY - 40)

	const bg = new Graphics()
	bg.rect(0, 0, w, h)
	bg.fill({ color: 0x0e0e12 })
	content.addChild(bg)

	const midX = Math.round(w / 2)
	const divider = new Graphics()
	divider.moveTo(midX, 60)
	divider.lineTo(midX, h - 60)
	divider.stroke({ color: 0x22303a, width: 2, alpha: 0.9 })
	content.addChild(divider)

	// Add player zones (visual backdrops)
	const zoneH = 240
	const zoneY = Math.round(playersRowY - zoneH / 2)
	const zoneW = Math.round(w * 0.46)

	const createZone = (x: number) => {
		const g = new Graphics()
		g.roundRect(0, 0, zoneW, zoneH, 32)
		g.fill({ color: 0x131619, alpha: 0.85 })
		g.stroke({ color: 0x334155, width: 1, alpha: 0.5 })
		// Inner glow/highlight
		g.roundRect(2, 2, zoneW - 4, zoneH - 4, 30)
		g.stroke({ color: 0xffffff, width: 2, alpha: 0.05 })
		g.x = x
		g.y = zoneY
		return g
	}

	const leftZone = createZone(Math.round(w * 0.02))
	content.addChild(leftZone)

	const rightZone = createZone(Math.round(w - zoneW - w * 0.02))
	content.addChild(rightZone)

	const leftTitle = new Text({
		text: selfName || 'You',
		style: {
			fontFamily: 'system-ui',
			fontSize: 24,
			fill: 0x98ffb3,
			fontWeight: '600',
			letterSpacing: 1,
		},
	})
	leftTitle.resolution = Math.max(window.devicePixelRatio || 1, 2)
	leftTitle.anchor = 0.5
	leftTitle.x = Math.round(w * 0.25)
	leftTitle.y = zoneY + 32
	content.addChild(leftTitle)

	const oppBadgeW = 160
	const oppBadgeH = 44
	const oppBadge = new Graphics()
	oppBadge.roundRect(0, 0, oppBadgeW, oppBadgeH, 22)
	oppBadge.fill({ color: 0x0a0f12, alpha: 0.9 })
	oppBadge.stroke({ color: 0xff4d4f, width: 2, alpha: 0.8 })
	oppBadge.x = Math.round(w * 0.75 - oppBadgeW / 2)
	oppBadge.y = zoneY + 32 - oppBadgeH / 2 // Align with left title vertically

	const oppLabel = new Text({
		text: opponentName || 'Opponent',
		style: {
			fontFamily: 'system-ui',
			fontSize: 22,
			fill: 0xe6f7ff,
			fontWeight: '600',
		},
	})
	oppLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	oppLabel.anchor = 0.5
	oppLabel.x = Math.round(oppBadge.x + oppBadgeW / 2)
	oppLabel.y = Math.round(oppBadge.y + oppBadgeH / 2)
	content.addChild(oppBadge)
	content.addChild(oppLabel)

	const renderSide = async (
		balls: BattleBall[],
		centerX: number,
		rowY: number,
		out: { node: Container; label: Text; bb: BattleBall }[]
	) => {
		const maxCount = Math.min(5, balls.length)
		const sideWidth = Math.round(w * 0.44)
		const gap = Math.round(Math.min(w, h) * 0.022)
		const targetWidth = Math.round(
			(sideWidth - gap * (maxCount - 1)) / maxCount
		)
		const startX = Math.round(
			centerX - (targetWidth * maxCount + gap * (maxCount - 1)) / 2
		)
		for (let i = 0; i < maxCount; i++) {
			const bb = balls[i]
			const ball = await createBall(bb.color, { noFX: true })
			const baseWidth =
				((ball as any).userData?.baseWidth as number) || ball.width || 1
			const scale = (targetWidth / baseWidth) * PLAYER_SCALE_MUL
			ball.scale.set(scale)
			const trailBottom =
				((ball as any).userData?.trailBottomOffset as number) ||
				ball.height / 2
			const x = Math.round(
				startX + i * (targetWidth + gap) + targetWidth / 2
			)
			const baselineY = Math.round(rowY)
			ball.x = x
			ball.y = Math.round(baselineY - scale * (trailBottom || 0))
			content.addChild(ball)
			const numberLabel = new Text({
				text: String(bb.number),
				style: {
					fontFamily: 'system-ui',
					fontSize: 26,
					fill: 0x98ffb3,
					fontWeight: 'bold',
					stroke: { color: 0x000000, width: 4 },
				},
			})
			numberLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
			numberLabel.anchor = 0.5
			numberLabel.x = ball.x
			// Center label visually on the ball
			numberLabel.y = Math.round(ball.y)
			content.addChild(numberLabel)
			out.push({ node: ball, label: numberLabel, bb })
		}
	}

	const leftItems: { node: Container; label: Text; bb: BattleBall }[] = []
	const rightItems: { node: Container; label: Text; bb: BattleBall }[] = []
	try {
		let localSlotColors: string[] = []
		try {
			const raw = localStorage.getItem('slotColors') || ''
			const arr = JSON.parse(raw || '[]') || []
			if (Array.isArray(arr) && arr.length >= 1) {
				localSlotColors = arr.map(c => String(c))
			}
		} catch (_) {}
		const toOrder = (orderRaw: string[]) =>
			orderRaw
				.map(s => String(s).toLowerCase())
				.filter(Boolean) as BallColor[]
		const applyOrder = (balls: BattleBall[], order: BallColor[]) => {
			if (!order || order.length < 1) return balls.slice()
			const byColor = new Map<BallColor, BattleBall>()
			for (const b of balls) {
				if (!byColor.has(b.color)) byColor.set(b.color, b)
			}
			const first: BattleBall[] = []
			for (const c of order) {
				const it = byColor.get(c as BallColor)
				if (it) first.push(it)
			}
			const remaining: BattleBall[] = []
			for (const b of balls) {
				if (!first.some(x => x.color === b.color)) remaining.push(b)
			}
			return [...first, ...remaining].slice(0, Math.max(0, balls.length))
		}
		const selfOrder = toOrder(localSlotColors)
		const oppOrder = toOrder(opponentBalls.map(b => b.color as any))
		selfBalls = applyOrder(selfBalls, selfOrder)
		opponentBalls = applyOrder(opponentBalls, oppOrder)
	} catch (_) {}
	await renderSide(selfBalls, Math.round(w * 0.25), playersRowY, leftItems)
	await renderSide(
		opponentBalls,
		Math.round(w * 0.75),
		playersRowY,
		rightItems
	)
	;(root as any).userData = {
		...(root as any).userData,
		leftOrder: leftItems.map(it => it.bb.number),
		rightOrder: rightItems.map(it => it.bb.number),
		leftColors: leftItems.map(it => it.bb.color),
		rightColors: rightItems.map(it => it.bb.color),
	}

	const dbgPanel = new Graphics()
	const dbgText = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 14, fill: 0xe6f7ff },
	})
	dbgText.resolution = Math.max(window.devicePixelRatio || 1, 2)
	const dbgW = Math.min(320, Math.round(w * 0.36))
	const dbgH = 140
	dbgPanel.roundRect(0, 0, dbgW, dbgH, 12)
	dbgPanel.fill({ color: 0x0a0f12, alpha: 0.9 })
	dbgPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
	// Position panel above the toggle button
	const toggleH = 32
	dbgPanel.x = Math.round(w - dbgW - 24)
	dbgPanel.y = Math.round(h - dbgH - 24 - toggleH - 8)
	dbgText.x = dbgPanel.x + 12
	dbgText.y = dbgPanel.y + 10

	dbgPanel.visible = false
	dbgText.visible = false

	const dbgToggle = new Graphics()
	const tW = 80
	const tH = toggleH
	dbgToggle.roundRect(0, 0, tW, tH, 8)
	dbgToggle.fill({ color: 0x0a0f12, alpha: 0.8 })
	dbgToggle.stroke({ color: 0x98ffb3, width: 1, alpha: 0.6 })
	dbgToggle.x = Math.round(w - tW - 24)
	dbgToggle.y = Math.round(h - tH - 24)
	dbgToggle.eventMode = 'static'
	dbgToggle.cursor = 'pointer'

	const tLabel = new Text({
		text: 'Debug',
		style: { fontFamily: 'system-ui', fontSize: 12, fill: 0x98ffb3 },
	})
	tLabel.anchor = 0.5
	tLabel.x = dbgToggle.x + tW / 2
	tLabel.y = dbgToggle.y + tH / 2

	dbgToggle.on('pointertap', () => {
		const v = !dbgPanel.visible
		dbgPanel.visible = v
		dbgText.visible = v
		tLabel.text = v ? 'Hide' : 'Debug'
	})

	content.addChild(dbgPanel)
	content.addChild(dbgText)
	content.addChild(dbgToggle)
	content.addChild(tLabel)

	// A/V Settings Button
	const settingsBtn = new Graphics()
	const sW = 110
	const sH = 32
	settingsBtn.roundRect(0, 0, sW, sH, 8)
	settingsBtn.fill({ color: 0x22303a, alpha: 0.9 })
	settingsBtn.stroke({ color: 0x98ffb3, width: 1, alpha: 0.7 })
	settingsBtn.x = Math.round(w - sW - 24)
	settingsBtn.y = 24
	settingsBtn.eventMode = 'static'
	settingsBtn.cursor = 'pointer'

	const sLabel = new Text({
		text: 'A/V Settings',
		style: { fontFamily: 'system-ui', fontSize: 12, fill: 0x98ffb3 },
	})
	sLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	sLabel.anchor = 0.5
	sLabel.x = sW / 2
	sLabel.y = sH / 2
	settingsBtn.addChild(sLabel)
	settingsBtn.on('pointertap', () => toggleSettings())
	content.addChild(settingsBtn)

	// Weights UI purged
	const setWeightsText = () => {}
	;(async () => {})()

	function setDebug(lines: string[]) {
		dbgText.text = lines.join('\n')
	}
	let dbgLines: string[] = [
		'Health: pending',
		'Round: -',
		'Seed: -',
		'Status: pending',
	]
	setDebug(dbgLines)
	let symDone = false
	let colorDone = false
	let numDone = false
	let roundSeed: string | null = String(roundSeedArg || '') || null
	let roundId = String(roundIdArg || '')
	const healthReq = fetch(`${API}/health`)
	let cancelStartTs =
		typeof cancelStartTsArg === 'number' &&
		Number.isFinite(cancelStartTsArg)
			? cancelStartTsArg
			: Date.now() + 1000
	let countdownMs =
		typeof countdownMsArg === 'number' && Number.isFinite(countdownMsArg)
			? countdownMsArg
			: 5000
	let uiCountdownStartTs =
		typeof uiCountdownStartTsArg === 'number' &&
		Number.isFinite(uiCountdownStartTsArg)
			? uiCountdownStartTsArg
			: Math.max(0, cancelStartTs - Math.max(1000, countdownMs))

	const countLabel = new Text({
		text: '5',
		style: { fontFamily: 'system-ui', fontSize: 56, fill: 0xffe58f },
	})
	countLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	countLabel.anchor = 0.5
	countLabel.x = Math.round(w / 2)
	countLabel.y = Math.round(h * 0.24)
	content.addChild(countLabel)
	const countTitle = new Text({
		text: 'Battle Starts in',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	countTitle.anchor = 0.5
	countTitle.x = countLabel.x
	countTitle.y = Math.round(countLabel.y - 40)
	countTitle.visible = false
	content.addChild(countTitle)
	let count = Math.max(
		1,
		Math.ceil(Math.max(0, cancelStartTs - Date.now()) / 1000)
	)
	let table: Record<number, number> = multipliersArg || {
		0: 0,
		1: 10,
		2: 20,
		3: 50,
		4: 200,
		5: 1000,
	}
	try {
		const selfSlotColors = selfBalls.map(b => b.color)
		const opponentSlotColors = opponentBalls.map(b => b.color)
		let localSlotColors: string[] = []
		try {
			const raw = localStorage.getItem('slotColors') || ''
			const arr = JSON.parse(raw || '[]') || []
			if (Array.isArray(arr) && arr.length >= 1) {
				localSlotColors = arr.map(c => String(c))
			}
		} catch (_) {}
		console.log('Round data:', {
			roundId: String(roundId || ''),
			roundSeed: String(roundSeed || ''),
			selfBalls,
			opponentBalls,
			slotOrderLocal: localSlotColors,
			slotOrderSelf: selfSlotColors,
			slotOrderOpponent: opponentSlotColors,
		})
	} catch (_) {}
	let countTimer: any = null
	function toColorName(c: number): BallColor {
		return c === 1
			? 'green'
			: c === 2
			? 'pink'
			: c === 3
			? 'orange'
			: c === 4
			? 'yellow'
			: 'blue'
	}
	function toColorCode(s: BallColor): number {
		return s === 'green'
			? 1
			: s === 'pink'
			? 2
			: s === 'orange'
			? 3
			: s === 'yellow'
			? 4
			: 5
	}
	;(async () => {
		try {
			dbgLines[1] = 'Round: ' + (roundId || '-')
			dbgLines[2] = 'Seed: ' + (roundSeed || '-')
			dbgLines[3] = 'Status: started'
			setDebug(dbgLines)
		} catch (_) {}
		try {
			const hres = await healthReq
			const hj = await hres.json()
			dbgLines[0] = 'Health: ' + (hj?.ok ? 'ok' : 'error')
			setDebug(dbgLines)
		} catch (_) {
			dbgLines[0] = 'Health: error'
			setDebug(dbgLines)
		}
		try {
			if (!roundId || !roundSeed) {
				const rs = await fetch(`${API}/round/status`).then(r =>
					r.json().catch(() => ({}))
				)
				if ((rs as any)?.active) {
					roundId = String((rs as any)?.id || roundId || '')
					roundSeed = String((rs as any)?.seed || roundSeed || '')
					dbgLines[1] = 'Round: ' + (roundId || '-')
					dbgLines[2] = 'Seed: ' + (roundSeed || '-')
					setDebug(dbgLines)
				}
			}
		} catch (_) {}
	})()
	function layoutRow(
		items: { node: Container; label: Text; bb: BattleBall }[],
		centerX: number,
		rowY: number
	) {
		const maxCount = Math.min(5, items.length)
		const sideWidth = Math.round(w * 0.44)
		const gap = Math.round(Math.min(w, h) * 0.022)
		const targetWidth = Math.round(
			(sideWidth - gap * (maxCount - 1)) / Math.max(1, maxCount)
		)
		const startX = Math.round(
			centerX - (targetWidth * maxCount + gap * (maxCount - 1)) / 2
		)
		for (let i = 0; i < maxCount; i++) {
			const it = items[i]
			const node = it.node
			const baseWidth =
				((node as any).userData?.baseWidth as number) || node.width || 1
			const scale = (targetWidth / baseWidth) * PLAYER_SCALE_MUL
			const trailBottom =
				((node as any).userData?.trailBottomOffset as number) ||
				node.height / 2
			const x = Math.round(
				startX + i * (targetWidth + gap) + targetWidth / 2
			)
			const baselineY = Math.round(rowY)
			const toX = x
			const toY = Math.round(baselineY - scale * (trailBottom || 0))
			;(node.scale as any).set?.(scale)
			node.x = toX
			node.y = toY
			it.label.x = node.x
			it.label.y = Math.round(
				node.y - targetWidth * 0.28 * PLAYER_SCALE_MUL
			)
		}
	}
	const { gsap } = await import('gsap')
	const showCountdown = async (txt: string, secs: number) => {
		const title = new Text({
			text: txt,
			style: {
				fontFamily: 'system-ui',
				fontSize: 24,
				fill: 0xe6f7ff,
				fontWeight: 'bold',
			},
		})
		title.resolution = Math.max(window.devicePixelRatio || 1, 2)
		title.anchor = 0.5
		title.x = Math.round(w / 2)
		title.y = Math.round(playersRowY - 80)
		const label = new Text({
			text: String(secs),
			style: { fontFamily: 'system-ui', fontSize: 42, fill: 0xffe58f },
		})
		label.anchor = 0.5
		label.x = Math.round(w / 2)
		label.y = Math.round(playersRowY - 40)
		content.addChild(title)
		content.addChild(label)
		for (let i = secs; i >= 1; i--) {
			label.text = String(i)
			await new Promise<void>(resolve =>
				gsap.to(label.scale, {
					x: 1.08,
					y: 1.08,
					duration: 0.22,
					yoyo: true,
					repeat: 1,
					ease: 'sine.inOut',
					onComplete: resolve,
				})
			)
			await new Promise(r => setTimeout(r, 1000))
		}
		try {
			content.removeChild(title)
			content.removeChild(label)
		} catch (_) {}
	}

	async function runBattleSequence(res: { phases: BattlePhase[] }) {
		const phases = res.phases
		const allLeftItems = [...leftItems]
		const allRightItems = [...rightItems]
		const eliminated = new Set<any>()

		// Log phases for debugging
		console.log('Running Battle Sequence with phases:', phases)

		// Execute Phases
		for (const phase of phases) {
			let label = ''
			let duration = 3
			if (phase.type === 'exact') label = 'Exact Match in'
			if (phase.type === 'color') {
				label = 'Color Swap in'
				duration = 3
			}
			if (phase.type === 'number') label = 'Number Cancel in'

			dbgLines[3] = `Status: ${phase.type}-pending`
			setDebug(dbgLines)
			await showCountdown(label, duration)

			dbgLines[3] = `Status: ${phase.type}-cancelling`
			setDebug(dbgLines)

			// Countdown / Phase Title
			const phaseName =
				phase.type === 'exact'
					? 'EXACT MATCH'
					: phase.type === 'color'
					? 'COLOR SWAP'
					: 'NUMBER CANCEL'

			const titleText = new Text({
				text: phaseName,
				style: {
					fontFamily: 'system-ui',
					fontSize: 48,
					fill: 0xffffff,
					fontWeight: 'bold',
					dropShadow: {
						color: 0x000000,
						blur: 4,
						distance: 4,
						alpha: 0.5,
					},
				},
			})
			titleText.resolution = Math.max(window.devicePixelRatio || 1, 2)
			titleText.anchor.set(0.5)
			titleText.x = w / 2
			titleText.y = h / 2 - 50
			titleText.alpha = 0
			titleText.scale.set(0.5)
			content.addChild(titleText)

			await gsap.to(titleText, {
				alpha: 1,
				scale: 1.2,
				duration: 0.5,
				ease: 'back.out(1.7)',
			})
			await new Promise(r => setTimeout(r, 800))
			await gsap.to(titleText, {
				alpha: 0,
				scale: 1.5,
				duration: 0.3,
				ease: 'power2.in',
			})
			content.removeChild(titleText)

			const pairs: {
				L: any
				R: any
				ringL: Graphics
				ringR: Graphics
				lIdx: number
				rIdx: number
				action: string
				randVals?: { left: number; right: number }
			}[] = []

			for (let k = 0; k < phase.leftIndices.length; k++) {
				const li = phase.leftIndices[k]
				const ri = phase.rightIndices[k]
				const L = allLeftItems[li]
				const R = allRightItems[ri]
				// Skip if already eliminated
				if (eliminated.has(L) || eliminated.has(R)) continue

				const action = phase.actions?.[k] || 'cancel'
				const randVals = phase.randomizedValues?.[k]

				if (L && R) {
					const ringL = new Graphics()
					const rL = Math.max(18, Math.floor(L.node.width * 0.55))
					ringL.circle(0, 0, rL)
					ringL.stroke({ color: 0x98ffb3, width: 3, alpha: 0 })
					ringL.x = L.node.x
					ringL.y = L.node.y
					content.addChild(ringL)

					const ringR = new Graphics()
					const rR = Math.max(18, Math.floor(R.node.width * 0.55))
					ringR.circle(0, 0, rR)
					ringR.stroke({ color: 0x98ffb3, width: 3, alpha: 0 })
					ringR.x = R.node.x
					ringR.y = R.node.y
					content.addChild(ringR)

					pairs.push({
						L,
						R,
						ringL,
						ringR,
						lIdx: li,
						rIdx: ri,
						action,
						randVals,
					})
				}
			}

			if (pairs.length === 0) continue

			playBeep()

			// Show rings
			await Promise.all(
				pairs.flatMap(p => [
					gsap.to(p.ringL, { alpha: 1, duration: 0.35 }),
					gsap.to(p.ringR, { alpha: 1, duration: 0.35 }),
				])
			)

			// Vibration
			await Promise.all(
				pairs.flatMap(p => [
					gsap.to(p.L.node, {
						x: p.L.node.x + 5,
						duration: 0.05,
						yoyo: true,
						repeat: 5,
					}),
					gsap.to(p.R.node, {
						x: p.R.node.x + 5,
						duration: 0.05,
						yoyo: true,
						repeat: 5,
					}),
				])
			)

			// Execute Actions
			const elimY = Math.round(chatTopY - 20)

			for (const p of pairs) {
				const anims: any[] = []
				if (p.action === 'swap') {
					// Swap references in arrays for future phases
					const tmp = allLeftItems[p.lIdx]
					allLeftItems[p.lIdx] = allRightItems[p.rIdx]
					allRightItems[p.rIdx] = tmp

					// Animate swap
					anims.push(
						gsap.to(p.L.node, {
							x: p.R.node.x,
							y: p.R.node.y,
							duration: 0.8,
							ease: 'power2.inOut',
						}),
						gsap.to(p.L.label, {
							x: p.R.node.x,
							y: p.R.label.y,
							duration: 0.8,
							ease: 'power2.inOut',
						}),
						gsap.to(p.R.node, {
							x: p.L.node.x,
							y: p.L.node.y,
							duration: 0.8,
							ease: 'power2.inOut',
						}),
						gsap.to(p.R.label, {
							x: p.L.node.x,
							y: p.L.label.y,
							duration: 0.8,
							ease: 'power2.inOut',
						}),
						gsap.to(p.ringL, { alpha: 0, duration: 0.5 }),
						gsap.to(p.ringR, { alpha: 0, duration: 0.5 })
					)
				} else if (p.action === 'randomize' && p.randVals) {
					const { left: finalL, right: finalR } = p.randVals
					const dur = 5.0

					// Flicker
					const obj = { val: 0 }
					anims.push(
						gsap.to(obj, {
							val: 100,
							duration: dur,
							ease: 'none',
							onUpdate: () => {
								p.L.label.text = Math.floor(
									Math.random() * 10
								).toString()
								p.R.label.text = Math.floor(
									Math.random() * 10
								).toString()
							},
							onComplete: () => {
								p.L.label.text = finalL.toString()
								p.R.label.text = finalR.toString()
							},
						})
					)

					// Cancellation (delayed)
					if (finalL > finalR) {
						eliminated.add(p.L)
						anims.push(
							gsap.to(p.L.node, {
								alpha: 0,
								y: elimY,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.L.label, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.ringL, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.ringR, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							})
						)
					} else {
						eliminated.add(p.R)
						anims.push(
							gsap.to(p.R.node, {
								alpha: 0,
								y: elimY,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.R.label, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.ringR, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							}),
							gsap.to(p.ringL, {
								alpha: 0,
								duration: 0.5,
								delay: dur + 0.5,
							})
						)
					}
				} else {
					// Cancellations
					if (p.action === 'cancel' || p.action === 'cancel_left') {
						eliminated.add(p.L)
						anims.push(
							gsap.to(p.L.node, {
								x: w / 2 - 20,
								y: elimY,
								alpha: 0,
								duration: 0.8,
							}),
							gsap.to(p.L.label, { alpha: 0, duration: 0.5 }),
							gsap.to(p.ringL, { alpha: 0, duration: 0.5 })
						)
					} else {
						// Keep left, hide ring
						anims.push(
							gsap.to(p.ringL, { alpha: 0, duration: 0.5 })
						)
					}

					if (p.action === 'cancel' || p.action === 'cancel_right') {
						eliminated.add(p.R)
						anims.push(
							gsap.to(p.R.node, {
								x: w / 2 + 20,
								y: elimY,
								alpha: 0,
								duration: 0.8,
							}),
							gsap.to(p.R.label, { alpha: 0, duration: 0.5 }),
							gsap.to(p.ringR, { alpha: 0, duration: 0.5 })
						)
					} else {
						// Keep right, hide ring
						anims.push(
							gsap.to(p.ringR, { alpha: 0, duration: 0.5 })
						)
					}
				}
				await Promise.all(anims)
			}

			// Cleanup DOM
			pairs.forEach(p => {
				try {
					content.removeChild(p.ringL)
					content.removeChild(p.ringR)
					if (eliminated.has(p.L)) {
						content.removeChild(p.L.node)
						content.removeChild(p.L.label)
					}
					if (eliminated.has(p.R)) {
						content.removeChild(p.R.node)
						content.removeChild(p.R.label)
					}
				} catch (_) {}
			})

			// Sync global leftItems/rightItems for layout
			const nextLeft = allLeftItems.filter(x => !eliminated.has(x))
			const nextRight = allRightItems.filter(x => !eliminated.has(x))
			leftItems.splice(0, leftItems.length, ...nextLeft)
			rightItems.splice(0, rightItems.length, ...nextRight)

			layoutRow(leftItems, Math.round(w * 0.25), playersRowY)
			layoutRow(rightItems, Math.round(w * 0.75), playersRowY)

			await new Promise(r => setTimeout(r, 500))
		}
	}

	async function onCountdownDone() {
		try {
			const epoch = {
				maskSizeDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
				fixedPrizeTable: table,
				seed: roundSeed || 'live-' + Date.now(),
				numberMin: 0,
				numberMax: 9,
				maxMaskSize: 5,
			}
			const betRaw = localStorage.getItem('betAmount') || ''
			const betAmt = Math.max(1, Math.floor(Number(betRaw) || 0))
			const selfMapped = selfBalls.map(b => ({
				number: b.number,
				color: toColorCode(b.color),
			}))
			const oppMapped = opponentBalls.map(b => ({
				number: b.number,
				color: toColorCode(b.color),
			}))
			// Always construct request as A vs B from server perspective
			// If I am A: playerA=Self, playerB=Opp
			// If I am B: playerA=Opp, playerB=Self
			const playerA = {
				id: 'A',
				balls: selfIdArg === 'A' ? selfMapped : oppMapped,
				betAmount: betAmt,
			}
			const playerB = {
				id: 'B',
				balls: selfIdArg === 'A' ? oppMapped : selfMapped,
				betAmount: betAmt,
			}
			const body = { epoch, playerA, playerB }
			let out: any = null
			try {
				const res = await fetch(`${API}/simulate/match`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})
				out = await res.json()
				try {
					console.log('Battle/match outcome', out)
				} catch (_) {}
				try {
					const rs = await fetch(`${API}/round/status`).then(r =>
						r.json().catch(() => ({}))
					)
					console.log('Battle/round status', rs)
				} catch (_) {}
				const prizeLine = 'Prize: ' + String(Number(out?.prize || 0))
				const matchesLine = 'Matches: ' + String(Number(out?.m || 0))
				const stepsLine =
					'Steps: ' + String(out?.stackdata?.length || 0)
				const poolType = String(out?.rewardPool?.type || '-')
				const poolLine =
					'Pool: ' +
					poolType +
					(poolType === 'shared'
						? ` (${(out?.rewardPool?.combinedBalls || []).length})`
						: '')
				dbgLines[2] = 'Seed: ' + (roundSeed || '-')
				dbgLines[3] = 'Status: ended'
				dbgLines = [
					dbgLines[0],
					dbgLines[1],
					dbgLines[2],
					dbgLines[3],
					prizeLine,
					matchesLine,
					stepsLine,
					poolLine,
				]
				setDebug(dbgLines)
			} catch (_) {}
			countLabel.visible = false
			let phases = (out?.phases || []) as BattlePhase[]
			if (selfIdArg === 'B') {
				// Swap phases for Player B to match UI (Self on Left)
				phases = phases.map(p => ({
					...p,
					leftIndices: p.rightIndices,
					rightIndices: p.leftIndices,
					actions: p.actions?.map(a =>
						a === 'cancel_left'
							? 'cancel_right'
							: a === 'cancel_right'
							? 'cancel_left'
							: a
					),
					randomizedValues: p.randomizedValues?.map(v => ({
						left: v.right,
						right: v.left,
					})),
				}))
			}
			await runBattleSequence({ phases })
			dbgLines[3] = 'Status: reveal-pending'
			setDebug(dbgLines)
			await runRevealCountdown()
			if (out && Array.isArray(out.winningMask)) {
				const title = new Text({
					text: 'Winning Set',
					style: {
						fontFamily: 'system-ui',
						fontSize: 32,
						fill: 0xe6f7ff,
						fontWeight: 'bold',
						dropShadow: {
							color: 0x98ffb3,
							alpha: 0.4,
							blur: 10,
							distance: 0,
						},
					},
				})
				title.anchor = 0.5
				title.x = Math.round(w / 2)
				// Pulse the title
				gsap.to(title.scale, {
					x: 1.1,
					y: 1.1,
					duration: 0.8,
					yoyo: true,
					repeat: -1,
					ease: 'sine.inOut',
				})

				const panelW = Math.min(620, Math.round(w * 0.72))
				const panelH = UI_WIN_PANEL_H
				const panel = new Graphics()
				panel.roundRect(0, 0, panelW, panelH, 16)
				panel.fill({ color: 0x0a0f12, alpha: 0.8 })
				panel.stroke({ color: 0x98ffb3, width: 4, alpha: 0.9 })
				panel.x = Math.round(w / 2 - panelW / 2)
				panel.y = Math.round(winningRowY - panelH / 2)
				title.y = Math.round(panel.y - 30)
				content.addChild(panel)
				content.addChild(title)
				dbgLines[3] = 'Status: reveal-shown'
				setDebug(dbgLines)
				const maskBalls: BattleBall[] = out.winningMask.map(
					(b: any) => ({
						color: toColorName(Number(b.color) || 1),
						number: Number(b.number) || 0,
					})
				)
				const maskItems: {
					node: Container
					label: Text
					bb: BattleBall
				}[] = []
				await renderSide(
					maskBalls,
					Math.round(w / 2),
					winningRowY,
					maskItems
				)
				const innerPadX = 28
				const innerPadY = 24
				const gapX = Math.round(Math.min(w, h) * 0.032)
				const count = Math.min(5, maskItems.length)
				const availW = panelW - innerPadX * 2
				const targetW = Math.round(
					(availW - gapX * (count - 1)) / Math.max(1, count)
				)
				for (let i = 0; i < count; i++) {
					const it = maskItems[i]
					const baseW =
						((it.node as any).userData?.baseWidth as number) ||
						it.node.width ||
						1
					// Reduced scale by ~18% (1.3 -> 1.06)
					const finalScale = (targetW / baseW) * 1.06
					;(it.node.scale as any).set?.(finalScale)
					const x = Math.round(
						panel.x + innerPadX + i * (targetW + gapX) + targetW / 2
					)
					const y = Math.round(
						panel.y +
							innerPadY +
							panelH / 2 -
							(((it.node as any).userData
								?.trailBottomOffset as number) ||
								it.node.height / 2) *
								finalScale
					)
					it.node.x = x
					it.node.y = y
					it.label.x = x
					it.label.y = Math.round(y - targetW * 0.28 * 1.06)

					// Entrance animation
					it.node.alpha = 0
					it.label.alpha = 0
					gsap.to(it.node, {
						alpha: 1,
						duration: 0.4,
						delay: i * 0.1,
						ease: 'power2.out',
					})
					gsap.from(it.node.scale, {
						x: 0,
						y: 0,
						duration: 0.6,
						delay: i * 0.1,
						ease: 'back.out(1.7)',
					})
					gsap.to(it.label, {
						alpha: 1,
						duration: 0.4,
						delay: i * 0.1 + 0.2,
					})
					gsap.from(it.label, {
						y: it.label.y + 20,
						duration: 0.4,
						delay: i * 0.1 + 0.2,
						ease: 'back.out(1.2)',
					})
				}
				root.once('battle:cleanup', () => {
					try {
						title.destroy()
						panel.destroy()
					} catch (_) {}
				})
			}
		} catch (_) {
			countLabel.visible = false
		}
	}
	function tickCountdown() {
		count = Math.max(0, count - 1)
		countLabel.text = String(count)
		if (count <= 0) {
			if (countTimer) {
				clearInterval(countTimer)
				countTimer = null
			}
			onCountdownDone()
		}
	}
	async function runSyncedCountdown() {
		try {
			const { gsap } = await import('gsap')
			const preWait = Math.max(0, uiCountdownStartTs - Date.now())
			if (preWait > 0) {
				await new Promise(r => setTimeout(r, preWait))
			}
			countLabel.visible = true
			countTitle.visible = true
			dbgLines[3] = 'Status: countdown'
			setDebug(dbgLines)
			const maxSecs = Math.max(1, Math.ceil(countdownMs / 1000))
			for (let i = maxSecs; i >= 1; i--) {
				countLabel.text = String(i)
				await new Promise<void>(resolve =>
					gsap.to(countLabel.scale, {
						x: 1.08,
						y: 1.08,
						duration: 0.22,
						yoyo: true,
						repeat: 1,
						ease: 'sine.inOut',
						onComplete: resolve,
					})
				)
				const target = uiCountdownStartTs + (maxSecs - i + 1) * 1000
				const waitMs = Math.max(0, target - Date.now())
				if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
			}
			countLabel.visible = false
			countTitle.visible = false
		} catch (_) {
			countLabel.visible = false
			countTitle.visible = false
		}
	}
	async function runRevealCountdown() {
		try {
			const { gsap } = await import('gsap')
			const revealTitle = new Text({
				text: 'Revealing in',
				style: {
					fontFamily: 'system-ui',
					fontSize: 24,
					fill: 0xe6f7ff,
					fontWeight: 'bold',
				},
			})
			revealTitle.anchor = 0.5
			revealTitle.x = Math.round(w / 2)
			revealTitle.y = Math.round(winningRowY - 80)
			const revealLabel = new Text({
				text: '7',
				style: {
					fontFamily: 'system-ui',
					fontSize: 64,
					fill: 0xffe58f,
					fontWeight: 'bold',
				},
			})
			revealLabel.anchor = 0.5
			revealLabel.x = Math.round(w / 2)
			revealLabel.y = Math.round(winningRowY - 40)
			content.addChild(revealTitle)
			content.addChild(revealLabel)
			for (let i = 7; i >= 1; i--) {
				revealLabel.text = String(i)
				await new Promise<void>(resolve =>
					gsap.to(revealLabel.scale, {
						x: 1.08,
						y: 1.08,
						duration: 0.22,
						yoyo: true,
						repeat: 1,
						ease: 'sine.inOut',
						onComplete: resolve,
					})
				)
				await new Promise(r => setTimeout(r, 1000))
			}
			try {
				content.removeChild(revealTitle)
				content.removeChild(revealLabel)
			} catch (_) {}
			root.once('battle:cleanup', () => {
				try {
					revealTitle.destroy()
					revealLabel.destroy()
				} catch (_) {}
			})
		} catch (_) {}
	}
	;(async () => {
		await runSyncedCountdown()
		await onCountdownDone()
		countLabel.visible = false
		dbgLines[3] = 'Status: cancellations-complete'
		setDebug(dbgLines)
	})()
	root.once('battle:cleanup', () => {
		try {
			if (countTimer) {
				clearInterval(countTimer)
				countTimer = null
			}
			countLabel.destroy()
			dbgText.destroy()
			dbgPanel.destroy()
		} catch (_) {}
	})

	const chatPanel = new Graphics()
	const chatText = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 14, fill: 0xe6f7ff },
	})
	const chatW = Math.min(560, Math.round(w * 0.6))
	const chatH = UI_CHAT_H
	chatPanel.roundRect(0, 0, chatW, chatH, 12)
	chatPanel.fill({ color: 0x0a0f12, alpha: 0.9 })
	chatPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
	chatPanel.x = Math.round(w / 2 - chatW / 2)
	chatPanel.y = Math.round(h - chatH - 120)
	chatText.x = chatPanel.x + 12
	chatText.y = chatPanel.y + 10
	content.addChild(chatPanel)
	content.addChild(chatText)
	const messages: { from: string; text: string; ts: number }[] = []
	const renderChat = () => {
		const lines = messages
			.slice(-8)
			.map(m => `${m.from}: ${m.text}`)
			.join('\n')
		chatText.text = lines
	}
	root.on('chatMessage', (m: { from: string; text: string; ts: number }) => {
		messages.push(m)
		renderChat()
		setActive(true)
	})

	const overlay = document.createElement('div')
	overlay.id = 'chatOverlay'
	overlay.style.position = 'fixed'
	overlay.style.right = '24px'
	overlay.style.bottom = '24px'
	overlay.style.transform = 'none'
	overlay.style.display = 'flex'
	overlay.style.alignItems = 'center'
	overlay.style.gap = '8px'
	overlay.style.padding = '8px 10px'
	overlay.style.background = 'rgba(10,15,18,0.9)'
	overlay.style.border = '1px solid #375a44'
	overlay.style.borderRadius = '14px'
	overlay.style.zIndex = '5000'
	overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
	overlay.style.backdropFilter = 'blur(2px)'
	// Draggable logic
	let isDragging = false
	let dragStartX = 0
	let dragStartY = 0
	let initialLeft = 0
	let initialTop = 0

	const onDragStart = (e: MouseEvent | TouchEvent) => {
		const target = e.target as HTMLElement
		// Allow dragging on pill (BUTTON) but handle click vs drag
		if (target.tagName === 'INPUT') return
		// If button is not the pill, prevent drag (e.g. emoji buttons)
		if (target.tagName === 'BUTTON' && target !== pill) return

		isDragging = true
		const clientX =
			'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
		const clientY =
			'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

		dragStartX = clientX
		dragStartY = clientY

		const rect = overlay.getBoundingClientRect()
		initialLeft = rect.left
		initialTop = rect.top

		// Switch to fixed positioning
		overlay.style.right = 'auto'
		overlay.style.bottom = 'auto'
		overlay.style.left = `${initialLeft}px`
		overlay.style.top = `${initialTop}px`
		// cursor change deferred to move
	}

	const onDragMove = (e: MouseEvent | TouchEvent) => {
		if (!isDragging) return

		const clientX =
			'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
		const clientY =
			'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

		const dx = clientX - dragStartX
		const dy = clientY - dragStartY

		// Only consider it a drag if moved > 5px
		if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
			overlay.style.cursor = 'grabbing'
			overlay.style.left = `${initialLeft + dx}px`
			overlay.style.top = `${initialTop + dy}px`
			e.preventDefault()
		}
	}

	const onDragEnd = (e: MouseEvent | TouchEvent) => {
		if (isDragging) {
			const clientX =
				'changedTouches' in e
					? e.changedTouches[0].clientX
					: (e as MouseEvent).clientX
			const clientY =
				'changedTouches' in e
					? e.changedTouches[0].clientY
					: (e as MouseEvent).clientY
			const dx = clientX - dragStartX
			const dy = clientY - dragStartY

			// If minimal movement, treat as click if it was on pill
			if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
				const target = e.target as HTMLElement
				if (target === pill) {
					setCollapsed(!collapsed)
				}
			}
		}
		isDragging = false
		overlay.style.cursor = 'auto'
	}

	overlay.addEventListener('mousedown', onDragStart)
	overlay.addEventListener('touchstart', onDragStart, { passive: false })
	document.addEventListener('mousemove', onDragMove)
	document.addEventListener('touchmove', onDragMove, { passive: false })
	document.addEventListener('mouseup', onDragEnd)
	document.addEventListener('touchend', onDragEnd)

	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'Type a message…'
	input.maxLength = 240
	input.style.width = '280px'
	input.style.padding = '8px 10px'
	input.style.color = '#e6f7ff'
	input.style.background = '#0a0f12'
	input.style.border = '1px solid #334155'
	input.style.borderRadius = '10px'
	input.style.outline = 'none'
	const btn = document.createElement('button')
	btn.textContent = 'Send'
	btn.style.padding = '8px 14px'
	btn.style.background = '#98ffb3'
	btn.style.color = '#000'
	btn.style.border = 'none'
	btn.style.borderRadius = '10px'
	btn.style.cursor = 'pointer'
	const pill = document.createElement('button')
	pill.textContent = 'Chat'
	pill.title = 'Chat'
	pill.style.padding = '6px 12px'
	pill.style.background = '#22303a'
	pill.style.color = '#e6f7ff'
	pill.style.border = '1px solid #334155'
	pill.style.borderRadius = '999px'
	pill.style.cursor = 'pointer'
	pill.style.fontWeight = '600'
	const emojiRow = document.createElement('div')
	emojiRow.style.display = 'flex'
	emojiRow.style.gap = '6px'
	emojiRow.style.alignItems = 'center'
	const emojis = ['🙂', '😎', '🎯', '🚀', '💥', '🏆']
	for (const e of emojis) {
		const b = document.createElement('button')
		b.textContent = e
		b.style.padding = '6px 8px'
		b.style.background = '#334155'
		b.style.color = '#e6f7ff'
		b.style.border = 'none'
		b.style.borderRadius = '6px'
		b.style.cursor = 'pointer'
		b.addEventListener('click', () => {
			input.value = `${(input.value || '').trim()} ${e}`.trim()
			input.focus()
		})
		emojiRow.appendChild(b)
	}
	overlay.appendChild(input)
	overlay.appendChild(emojiRow)
	overlay.appendChild(btn)
	overlay.appendChild(btn)
	overlay.appendChild(pill)
	document.body.appendChild(overlay)
	const submit = () => {
		const text = (input.value || '').trim()
		if (!text) return
		root.emit('sendChat', text)
		messages.push({ from: 'Me', text, ts: Date.now() })
		renderChat()
		input.value = ''
		setActive(true)
	}
	btn.addEventListener('click', submit)
	input.addEventListener('keydown', e => {
		if ((e as KeyboardEvent).key === 'Enter') submit()
	})
	let collapsed = true
	const setCollapsed = (v: boolean) => {
		collapsed = v
		chatPanel.visible = !collapsed
		input.style.display = collapsed ? 'none' : 'block'
		btn.style.display = collapsed ? 'none' : 'inline-block'
		emojiRow.style.display = collapsed ? 'none' : 'flex'
		pill.textContent = collapsed ? 'Chat' : 'Hide'
		pill.title = collapsed ? 'Show chat' : 'Hide chat'
		overlay.style.padding = collapsed ? '6px 10px' : '8px 10px'
		overlay.style.gap = collapsed ? '6px' : '8px'
		input.style.width = collapsed ? '0px' : '280px'
		overlay.style.minWidth = collapsed ? '64px' : 'auto'
		overlay.style.justifyContent = collapsed ? 'center' : 'flex-start'
	}
	pill.addEventListener('click', () => setCollapsed(!collapsed))
	setCollapsed(true)
	let inactiveTimer: any = null
	const setActive = (active: boolean) => {
		overlay.style.opacity = active ? '1' : '0.6'
		if (inactiveTimer) {
			clearTimeout(inactiveTimer)
			inactiveTimer = null
		}
		if (active) {
			inactiveTimer = setTimeout(() => {
				overlay.style.opacity = '0.6'
			}, 8000)
		}
	}
	overlay.addEventListener('mouseenter', () => setActive(true))
	input.addEventListener('focus', () => setActive(true))
	overlay.addEventListener('mouseleave', () => setActive(false))
	root.once('battle:cleanup', () => {
		try {
			document.removeEventListener('mousemove', onDragMove)
			document.removeEventListener('touchmove', onDragMove)
			document.removeEventListener('mouseup', onDragEnd)
			document.removeEventListener('touchend', onDragEnd)

			btn.removeEventListener('click', submit)
			pill.removeEventListener('click', () => setCollapsed(!collapsed))
			input.remove()
			btn.remove()
			emojiRow.remove()
			pill.remove()
			overlay.remove()
		} catch (_) {}
	})

	return root
}
