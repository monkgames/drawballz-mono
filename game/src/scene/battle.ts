import { Container, Graphics, Text } from 'pixi.js'
import { createBall } from '@/modules/ball'
import { getAudioContext, duckBGMTemporary } from '@/audio/bgm'

type BallColor = 'green' | 'pink' | 'orange' | 'yellow' | 'blue'
type BattleBall = { color: BallColor; number: number }

interface BattlePhase {
	type: 'symmetric' | 'color' | 'number'
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
	multipliersArg?: Record<number, number>
) {
	const root = new Container()
	const content = new Container()
	content.sortableChildren = true
	root.addChild(content)
	const API = String(apiBase || window.location.origin)
	const DISABLE_COUNTDOWN = true
	const UI_CHAT_H = 160
	const UI_WIN_PANEL_H = 150
	const UI_WIN_PANEL_MARGIN = 24
	const PLAYER_SCALE_MUL = 0.5
	let colorWeights: Record<BallColor, number> = {
		green: 1,
		pink: 2,
		orange: 3,
		yellow: 4,
		blue: 5,
	}
	const chatTopY = Math.round(h - UI_CHAT_H - 120)
	const playersRowY = Math.max(220, Math.round(h * 0.35))
	const winningRowY = Math.min(
		Math.round(
			chatTopY - Math.round(UI_WIN_PANEL_H / 2) - UI_WIN_PANEL_MARGIN
		),
		playersRowY + Math.round(196 * 1.8)
	)
	const titleY = Math.max(180, winningRowY - 40)

	const bg = new Graphics()
	bg.rect(0, 0, w, h)
	bg.fill({ color: 0x2b1400 })
	content.addChild(bg)

	const midX = Math.round(w / 2)
	const divider = new Graphics()
	divider.moveTo(midX, 60)
	divider.lineTo(midX, h - 60)
	divider.stroke({ color: 0x22303a, width: 2, alpha: 0.9 })
	content.addChild(divider)

	const leftTitle = new Text({
		text: selfName || 'You',
		style: { fontFamily: 'system-ui', fontSize: 28, fill: 0xe6f7ff },
	})
	leftTitle.anchor = 0.5
	leftTitle.x = Math.round(w * 0.25)
	leftTitle.y = 80
	content.addChild(leftTitle)

	const oppBadgeW = 160
	const oppBadgeH = 44
	const oppBadge = new Graphics()
	oppBadge.roundRect(0, 0, oppBadgeW, oppBadgeH, 12)
	oppBadge.fill({ color: 0x0a0f12, alpha: 0.9 })
	oppBadge.stroke({ color: 0xff4d4f, width: 3, alpha: 0.9 })
	oppBadge.x = Math.round(w * 0.75 - oppBadgeW / 2)
	oppBadge.y = Math.round(64)
	const oppLabel = new Text({
		text: opponentName || 'Opponent',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
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
					fontSize: 22,
					fill: 0x98ffb3,
				},
			})
			numberLabel.anchor = 0.5
			numberLabel.x = ball.x
			numberLabel.y = Math.round(
				ball.y - targetWidth * 0.28 * PLAYER_SCALE_MUL
			)
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
	const dbgW = Math.min(320, Math.round(w * 0.36))
	const dbgH = 140
	dbgPanel.roundRect(0, 0, dbgW, dbgH, 12)
	dbgPanel.fill({ color: 0x0a0f12, alpha: 0.9 })
	dbgPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
	dbgPanel.x = Math.round(w - dbgW - 24)
	dbgPanel.y = Math.round(h - dbgH - 24)
	dbgText.x = dbgPanel.x + 12
	dbgText.y = dbgPanel.y + 10
	content.addChild(dbgPanel)
	content.addChild(dbgText)
	const weightsPanel = new Graphics()
	const weightsText = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 14, fill: 0xe6f7ff },
	})
	const weightsW = Math.min(280, Math.round(w * 0.34))
	const weightsH = 170
	weightsPanel.roundRect(0, 0, weightsW, weightsH, 12)
	weightsPanel.fill({ color: 0x0a0f12, alpha: 0.9 })
	weightsPanel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
	weightsPanel.x = 24
	weightsPanel.y = Math.round(h - weightsH - 24)
	weightsText.x = weightsPanel.x + 12
	weightsText.y = weightsPanel.y + 10
	content.addChild(weightsPanel)
	content.addChild(weightsText)
	const setWeightsText = () => {
		const lines = [
			'Weights',
			'',
			'green: ' + String(colorWeights.green || 0),
			'pink: ' + String(colorWeights.pink || 0),
			'orange: ' + String(colorWeights.orange || 0),
			'yellow: ' + String(colorWeights.yellow || 0),
			'blue: ' + String(colorWeights.blue || 0),
		]
		weightsText.text = lines.join('\n')
	}
	setWeightsText()
	;(async () => {
		try {
			const res = await fetch(`${API}/weights`).catch(() => null)
			const j = await res?.json().catch(() => null)
			const map = (j as any)?.weights || null
			if (map && typeof map === 'object') {
				colorWeights = {
					green: Number(map.green) || colorWeights.green,
					pink: Number(map.pink) || colorWeights.pink,
					orange: Number(map.orange) || colorWeights.orange,
					yellow: Number(map.yellow) || colorWeights.yellow,
					blue: Number(map.blue) || colorWeights.blue,
				}
			}
		} catch (_) {}
		setWeightsText()
	})()
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
	countLabel.anchor = 0.5
	countLabel.x = Math.round(w / 2)
	countLabel.y = Math.round(h * 0.24)
	content.addChild(countLabel)
	const countTitle = new Text({
		text: 'Cancellations in',
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
	async function applyCancellations() {
		try {
			const byColorLeft = new Map<string, { idx: number; it: any }>()
			for (let i = 0; i < leftItems.length; i++) {
				const it = leftItems[i]
				byColorLeft.set(it.bb.color, { idx: i, it })
			}
			const cancelled: {
				color: string
				leftIdx: number
				rightIdx: number
			}[] = []
			for (let j = 0; j < rightItems.length; j++) {
				const r = rightItems[j]
				const l = byColorLeft.get(r.bb.color)
				if (l && l.it.bb.number === r.bb.number) {
					cancelled.push({
						color: r.bb.color,
						leftIdx: l.idx,
						rightIdx: j,
					})
				}
			}
			const limited = cancelled.slice(0, 2)
			if (limited.length > 0) {
				dbgLines[3] = 'Status: cancelling'
				setDebug([
					dbgLines[0],
					dbgLines[1],
					dbgLines[2],
					dbgLines[3],
					'Cancelled: ' + String(limited.length),
				])
				const { gsap } = await import('gsap')
				const ac = getAudioContext()
				const playBeep = () => {
					if (!ac) return
					try {
						const t = ac.currentTime
						const osc = ac.createOscillator()
						const g = ac.createGain()
						osc.type = 'sine'
						osc.frequency.setValueAtTime(740, t)
						g.gain.setValueAtTime(0.06, t)
						osc.connect(g).connect(ac.destination)
						duckBGMTemporary(0.12, 0.01, 0.18, 0.15)
						osc.start(t)
						osc.stop(t + 0.18)
						setTimeout(() => {
							try {
								osc.disconnect()
								g.disconnect()
							} catch (_) {}
						}, 240)
					} catch (_) {}
				}
				const pairs = limited.map(c => {
					const L = leftItems[c.leftIdx]
					const R = rightItems[c.rightIdx]
					const ringL = new Graphics()
					const ringR = new Graphics()
					const rL = Math.max(18, Math.floor(L.node.width * 0.55))
					const rR = Math.max(18, Math.floor(R.node.width * 0.55))
					ringL.circle(0, 0, rL)
					ringL.stroke({ color: 0x98ffb3, width: 3, alpha: 0.0 })
					ringL.x = L.node.x
					ringL.y = L.node.y
					ringR.circle(0, 0, rR)
					ringR.stroke({ color: 0x98ffb3, width: 3, alpha: 0.0 })
					ringR.x = R.node.x
					ringR.y = R.node.y
					content.addChild(ringL)
					content.addChild(ringR)
					try {
						L.label.style.fill = 0xffe58f
						R.label.style.fill = 0xffe58f
					} catch (_) {}
					return { L, R, ringL, ringR }
				})
				await new Promise(r => setTimeout(r, 800))
				playBeep()
				await Promise.all(
					pairs.flatMap(p => [
						new Promise<void>(resolve =>
							gsap.to(p.ringL, {
								alpha: 1,
								duration: 0.35,
								ease: 'power2.out',
								onComplete: resolve,
							})
						),
						new Promise<void>(resolve =>
							gsap.to(p.ringR, {
								alpha: 1,
								duration: 0.35,
								ease: 'power2.out',
								onComplete: resolve,
							})
						),
					])
				)
				await Promise.all(
					pairs.flatMap(p => [
						new Promise<void>(resolve =>
							gsap.to(p.ringL.scale, {
								x: 1.15,
								y: 1.15,
								duration: 0.5,
								yoyo: true,
								repeat: 1,
								ease: 'sine.inOut',
								onComplete: resolve,
							})
						),
						new Promise<void>(resolve =>
							gsap.to(p.ringR.scale, {
								x: 1.15,
								y: 1.15,
								duration: 0.5,
								yoyo: true,
								repeat: 1,
								ease: 'sine.inOut',
								onComplete: resolve,
							})
						),
					])
				)
				const midX = Math.round(w / 2)
				const elimY = Math.round(chatTopY - 20)
				await Promise.all(
					pairs.flatMap((p, i) => {
						const offset = Math.round(12 * i)
						const targetXL = Math.round(midX - 12 - offset)
						const targetXR = Math.round(midX + 12 + offset)
						return [
							new Promise<void>(resolve =>
								gsap.to(p.L.node, {
									x: p.L.node.x + 8,
									duration: 0.06,
									yoyo: true,
									repeat: 8,
									ease: 'sine.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.L.label, {
									x: p.L.label.x + 8,
									duration: 0.06,
									yoyo: true,
									repeat: 8,
									ease: 'sine.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.R.node, {
									x: p.R.node.x + 8,
									duration: 0.06,
									yoyo: true,
									repeat: 8,
									ease: 'sine.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.R.label, {
									x: p.R.label.x + 8,
									duration: 0.06,
									yoyo: true,
									repeat: 8,
									ease: 'sine.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.L.node, {
									x: targetXL,
									y: elimY,
									duration: 0.9,
									ease: 'power2.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.R.node, {
									x: targetXR,
									y: elimY,
									duration: 0.9,
									ease: 'power2.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.L.label, {
									x: targetXL,
									y: Math.round(
										elimY -
											p.L.node.width *
												0.28 *
												PLAYER_SCALE_MUL
									),
									duration: 0.9,
									ease: 'power2.inOut',
									onComplete: resolve,
								})
							),
							new Promise<void>(resolve =>
								gsap.to(p.R.label, {
									x: targetXR,
									y: Math.round(
										elimY -
											p.R.node.width *
												0.28 *
												PLAYER_SCALE_MUL
									),
									duration: 0.9,
									ease: 'power2.inOut',
									onComplete: resolve,
								})
							),
						]
					})
				)
				playBeep()
				await Promise.all(
					pairs.flatMap(p => [
						new Promise<void>(resolve =>
							gsap.to(p.L.node, {
								alpha: 0,
								duration: 0.8,
								scaleX: (p.L.node.scale as any).x * 0.7,
								scaleY: (p.L.node.scale as any).y * 0.7,
								ease: 'power2.in',
								onComplete: resolve,
							} as any)
						),
						new Promise<void>(resolve =>
							gsap.to(p.R.node, {
								alpha: 0,
								duration: 0.8,
								scaleX: (p.R.node.scale as any).x * 0.7,
								scaleY: (p.R.node.scale as any).y * 0.7,
								ease: 'power2.in',
								onComplete: resolve,
							} as any)
						),
						new Promise<void>(resolve =>
							gsap.to(p.L.label, {
								alpha: 0,
								duration: 0.6,
								ease: 'power2.in',
								onComplete: resolve,
							})
						),
						new Promise<void>(resolve =>
							gsap.to(p.R.label, {
								alpha: 0,
								duration: 0.6,
								ease: 'power2.in',
								onComplete: resolve,
							})
						),
					])
				)
				try {
					for (const p of pairs) {
						content.removeChild(p.ringL)
						content.removeChild(p.ringR)
					}
				} catch (_) {}

				// Remove cancelled
				const leftKeep = leftItems.filter(
					(_, i) => !limited.some(c => c.leftIdx === i)
				)
				const rightKeep = rightItems.filter(
					(_, j) => !limited.some(c => c.rightIdx === j)
				)
				// Remove nodes from scene
				for (const it of leftItems) {
					if (!leftKeep.includes(it)) {
						try {
							content.removeChild(it.node)
							content.removeChild(it.label)
						} catch (_) {}
					}
				}
				for (const it of rightItems) {
					if (!rightKeep.includes(it)) {
						try {
							content.removeChild(it.node)
							content.removeChild(it.label)
						} catch (_) {}
					}
				}
				leftItems.splice(0, leftItems.length, ...leftKeep)
				rightItems.splice(0, rightItems.length, ...rightKeep)
				layoutRow(leftItems, Math.round(w * 0.25), playersRowY)
				layoutRow(rightItems, Math.round(w * 0.75), playersRowY)
				// Show remaining counts
				const leftCount = new Text({
					text: `Remaining: ${leftItems.length}`,
					style: {
						fontFamily: 'system-ui',
						fontSize: 16,
						fill: 0x98ffb3,
					},
				})
				leftCount.anchor = 0.5
				leftCount.x = Math.round(w * 0.25)
				leftCount.y = Math.round(playersRowY - 72)
				content.addChild(leftCount)
				const rightCount = new Text({
					text: `Remaining: ${rightItems.length}`,
					style: {
						fontFamily: 'system-ui',
						fontSize: 16,
						fill: 0x98ffb3,
					},
				})
				rightCount.anchor = 0.5
				rightCount.x = Math.round(w * 0.75)
				rightCount.y = Math.round(playersRowY - 72)
				content.addChild(rightCount)
				dbgLines[3] = 'Status: cancellations-complete'
				setDebug([
					dbgLines[0],
					dbgLines[1],
					dbgLines[2],
					dbgLines[3],
					'Left remaining: ' + String(leftItems.length),
					'Right remaining: ' + String(rightItems.length),
				])
			}
		} catch (_) {}
	}
	const { gsap } = await import('gsap')
	const ac = getAudioContext()
	const playBeep = () => {
		if (!ac) return
		try {
			const t = ac.currentTime
			const osc = ac.createOscillator()
			const g = ac.createGain()
			osc.type = 'sine'
			osc.frequency.setValueAtTime(740, t)
			g.gain.setValueAtTime(0.06, t)
			osc.connect(g).connect(ac.destination)
			duckBGMTemporary(0.12, 0.01, 0.18, 0.15)
			osc.start(t)
			osc.stop(t + 0.18)
			setTimeout(() => {
				try {
					osc.disconnect()
					g.disconnect()
				} catch (_) {}
			}, 240)
		} catch (_) {}
	}
	const showCountdown = async (txt: string, secs: number) => {
		const title = new Text({
			text: txt,
			style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
		})
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
		const allLeftItems = [...leftItems]
		const allRightItems = [...rightItems]
		const eliminated = new Set<any>()

		for (const phase of res.phases) {
			let label = ''
			let duration = 3
			if (phase.type === 'symmetric') label = 'Symmetric cancellation in'
			if (phase.type === 'color') {
				label = 'Color cancellation in'
				duration = 5
			}
			if (phase.type === 'number') label = 'Number cancellation in'

			dbgLines[3] = `Status: ${phase.type}-pending`
			setDebug(dbgLines)
			await showCountdown(label, duration)

			dbgLines[3] = `Status: ${phase.type}-cancelling`
			setDebug(dbgLines)

			// Countdown / Phase Title
			const phaseName =
				phase.type === 'symmetric'
					? 'EXACT MATCH'
					: phase.type === 'color'
					? 'COLOR CLASH'
					: 'NUMBER CLASH'

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
			const anims: any[] = []
			const elimY = Math.round(chatTopY - 20)

			for (const p of pairs) {
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
					// Randomization Animation
					const dur = 1.5
					const obj = { val: 0 }
					const finalL = p.randVals.left
					const finalR = p.randVals.right

					// Spin numbers
					anims.push(
						gsap.to(obj, {
							val: 100,
							duration: dur,
							ease: 'none',
							onUpdate: () => {
								// Random flicker effect
								p.L.label.text = Math.floor(
									Math.random() * 100
								).toString()
								p.R.label.text = Math.floor(
									Math.random() * 100
								).toString()
							},
							onComplete: () => {
								p.L.label.text = finalL.toString()
								p.R.label.text = finalR.toString()
							},
						})
					)

					// Wait for spin to finish before cancelling
					// We can chain animations or use delay.
					// Since we push to `anims` and await Promise.all(anims), they run in parallel.
					// We need to sequence the cancellation AFTER the spin.

					// Instead of pushing directly, we can create a timeline or a promise chain.
					// But `anims` expects promises.

					const seq = (async () => {
						// 1. Spin
						await new Promise<void>(resolve => {
							gsap.to(obj, {
								val: 100,
								duration: dur,
								ease: 'none',
								onUpdate: () => {
									p.L.label.text = Math.floor(
										Math.random() * 100
									).toString()
									p.R.label.text = Math.floor(
										Math.random() * 100
									).toString()
								},
								onComplete: () => {
									p.L.label.text = finalL.toString()
									p.R.label.text = finalR.toString()
									resolve()
								},
							})
						})

						// 2. Short pause
						await new Promise(r => setTimeout(r, 300))

						// 3. Cancel the loser
						const subAnims: any[] = []
						if (finalL > finalR) {
							// Cancel Left
							eliminated.add(p.L)
							subAnims.push(
								gsap.to(p.L.node, {
									x: w / 2 - 20,
									y: elimY,
									alpha: 0,
									duration: 0.8,
								}),
								gsap.to(p.L.label, { alpha: 0, duration: 0.5 }),
								gsap.to(p.ringL, { alpha: 0, duration: 0.5 }),
								gsap.to(p.ringR, { alpha: 0, duration: 0.5 }) // Hide winner ring too
							)
						} else {
							// Cancel Right
							eliminated.add(p.R)
							subAnims.push(
								gsap.to(p.R.node, {
									x: w / 2 + 20,
									y: elimY,
									alpha: 0,
									duration: 0.8,
								}),
								gsap.to(p.R.label, { alpha: 0, duration: 0.5 }),
								gsap.to(p.ringR, { alpha: 0, duration: 0.5 }),
								gsap.to(p.ringL, { alpha: 0, duration: 0.5 })
							)
						}
						await Promise.all(subAnims)
					})()

					anims.push(seq)
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
			}
			await Promise.all(anims)

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
				numberMax: 99,
				maxMaskSize: 5,
			}
			const betRaw = localStorage.getItem('betAmount') || ''
			const betAmt = Math.max(1, Math.floor(Number(betRaw) || 0))
			const playerA = {
				id: 'A',
				balls: selfBalls.map(b => ({
					number: b.number,
					color: toColorCode(b.color),
				})),
				betAmount: betAmt,
			}
			const playerB = {
				id: 'B',
				balls: opponentBalls.map(b => ({
					number: b.number,
					color: toColorCode(b.color),
				})),
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
			await runBattleSequence({ phases: out?.phases || [] })
			dbgLines[3] = 'Status: reveal-pending'
			setDebug(dbgLines)
			await runRevealCountdown()
			if (out && Array.isArray(out.winningMask)) {
				const title = new Text({
					text: 'Winning Set',
					style: {
						fontFamily: 'system-ui',
						fontSize: 26,
						fill: 0xe6f7ff,
					},
				})
				title.anchor = 0.5
				title.x = Math.round(w / 2)
				const panelW = Math.min(620, Math.round(w * 0.72))
				const panelH = UI_WIN_PANEL_H
				const panel = new Graphics()
				panel.roundRect(0, 0, panelW, panelH, 16)
				panel.fill({ color: 0x0a0f12, alpha: 0.8 })
				panel.stroke({ color: 0x98ffb3, width: 2, alpha: 0.7 })
				panel.x = Math.round(w / 2 - panelW / 2)
				panel.y = Math.round(winningRowY - panelH / 2)
				title.y = Math.round(panel.y - 22)
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
					const scaleMul = Math.min(1, targetW / baseW)
					;(it.node.scale as any).set?.(
						((it.node.scale as any).x || 1) * scaleMul
					)
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
								((it.node.scale as any).y || 1)
					)
					it.node.x = x
					it.node.y = y
					it.label.x = x
					it.label.y = Math.round(y - targetW * 0.28)
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
					fontSize: 18,
					fill: 0xe6f7ff,
				},
			})
			revealTitle.anchor = 0.5
			revealTitle.x = Math.round(w / 2)
			revealTitle.y = Math.round(winningRowY - 80)
			const revealLabel = new Text({
				text: '7',
				style: {
					fontFamily: 'system-ui',
					fontSize: 56,
					fill: 0xffe58f,
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
		await applyCancellations()
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
	overlay.style.zIndex = '9999'
	overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
	overlay.style.backdropFilter = 'blur(2px)'
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
