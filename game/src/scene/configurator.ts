import {
	Container,
	Graphics,
	Text,
	Sprite,
	Assets,
	Texture,
	Point,
} from 'pixi.js'
import { createBall, BallColor } from '@/modules/ball'
import { gsap } from 'gsap'
import { playClickSound, playConfirmSound } from '@/audio/sfx'

export async function loadConfigBackgroundTexture(): Promise<Texture | null> {
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

	// Containers for layering
	const bgContainer = new Container()
	const centerContainer = new Container()
	const uiContainer = new Container()
	content.addChild(bgContainer)
	content.addChild(centerContainer)
	content.addChild(uiContainer)

	// Immediate solid background to prevent black screen during load
	const placeholderBg = new Graphics()
	placeholderBg.rect(0, 0, w, h)
	placeholderBg.fill({ color: 0x0e0e12 })
	bgContainer.addChild(placeholderBg)

	// Async Background Load
	loadConfigBackgroundTexture().then(bgTex => {
		if (bgTex) {
			const sprite = new Sprite({ texture: bgTex })
			sprite.anchor = 0.5
			sprite.x = Math.round(w / 2)
			sprite.y = Math.round(h / 2)
			const s = Math.max(w / bgTex.width, h / bgTex.height)
			sprite.scale.set(s)
			bgContainer.addChild(sprite)
			// Optional: fade in or just cover the placeholder
			sprite.alpha = 0
			gsap.to(sprite, { alpha: 1, duration: 0.3 })
		}
	})

	// Async Center Ball Load
	createBall(color).then(center => {
		center.scale.set(0.45)
		center.x = Math.round(w / 2)
		center.y = Math.round(h / 2)
		centerContainer.addChild(center)
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

		const currentCircle = new Graphics()
		currentCircle.circle(
			0,
			0,
			Math.max(center.width, center.height) * 0.064
		)
		currentCircle.fill({ color: 0x000000, alpha: 0.85 })
		currentCircle.x = center.x
		currentCircle.y = center.y
		centerContainer.addChild(currentCircle)

		const currentText = new Text({
			text: '01',
			style: { fontFamily: 'system-ui', fontSize: 48, fill: 0x98ffb3 },
		})
		currentText.anchor = 0.5
		currentText.x = currentCircle.x
		currentText.y = currentCircle.y
		currentText.roundPixels = true
		currentText.resolution = Math.min(window.devicePixelRatio || 1, 2)
		centerContainer.addChild(currentText)

		// Update current text update logic to reference this text
		// We need to expose currentText to renderSlots
		// For now, we can attach it to centerContainer or pass it
		;(centerContainer as any).currentText = currentText
		renderSlots() // Initial render to update text
	})

	const numberLabel = new Text({
		text: 'SELECT NUMBER',
		style: { fontFamily: 'system-ui', fontSize: 18, fill: 0xe6f7ff },
	})
	numberLabel.anchor = 0.5
	numberLabel.x = Math.round(w * 0.17)
	numberLabel.y = Math.round(h * 0.26)
	numberLabel.roundPixels = true
	numberLabel.resolution = Math.max(window.devicePixelRatio || 1, 2)
	uiContainer.addChild(numberLabel)
	const panel = new Container()
	panel.x = Math.round(w * 0.84)
	panel.y = Math.round(h * 0.5)
	uiContainer.addChild(panel)
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

	// Removed sync center circle/text creation (moved to async block)
	// Need to handle missing currentText in renderSlots

	// Top status header removed

	// Left options (Color / Number)
	const leftOptions = new Container()
	leftOptions.x = Math.round(w * 0.12)
	leftOptions.y = Math.round(h * 0.5)
	uiContainer.addChild(leftOptions)
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
		// Safely access currentText if available
		const ct = (centerContainer as any).currentText as Text | undefined
		if (ct) {
			ct.text = `${String(numbers[selectedIndex]).padStart(2, '0')}`
		}
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
	uiContainer.addChild(colorPanel)
	const frame2 = new Graphics()
	frame2.roundRect(-frameW / 2, -frameH / 2, frameW, frameH, 16)
	frame2.fill({ color: 0x0a0f12, alpha: 0.8 })
	frame2.stroke({ color: 0x98ffb3, width: 2, alpha: 0.6 })
	colorPanel.addChild(frame2)
	const colorSlots: { chip: Graphics; item: Container; key: BallColor }[] = []
	const controlSpacing = Math.round((frameH - 40) / colors.length)

	// Async Slot Creation
	const slotPromises = colors.map(async (k, i) => {
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

		const pv = await createBall(k, { noFX: true })
		pv.scale.set(0.18)
		pv.x = 0
		pv.y = 0
		item.addChild(pv)
		item.on('pointertap', (ev: any) => {
			playClickSound(k)
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
							used: currentUsed,
						})
					} catch (_) {}
					// Show error feedback
					const errorLabel = new Text({
						text: 'Taken',
						style: {
							fontFamily: 'system-ui',
							fontSize: 14,
							fill: 0xff4444,
							fontWeight: 'bold',
						},
					})
					errorLabel.anchor = 0.5
					errorLabel.x = 0
					errorLabel.y = 0
					item.addChild(errorLabel)
					pv.alpha = 0.2
					gsap.to(errorLabel, {
						y: -20,
						alpha: 0,
						duration: 1.0,
						delay: 0.5,
						onComplete: () => {
							item.removeChild(errorLabel)
							pv.alpha = 1
						},
					})
					return
				}
				// Select color
				playConfirmSound()
				const newScene = await createConfiguratorScene(
					w,
					h,
					k,
					playerId,
					usedColors,
					slotIndex,
					originalColor
				)

				// Attempt to replace the scene at the stage level to avoid nesting
				const currentRoot = content.parent
				if (currentRoot && currentRoot.parent) {
					const stage = currentRoot.parent
					stage.removeChild(currentRoot)
					stage.addChild(newScene)
					// Update global reference if possible (optional, but good for debugging)
					try {
						if (
							(window as any).__app &&
							(window as any).__app.stage
						) {
							// Check if main.ts configurator var needs update?
							// We can't reach it easily. But visual replacement is enough.
						}
					} catch (_) {}
				} else if (currentRoot) {
					// Fallback if not attached to stage yet (unlikely)
					currentRoot.removeChildren()
					currentRoot.addChild(newScene)
				}
			})()
		})
		return { chip, item, key: k, index: i }
	})

	Promise.all(slotPromises).then(results => {
		results
			.sort((a, b) => a.index - b.index)
			.forEach(r => {
				colorPanel.addChild(r.chip)
				colorPanel.addChild(r.item)
				colorSlots.push(r)
			})
		renderColorSlots()
	})

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
	// Initial empty render (will be populated when promises resolve)
	// renderColorSlots() // No slots yet

	setTab('color')
	const errorLabel = new Text({
		text: '',
		style: { fontFamily: 'system-ui', fontSize: 16, fill: 0xff4d4f },
	})
	errorLabel.anchor = 0.5
	errorLabel.x = Math.round(w / 2)
	errorLabel.y = Math.round(h * 0.86)
	errorLabel.alpha = 0
	uiContainer.addChild(errorLabel)
	const mintBtn = new Graphics()
	mintBtn.roundRect(0, 0, 220, 50, 12)
	mintBtn.fill({ color: 0xff6b00, alpha: 0.9 })
	mintBtn.x = Math.round(w * 0.5 - 110)
	mintBtn.y = Math.round(h * 0.9)
	mintBtn.eventMode = 'static'
	mintBtn.cursor = 'pointer'
	uiContainer.addChild(mintBtn)
	const mintLabel = new Text({
		text: 'SAVE',
		style: { fontFamily: 'system-ui', fontSize: 20, fill: 0x000000 },
	})
	mintLabel.anchor = 0.5
	mintLabel.x = Math.round(mintBtn.x + 110)
	mintLabel.y = Math.round(mintBtn.y + 25)
	uiContainer.addChild(mintLabel)
	mintBtn.on('pointertap', async (ev: any) => {
		playConfirmSound()
		const number = Math.max(
			0,
			Math.min(9, Number(String(numbers[selectedIndex])))
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
					'touches' in e
						? e.touches[0].clientX
						: (e as MouseEvent).clientX
				const clientY =
					'touches' in e
						? e.touches[0].clientY
						: (e as MouseEvent).clientY

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
			}

			const onDragMove = (e: MouseEvent | TouchEvent) => {
				if (!isDragging) return

				const clientX =
					'touches' in e
						? e.touches[0].clientX
						: (e as MouseEvent).clientX
				const clientY =
					'touches' in e
						? e.touches[0].clientY
						: (e as MouseEvent).clientY

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
			overlay.addEventListener('touchstart', onDragStart, {
				passive: false,
			})
			document.addEventListener('mousemove', onDragMove)
			document.addEventListener('touchmove', onDragMove, {
				passive: false,
			})
			document.addEventListener('mouseup', onDragEnd)
			document.addEventListener('touchend', onDragEnd)

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
			// pill click handled by onDragEnd
			setCollapsed(true)
			root.on('destroyed', () => {
				try {
					btn.removeEventListener('click', submit)
					document.removeEventListener('mousemove', onDragMove)
					document.removeEventListener('touchmove', onDragMove)
					document.removeEventListener('mouseup', onDragEnd)
					document.removeEventListener('touchend', onDragEnd)
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
