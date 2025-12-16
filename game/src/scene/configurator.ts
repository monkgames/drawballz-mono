import {
	Container,
	Graphics,
	Text,
	Sprite,
	Assets,
	Texture,
	Point,
} from 'pixi.js'
import { createBall } from '@/modules/ball'
import { gsap } from 'gsap'
import { duckBGMTemporary, getAudioContext } from '@/audio/bgm'

type BallColor = 'green' | 'pink' | 'orange' | 'yellow' | 'blue'

async function loadConfigBackgroundTexture(): Promise<Texture | null> {
	const candidates = [
		'/assets/bg/bg_config.webp',
		'/assets/bg/bg_config.png',
		'/assets/bg/bg_config.jpg',
		'/bg/bg_config.webp',
		'/bg/bg_config.png',
		'/bg/bg_config.jpg',
	]
	for (const url of candidates) {
		try {
			const tex = await Assets.load(url)
			if (tex) return tex as Texture
		} catch (_) {}
	}
	return null
}

export async function createConfiguratorScene(
	w: number,
	h: number,
	color: BallColor,
	playerId: 'A' | 'B',
	usedColors: BallColor[] = ['green', 'pink', 'orange', 'yellow', 'blue'],
	slotIndex: number = 0,
	originalColor?: BallColor
) {
	const root = new Container()
	const content = new Container()
	root.addChild(content)
	const bgTex = await loadConfigBackgroundTexture()
	if (bgTex) {
		const sprite = new Sprite({ texture: bgTex })
		sprite.anchor = 0.5
		sprite.x = Math.round(w / 2)
		sprite.y = Math.round(h / 2)
		const s = Math.max(w / bgTex.width, h / bgTex.height)
		sprite.scale.set(s)
		content.addChildAt(sprite, 0)
	} else {
		const bg = new Graphics()
		bg.rect(0, 0, w, h)
		bg.fill({ color: 0x0e0e12 })
		content.addChild(bg)
	}
	let center = await createBall(color)
	center.scale.set(0.45)
	center.x = Math.round(w / 2)
	center.y = Math.round(h / 2)
	content.addChild(center)
	gsap.to(center, {
		rotation: 0.02,
		yoyo: true,
		repeat: -1,
		duration: 4.0,
		ease: 'sine.inOut',
	})
	gsap.to(center.scale, {
		x: center.scale.x * 1.03,
		y: center.scale.y * 1.03,
		yoyo: true,
		repeat: -1,
		duration: 3.2,
		ease: 'sine.inOut',
	})
	const numberLabel = new Text({
		text: 'SELECT NUMBER',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	numberLabel.anchor = 0.5
	numberLabel.x = Math.round(w * 0.17)
	numberLabel.y = Math.round(h * 0.26)
	numberLabel.roundPixels = true
	numberLabel.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(numberLabel)
	const panel = new Container()
	panel.x = Math.round(w * 0.84)
	panel.y = Math.round(h * 0.5)
	content.addChild(panel)
	const frameW = Math.round(w * 0.08)
	const frameH = Math.round(h * 0.6)
	const frame = new Graphics()
	frame.roundRect(-frameW / 2, -frameH / 2, frameW, frameH, 16)
	frame.fill({ color: 0x0a0f12, alpha: 0.8 })
	frame.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	panel.addChild(frame)
	const selector = new Graphics()
	selector.roundRect(frameW / 2 + 14, -22, 12, 44, 6)
	selector.fill({ color: 0xffd400 })
	selector.stroke({ color: 0xffd400, width: 1 })
	panel.addChild(selector)
	const numbers: number[] = Array.from({ length: 99 }, (_, i) => i + 1)
	const spacing = Math.round(frameH / 8)
	const slotsY = [-2, -1, 0, 1, 2].map(m => m * spacing)
	const slots: { chip: Graphics; text: Text }[] = []
	for (let i = 0; i < slotsY.length; i++) {
		const chip = new Graphics()
		chip.roundRect(-frameW / 2 + 8, -20, frameW - 16, 40, 10)
		chip.fill({ color: 0x0a0f12, alpha: i === 2 ? 0.9 : 0.75 })
		chip.stroke({
			color: 0x98ffb3,
			width: i === 2 ? 3 : 2,
			alpha: i === 2 ? 1 : 0.6,
		})
		chip.y = slotsY[i]
		chip.eventMode = 'static'
		chip.cursor = 'pointer'
		const t = new Text({
			text: '00',
			style: {
				fontFamily: 'system-ui',
				fontSize: i === 2 ? 32 : 26,
				fill: 0xe6f7ff,
			},
		})
		t.anchor = 0.5
		t.x = 0
		t.y = chip.y
		chip.on('pointertap', () => {
			selectedIndex = clampIndex(selectedIndex - 2 + i)
			renderSlots()
		})
		panel.addChild(chip)
		panel.addChild(t)
		slots.push({ chip, text: t })
	}
	const currentCircle = new Graphics()
	currentCircle.circle(0, 0, Math.max(center.width, center.height) * 0.064)
	currentCircle.fill({ color: 0x000000, alpha: 0.85 })
	currentCircle.x = center.x
	currentCircle.y = center.y
	content.addChild(currentCircle)
	const currentText = new Text({
		text: '01',
		style: { fontFamily: 'system-ui', fontSize: 48, fill: 0x98ffb3 },
	})
	currentText.anchor = 0.5
	currentText.x = currentCircle.x
	currentText.y = currentCircle.y
	currentText.roundPixels = true
	currentText.resolution = Math.min(window.devicePixelRatio || 1, 2)
	content.addChild(currentText)

	// Top status header and countdown
	const header = new Container()
	header.x = Math.round(w * 0.5)
	header.y = Math.round(h * 0.08)
	content.addChild(header)
	const dot = new Graphics()
	dot.circle(0, 0, 6)
	dot.fill({ color: 0x00ff66 })
	dot.x = -120
	header.addChild(dot)
	const title = new Text({
		text: 'LIVEBET WINDS UPS',
		style: { fontFamily: 'system-ui', fontSize: 20, fill: 0xe6f7ff },
	})
	title.anchor = 0.5
	title.x = 0
	title.y = 0
	header.addChild(title)
	const countdownPill = new Graphics()
	countdownPill.roundRect(-90, -18, 180, 36, 12)
	countdownPill.fill({ color: 0x0a0f12, alpha: 0.7 })
	countdownPill.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	countdownPill.x = Math.round(w * 0.5)
	const countdownY = Math.round(header.y + 44)
	countdownPill.y = countdownY
	content.addChild(countdownPill)
	const countdownText = new Text({
		text: 'Countdown 10',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	countdownText.anchor = 0.5
	countdownText.x = countdownPill.x
	countdownText.y = countdownPill.y
	content.addChild(countdownText)
	const loader = new Graphics()
	const loaderR = 14
	loader.x = Math.round(countdownPill.x - 90 - loaderR - 12)
	loader.y = countdownPill.y
	content.addChild(loader)
	const renderLoader = (p: number) => {
		if (!(loader as any)) return
		loader.clear()
		loader.circle(0, 0, loaderR)
		loader.stroke({ color: 0x98ffb3, width: 2, alpha: 0.18 })
		loader.arc(0, 0, loaderR, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2)
		loader.stroke({ color: 0x98ffb3, width: 3, alpha: 0.9 })
	}
	const progress = { v: 0 }
	renderLoader(0)
	const tween = gsap.to(progress, {
		v: 1,
		duration: 10,
		ease: 'linear',
		onUpdate: () => {
			const remain = Math.max(0, 10 - Math.floor(progress.v * 10))
			countdownText.text = `Countdown ${remain}`
			renderLoader(progress.v)
		},
	})
	root.on('destroyed', () => {
		try {
			tween.kill()
		} catch (_) {}
	})

	// Left options (Color / Number)
	const leftOptions = new Container()
	leftOptions.x = Math.round(w * 0.12)
	leftOptions.y = Math.round(h * 0.5)
	content.addChild(leftOptions)
	const optSpacing = 80
	const makeOption = (label: string, idx: number) => {
		const chip = new Graphics()
		chip.roundRect(-70, -24, 140, 48, 12)
		chip.fill({ color: 0x0a0f12, alpha: 0.7 })
		chip.stroke({ color: 0x98ffb3, width: 2, alpha: 0.5 })
		chip.y = idx * optSpacing - optSpacing
		const t = new Text({
			text: label,
			style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xe6f7ff },
		})
		t.anchor = 0.5
		t.x = 0
		t.y = chip.y + 24
		chip.eventMode = 'static'
		chip.cursor = 'pointer'
		leftOptions.addChild(chip)
		leftOptions.addChild(t)
		return { chip, text: t }
	}
	const optColor = makeOption('SELECT COLOR', 0)
	const optNumber = makeOption('SELECT NUMBER', 1)
	let activeTab: 'color' | 'number' = 'color'
	const setTab = (tab: 'color' | 'number') => {
		activeTab = tab
		numberLabel.visible = tab === 'number'
		panel.visible = tab === 'number'
		colorPanel.visible = tab === 'color'
		optColor.chip.alpha = tab === 'color' ? 0.9 : 0.7
		optColor.text.alpha = tab === 'color' ? 1 : 0.85
		optNumber.chip.alpha = tab === 'number' ? 0.9 : 0.7
		optNumber.text.alpha = tab === 'number' ? 1 : 0.85
	}
	optColor.chip.on('pointertap', () => setTab('color'))
	optNumber.chip.on('pointertap', () => setTab('number'))
	let selectedIndex = 0
	const renderSlots = () => {
		const base = selectedIndex - 2
		for (let i = 0; i < slots.length; i++) {
			const idx = Math.max(1, Math.min(99, base + i + 1)) - 1
			const val = numbers[idx]
			slots[i].text.text = `${String(val).padStart(2, '0')}`
			slots[i].text.style.fontSize = i === 2 ? 28 : 24
			slots[i].text.alpha = i === 2 ? 1 : 0.9
			slots[i].chip.alpha = i === 2 ? 0.85 : 0.6
			slots[i].chip.stroke({
				color: 0x98ffb3,
				width: i === 2 ? 3 : 2,
				alpha: i === 2 ? 0.9 : 0.4,
			})
		}
		currentText.text = `${String(numbers[selectedIndex]).padStart(2, '0')}`
	}
	const clampIndex = (i: number) =>
		Math.max(0, Math.min(numbers.length - 1, i))
	renderSlots()
	panel.eventMode = 'static'
	panel.cursor = 'grab'
	let dragging = false
	let startY = 0
	let accum = 0
	panel.on('pointerdown', (ev: any) => {
		dragging = true
		panel.cursor = 'grabbing'
		const pt = panel.toLocal(new Point(ev.globalX, ev.globalY))
		startY = pt.y
		accum = 0
	})
	const onMove = (ev: any) => {
		if (!dragging) return
		const pt = panel.toLocal(new Point(ev.globalX, ev.globalY))
		const dy = pt.y - startY
		const delta = Math.round(dy / spacing)
		if (delta !== 0) {
			startY = pt.y
			selectedIndex = clampIndex(selectedIndex - delta)
			renderSlots()
		}
	}
	const onUp = () => {
		if (!dragging) return
		dragging = false
		panel.cursor = 'grab'
		renderSlots()
	}
	panel.on('pointermove', onMove)
	panel.on('pointerup', onUp)
	panel.on('pointerupoutside', onUp)
	const colors = ['green', 'pink', 'orange', 'yellow', 'blue'] as const
	const colorPanel = new Container()
	colorPanel.x = panel.x
	colorPanel.y = panel.y
	content.addChild(colorPanel)
	const frame2 = new Graphics()
	frame2.roundRect(-frameW / 2, -frameH / 2, frameW, frameH, 16)
	frame2.fill({ color: 0x0a0f12, alpha: 0.8 })
	frame2.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	colorPanel.addChild(frame2)
	const colorSlots: { chip: Graphics; item: Container; key: BallColor }[] = []
	const controlSpacing = Math.round((frameH - 40) / colors.length)
	for (let i = 0; i < slotsY.length; i++) {
		const slotY =
			-frameH / 2 +
			20 +
			i * controlSpacing +
			Math.round(controlSpacing / 2)
		const chip = new Graphics()
		chip.roundRect(-frameW / 2 + 8, -28, frameW - 16, 56, 12)
		chip.fill({ color: 0x0a0f12, alpha: 0.8 })
		chip.stroke({
			color: 0x98ffb3,
			width: 2,
			alpha: 0.6,
		})
		chip.y = slotY
		const item = new Container()
		item.y = slotY
		item.eventMode = 'static'
		item.cursor = 'pointer'
		const k = colors[i] as BallColor
		const pv = await createBall(k, { noFX: true })
		pv.scale.set(0.18)
		pv.x = 0
		pv.y = 0
		item.addChild(pv)
		item.on('pointertap', (ev: any) => {
			try {
				console.log('Configurator/color chip tapped', { pick: k })
				ev?.stopPropagation?.()
			} catch (_) {}
			void (async () => {
				const currentUsed = usedColors.filter(c => c !== color)
				if (currentUsed.includes(k)) {
					try {
						console.log('Configurator/color disabled', {
							pick: k,
							usedColors,
							originalColor,
						})
					} catch (_) {}
					errorLabel.text = 'Color already used'
					errorLabel.alpha = 1
					gsap.fromTo(
						errorLabel,
						{ alpha: 0.0, y: errorLabel.y - 6 },
						{ alpha: 1, y: errorLabel.y, duration: 0.18 }
					)
					gsap.to(errorLabel, { alpha: 0, delay: 1.2, duration: 0.3 })
					return
				}
				const b = await createBall(k, { noFX: true })
				b.scale.set(center.scale.x)
				b.x = center.x
				b.y = center.y
				content.addChild(b)
				try {
					content.removeChild(center)
					;(center as any)?.destroy?.({ children: true })
				} catch (_) {}
				center = b
				color = k
				currentCircle.x = center.x
				currentCircle.y = center.y
				currentText.x = center.x
				currentText.y = center.y
				renderColorSlots()
			})()
		})
		colorPanel.addChild(chip)
		colorPanel.addChild(item)
		colorSlots.push({ chip, item, key: k })
	}
	const renderColorSlots = () => {
		for (let i = 0; i < colorSlots.length; i++) {
			const s = colorSlots[i]
			s.chip.stroke({
				color: s.key === color ? 0x98ffb3 : 0x334155,
				width: s.key === color ? 3 : 2,
				alpha:
					usedColors
						.filter(c => c !== (originalColor || color))
						.includes(s.key) && s.key !== color
						? 0.25
						: s.key === color
						? 0.9
						: 0.5,
			})
			const disabled =
				usedColors
					.filter(c => c !== (originalColor || color))
					.includes(s.key) && s.key !== color
			s.item.alpha = disabled ? 0.5 : s.key === color ? 1 : 0.95
			s.item.cursor = disabled ? 'not-allowed' : 'pointer'
		}
	}
	renderColorSlots()
	setTab('color')
	const errorLabel = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xff4d4f },
	})
	errorLabel.anchor = 0.5
	errorLabel.x = Math.round(w / 2)
	errorLabel.y = Math.round(h * 0.86)
	errorLabel.alpha = 0
	content.addChild(errorLabel)
	const mintBtn = new Graphics()
	mintBtn.roundRect(0, 0, 220, 50, 12)
	mintBtn.fill({ color: 0xff6b00, alpha: 0.9 })
	mintBtn.x = Math.round(w * 0.5 - 110)
	mintBtn.y = Math.round(h * 0.9)
	mintBtn.eventMode = 'static'
	mintBtn.cursor = 'pointer'
	content.addChild(mintBtn)
	const mintLabel = new Text({
		text: 'SAVE',
		style: { fontFamily: 'system-ui', fontSize: 20, fill: 0x000000 },
	})
	mintLabel.anchor = 0.5
	mintLabel.x = Math.round(mintBtn.x + 110)
	mintLabel.y = Math.round(mintBtn.y + 25)
	content.addChild(mintLabel)
	mintBtn.on('pointertap', async (ev: any) => {
		const ac = getAudioContext()
		if (ac) duckBGMTemporary(0.06, 0.02, 0.4, 0.28)
		const number = Math.max(
			1,
			Math.min(99, Number(String(numbers[selectedIndex])))
		)
		const currentUsed = usedColors.filter(
			c => c !== (originalColor || color)
		)
		if (currentUsed.includes(color)) {
			try {
				console.log('Configurator/save blocked (duplicate)', {
					color,
					number,
					usedColors,
					originalColor,
				})
			} catch (_) {}
			errorLabel.text = 'Color already used'
			errorLabel.alpha = 1
			gsap.fromTo(
				errorLabel,
				{ alpha: 0.0, y: errorLabel.y - 6 },
				{ alpha: 1, y: errorLabel.y, duration: 0.18 }
			)
			gsap.to(errorLabel, { alpha: 0, delay: 1.2, duration: 0.3 })
			return
		}
		try {
			console.log('Configurator/save', {
				color,
				number,
				usedColors,
				originalColor,
				slotIndex,
			})
			ev?.stopPropagation?.()
		} catch (_) {}
		root.emit('configuratorSave', {
			color,
			number,
			index: slotIndex,
			playerId,
		})
	})
	const back = new Graphics()
	back.roundRect(0, 0, 90, 40, 10)
	back.fill({ color: 0x0a0f12, alpha: 0.7 })
	back.stroke({ color: 0x98ffb3, width: 2, alpha: 0.8 })
	back.x = 20
	back.y = 20
	back.eventMode = 'static'
	back.cursor = 'pointer'
	const backLabel = new Text({
		text: 'BACK',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0x98ffb3 },
	})
	backLabel.anchor = 0.5
	backLabel.x = back.x + 45
	backLabel.y = back.y + 20
	backLabel.eventMode = 'static'
	backLabel.cursor = 'pointer'
	content.addChild(back)
	content.addChild(backLabel)
	const exit = () => {
		root.emit('configuratorExit')
		const el = document.getElementById('chatOverlay') as HTMLElement | null
		if (el) {
			try {
				el.remove()
			} catch (_) {}
		}
	}
	back.on('pointertap', (ev: any) => {
		try {
			console.log('Configurator/back tapped (chip)')
			ev?.stopPropagation?.()
		} catch (_) {}
		exit()
	})
	backLabel.on('pointertap', (ev: any) => {
		try {
			console.log('Configurator/back tapped (label)')
			ev?.stopPropagation?.()
		} catch (_) {}
		exit()
	})
	// Minimized chat overlay (default collapsed)
	{
		const existing = document.getElementById(
			'chatOverlay'
		) as HTMLElement | null
		if (!existing) {
			const overlay = document.createElement('div')
			overlay.id = 'chatOverlay'
			overlay.style.position = 'fixed'
			overlay.style.right = '24px'
			overlay.style.bottom = '24px'
			overlay.style.transform = 'none'
			overlay.style.display = 'flex'
			overlay.style.alignItems = 'center'
			overlay.style.gap = '8px'
			overlay.style.padding = '6px 10px'
			overlay.style.background = 'rgba(10,15,18,0.9)'
			overlay.style.border = '1px solid #375a44'
			overlay.style.borderRadius = '14px'
			overlay.style.zIndex = '9999'
			overlay.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
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
			overlay.appendChild(pill)
			document.body.appendChild(overlay)
			const submit = () => {
				const text = (input.value || '').trim()
				if (!text) return
				root.emit('sendChat', text)
				input.value = ''
			}
			btn.addEventListener('click', submit)
			input.addEventListener('keydown', e => {
				if ((e as KeyboardEvent).key === 'Enter') submit()
			})
			let collapsed = true
			const setCollapsed = (v: boolean) => {
				collapsed = v
				input.style.display = collapsed ? 'none' : 'block'
				btn.style.display = collapsed ? 'none' : 'inline-block'
				emojiRow.style.display = collapsed ? 'none' : 'flex'
				pill.textContent = collapsed ? 'Chat' : 'Hide'
				pill.title = collapsed ? 'Show chat' : 'Hide chat'
				overlay.style.padding = collapsed ? '6px 10px' : '8px 10px'
				overlay.style.gap = collapsed ? '6px' : '8px'
				input.style.width = collapsed ? '0px' : '280px'
				overlay.style.minWidth = collapsed ? '64px' : 'auto'
				overlay.style.justifyContent = collapsed
					? 'center'
					: 'flex-start'
			}
			pill.addEventListener('click', () => setCollapsed(!collapsed))
			setCollapsed(true)
			root.on('destroyed', () => {
				try {
					btn.removeEventListener('click', submit)
					pill.removeEventListener('click', () =>
						setCollapsed(!collapsed)
					)
					input.remove()
					btn.remove()
					emojiRow.remove()
					pill.remove()
					overlay.remove()
				} catch (_) {}
			})
		}
	}
	return root
}
