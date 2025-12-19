import {
	Container,
	Graphics,
	Text,
	Sprite,
	Assets,
	Texture,
	Point,
} from 'pixi.js'
import { createBall, BallColor, createMasterBall } from '@/modules/ball'
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
	originalColor?: BallColor,
	initialNumberIndex: number = 0
) {
	const root = new Container()
	const content = new Container()
	root.addChild(content)

	// Configured Range: 00, 0-9
	const numbers: (string | number)[] = ['00', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
	let selectedIndex = initialNumberIndex
	let currentColor = color

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
			sprite.x = w / 2
			sprite.y = h / 2
			const s = Math.max(w / bgTex.width, h / bgTex.height)
			sprite.scale.set(s)
			bgContainer.addChild(sprite)
			sprite.alpha = 0
			gsap.to(sprite, { alpha: 1, duration: 0.3 })
		}
	})

	// --- CENTER BALL ---
	const initialVal = (numbers as any)?.[selectedIndex] || '00'

	createMasterBall(currentColor, initialVal, { noFX: true }).then(
		async ({ container: center, updateNumber }) => {
			center.scale.set(0.45)
			center.x = w / 2
			center.y = h / 2
			centerContainer.addChild(center)

			// Idle animation
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

			if (updateNumber) {
				;(centerContainer as any).updateNumber = updateNumber
			}
		}
	)

	// Update Color Logic
	;(root as any).updateColor = async (newColor: BallColor) => {
		const centerC = content.children[1] as Container
		if (!centerC || centerC.children.length === 0) return

		const ballContainer = centerC.children[0] as Container

		// Load new assets
		const tempBall = await createBall(newColor, { noFX: true })
		const tempTrail = (tempBall as any).userData?.trail as
			| Sprite
			| undefined
		const tempBallSprite = (tempBall.children.find(
			c => c instanceof Sprite && c !== tempTrail
		) || tempBall.children[0]) as Sprite

		// Update existing sprites
		const existingTrail = (ballContainer as any).userData?.trail as
			| Sprite
			| undefined
		const existingBall = (ballContainer.children.find(
			c => c instanceof Sprite && c !== existingTrail
		) || ballContainer.children[0]) as Sprite

		if (existingBall && tempBallSprite) {
			existingBall.texture = tempBallSprite.texture
			existingBall.scale.copyFrom(tempBallSprite.scale)
		}

		if (existingTrail && tempTrail) {
			existingTrail.texture = tempTrail.texture
		}

		currentColor = newColor
		renderUI()
	}

	// --- NEW UI IMPLEMENTATION ---

	// State
	let activeTab: 'color' | 'number' = 'color'

	// Left Tabs Container
	const leftPanel = new Container()
	leftPanel.x = Math.round(w * 0.15)
	leftPanel.y = Math.round(h * 0.5)
	uiContainer.addChild(leftPanel)

	// Right Content Container
	const rightPanel = new Container()
	rightPanel.x = Math.round(w * 0.85)
	rightPanel.y = Math.round(h * 0.5)
	uiContainer.addChild(rightPanel)

	// Helper: Create Tab Button
	const createTabBtn = (
		label: string,
		mode: 'color' | 'number',
		yPos: number
	) => {
		const btn = new Container()
		btn.y = yPos

		const bg = new Graphics()
		btn.addChild(bg)

		const text = new Text({
			text: label,
			style: {
				fontFamily: 'system-ui',
				fontSize: 18,
				fill: 0xe6f7ff,
				fontWeight: 'bold',
			},
		})
		text.anchor.set(0.5)
		btn.addChild(text)

		btn.eventMode = 'static'
		btn.cursor = 'pointer'

		btn.on('pointertap', () => {
			if (activeTab !== mode) {
				playClickSound(currentColor)
				activeTab = mode
				renderUI()
			}
		})

		return { btn, bg, text, mode }
	}

	const tabColor = createTabBtn('COLOR', 'color', -60)
	const tabNumber = createTabBtn('NUMBER', 'number', 60)
	leftPanel.addChild(tabColor.btn)
	leftPanel.addChild(tabNumber.btn)

	// Right Panel: Color Grid
	const colorGrid = new Container()
	rightPanel.addChild(colorGrid)

	// Helper: Hex colors for UI
	const BALL_COLORS_HEX: Record<BallColor, number> = {
		green: 0x98ffb3,
		pink: 0xff98e3,
		orange: 0xffb366,
		yellow: 0xffeb3b,
		blue: 0x66b3ff,
	}

	const colors = ['green', 'pink', 'orange', 'yellow', 'blue'] as const
	const colorItems: {
		container: Container
		bg: Graphics
		ball: Container
		key: BallColor
	}[] = []

	// Initialize Color Grid
	const gridBg = new Graphics()
	gridBg.roundRect(-100, -200, 200, 400, 20)
	gridBg.fill({ color: 0x0a0f12, alpha: 0.85 })
	gridBg.stroke({ color: 0x98ffb3, width: 2, alpha: 0.5 })
	colorGrid.addChild(gridBg)

	const initColorGrid = async () => {
		const startY = -140
		const gapY = 70

		for (let i = 0; i < colors.length; i++) {
			const k = colors[i]
			const item = new Container()
			item.y = startY + i * gapY

			const bg = new Graphics()
			// Visual button background
			bg.roundRect(-80, -30, 160, 60, 30)
			// Initial state (will be updated in renderUI)
			bg.fill({ color: BALL_COLORS_HEX[k], alpha: 0.1 })
			bg.stroke({ color: BALL_COLORS_HEX[k], width: 2, alpha: 0.5 })
			item.addChild(bg)

			// Preview Ball
			const preview = await createBall(k, { noFX: true })
			preview.scale.set(0.08) // Reduced scale
			preview.x = 0
			preview.y = 0
			// Add shadow to make ball pop
			const shadow = new Graphics()
			shadow.ellipse(0, 15, 20, 8)
			shadow.fill({ color: 0x000000, alpha: 0.3 })
			item.addChildAt(shadow, 1) // Add shadow before ball
			item.addChild(preview)

			item.eventMode = 'static'
			item.cursor = 'pointer'
			item.on('pointertap', () => {
				const currentUsed = usedColors.filter(
					c => c !== (originalColor || color)
				)
				if (currentUsed.includes(k) && k !== currentColor) {
					// Disabled feedback
					playClickSound(currentColor) // Error sound?
					return
				}
				playClickSound(k)
				if ((root as any).updateColor) {
					;(root as any).updateColor(k)
				}
			})

			colorGrid.addChild(item)
			colorItems.push({ container: item, bg, ball: preview, key: k })
		}
		renderUI()
	}
	initColorGrid()

	// Right Panel: Number Picker
	const numberPicker = new Container()
	rightPanel.addChild(numberPicker)
	numberPicker.visible = false

	const pickerBg = new Graphics()
	pickerBg.roundRect(-100, -200, 200, 400, 20)
	pickerBg.fill({ color: 0x0a0f12, alpha: 0.85 })
	pickerBg.stroke({ color: 0x98ffb3, width: 2, alpha: 0.5 })
	numberPicker.addChild(pickerBg)

	// Slot Machine Logic
	const slotSpacing = 60
	const visibleSlots = 5 // -2, -1, 0, 1, 2
	const slotItems: { text: Text; bg: Graphics; offset: number }[] = []

	for (let i = 0; i < visibleSlots; i++) {
		const offset = i - 2
		const slotC = new Container()
		slotC.y = offset * slotSpacing

		const sBg = new Graphics()
		slotC.addChild(sBg)

		const txt = new Text({
			text: '00',
			style: {
				fontFamily: 'system-ui',
				fontSize: 24,
				fill: 0xe6f7ff,
				fontWeight: 'bold',
			},
		})
		txt.anchor.set(0.5)
		slotC.addChild(txt)

		slotC.eventMode = 'static'
		slotC.cursor = 'pointer'
		slotC.on('pointertap', () => {
			if (offset !== 0) {
				selectedIndex = clampIndex(selectedIndex + offset)
				playClickSound(currentColor)
				renderUI()
			}
		})

		numberPicker.addChild(slotC)
		slotItems.push({ text: txt, bg: sBg, offset })
	}

	// Selection Indicator for Numbers
	const pickerSelection = new Graphics()
	pickerSelection.roundRect(-80, -28, 160, 56, 12)
	pickerSelection.stroke({ color: 0xffd400, width: 2 })
	pickerSelection.fill({ color: 0xffd400, alpha: 0.1 })
	pickerSelection.eventMode = 'none'
	numberPicker.addChild(pickerSelection)

	// Dragging Logic for Number Picker
	const clampIndex = (i: number) =>
		Math.max(0, Math.min(numbers.length - 1, i))
	let dragging = false
	let startDragY = 0

	numberPicker.eventMode = 'static'
	numberPicker.cursor = 'grab'

	numberPicker.on('pointerdown', ev => {
		dragging = true
		numberPicker.cursor = 'grabbing'
		const local = numberPicker.toLocal(ev.global)
		startDragY = local.y
	})

	const onDragMove = (ev: any) => {
		if (!dragging) return
		const local = numberPicker.toLocal(ev.global)
		const dy = local.y - startDragY
		if (Math.abs(dy) > slotSpacing) {
			const steps = -Math.round(dy / slotSpacing)
			if (steps !== 0) {
				selectedIndex = clampIndex(selectedIndex + steps)
				startDragY = local.y
				renderUI()
			}
		}
	}

	const onDragEnd = () => {
		dragging = false
		numberPicker.cursor = 'grab'
	}

	numberPicker.on('pointermove', onDragMove)
	numberPicker.on('pointerup', onDragEnd)
	numberPicker.on('pointerupoutside', onDragEnd)

	// Render Function
	const renderUI = () => {
		// 1. Left Tabs
		const renderTab = (t: typeof tabColor) => {
			const active = activeTab === t.mode
			t.bg.clear()
			if (active) {
				t.bg.roundRect(-80, -25, 160, 50, 25)
				t.bg.fill({ color: 0x98ffb3, alpha: 0.9 })
				t.text.style.fill = 0x0a0f12
			} else {
				t.bg.roundRect(-70, -20, 140, 40, 20)
				t.bg.fill({ color: 0x0a0f12, alpha: 0.6 })
				t.bg.stroke({ color: 0x98ffb3, width: 1, alpha: 0.4 })
				t.text.style.fill = 0x98ffb3
			}
		}
		renderTab(tabColor)
		renderTab(tabNumber)

		// 2. Right Panel Visibility
		colorGrid.visible = activeTab === 'color'
		numberPicker.visible = activeTab === 'number'

		// 3. Color Grid
		const currentUsed = usedColors.filter(
			c => c !== (originalColor || color)
		)
		colorItems.forEach(item => {
			const isSelected = item.key === currentColor
			const isTaken = currentUsed.includes(item.key) && !isSelected
			const colorHex = BALL_COLORS_HEX[item.key]

			item.bg.clear()
			if (isSelected) {
				// Selected: Bright, fully colored button, white border
				item.bg.roundRect(-80, -30, 160, 60, 30)
				item.bg.fill({ color: colorHex, alpha: 0.9 })
				item.bg.stroke({ color: 0xffffff, width: 3 })
			} else if (isTaken) {
				// Taken: Dimmed, gray/dark
				item.bg.roundRect(-70, -25, 140, 50, 25)
				item.bg.fill({ color: 0x2a2a2a, alpha: 0.3 })
				item.bg.stroke({ color: 0x555555, width: 1 })
			} else {
				// Normal: Colored tint, visible button
				item.bg.roundRect(-75, -28, 150, 56, 28)
				item.bg.fill({ color: colorHex, alpha: 0.4 })
				item.bg.stroke({ color: colorHex, width: 2 })
			}

			item.container.alpha = isTaken ? 0.4 : 1
			item.ball.scale.set(isSelected ? 0.09 : 0.08)
		})

		// 4. Number Picker
		slotItems.forEach(item => {
			const idx = selectedIndex + item.offset
			if (idx >= 0 && idx < numbers.length) {
				item.text.text = String(numbers[idx]).padStart(2, '0')
				item.text.visible = true
			} else {
				item.text.visible = false
			}

			const isCenter = item.offset === 0
			item.text.style.fontSize = isCenter ? 32 : 24
			item.text.alpha = isCenter ? 1 : 0.5
		})

		// Update Center Ball Number
		const updater = (centerContainer as any).updateNumber
		if (updater) {
			updater(numbers[selectedIndex])
		}
	}

	// Error Feedback
	const errorLabel = new Text({
		text: '',
		style: {
			fontFamily: 'system-ui',
			fontSize: 16,
			fill: 0xff4d4f,
			fontWeight: 'bold',
		},
	})
	errorLabel.anchor.set(0.5)
	errorLabel.x = w / 2
	errorLabel.y = h * 0.85
	errorLabel.alpha = 0
	uiContainer.addChild(errorLabel)

	const showError = (msg: string) => {
		errorLabel.text = msg
		errorLabel.alpha = 1
		errorLabel.y = h * 0.85
		gsap.from(errorLabel, { y: h * 0.85 + 10, alpha: 0, duration: 0.2 })
		gsap.to(errorLabel, { alpha: 0, delay: 1.5, duration: 0.5 })
	}

	// --- FOOTER BUTTONS ---

	// Save Button
	const saveBtn = new Graphics()
	saveBtn.roundRect(-100, -25, 200, 50, 25)
	saveBtn.fill({ color: 0xff6b00 })
	saveBtn.x = w / 2
	saveBtn.y = h * 0.92
	saveBtn.eventMode = 'static'
	saveBtn.cursor = 'pointer'

	const saveText = new Text({
		text: 'SAVE',
		style: {
			fontFamily: 'system-ui',
			fontSize: 20,
			fill: 0x000000,
			fontWeight: 'bold',
		},
	})
	saveText.anchor.set(0.5)
	saveText.position.set(0, 0)
	saveBtn.addChild(saveText)
	uiContainer.addChild(saveBtn)

	saveBtn.on('pointertap', () => {
		const number = Number(String(numbers[selectedIndex]))
		const currentUsed = usedColors.filter(
			c => c !== (originalColor || color)
		)

		if (currentUsed.includes(currentColor)) {
			showError('Color already used')
			return
		}

		playConfirmSound()
		root.emit('configuratorSave', {
			color: currentColor,
			number,
			index: slotIndex,
			playerId,
		})
	})

	// Back Button
	const backBtn = new Container()
	backBtn.position.set(40, 40)

	const backBg = new Graphics()
	backBg.roundRect(0, 0, 80, 40, 20)
	backBg.fill({ color: 0x0a0f12, alpha: 0.6 })
	backBg.stroke({ color: 0x98ffb3, width: 2, alpha: 0.5 })
	backBtn.addChild(backBg)

	const backText = new Text({
		text: 'BACK',
		style: {
			fontFamily: 'system-ui',
			fontSize: 14,
			fill: 0x98ffb3,
			fontWeight: 'bold',
		},
	})
	backText.anchor.set(0.5)
	backText.position.set(40, 20)
	backBtn.addChild(backText)

	backBtn.eventMode = 'static'
	backBtn.cursor = 'pointer'
	uiContainer.addChild(backBtn)

	const exit = () => {
		root.emit('configuratorExit')
		const el = document.getElementById('chatOverlay') as HTMLElement | null
		if (el) el.remove()
	}
	backBtn.on('pointertap', exit)

	// Initial Render
	renderUI()

	// --- CHAT OVERLAY (Keep existing) ---
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
