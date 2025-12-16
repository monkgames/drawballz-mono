/* PIXI scaffold */
const app = new PIXI.Application({
	antialias: true,
	backgroundAlpha: 0,
	resizeTo: window,
})
document.body.appendChild(app.view)

const stage = app.stage

function makeRadialTexture(
	size,
	innerColor,
	outerColor,
	highlightOffset = { x: -0.2, y: -0.2 }
) {
	const c = document.createElement('canvas')
	c.width = c.height = size
	const ctx = c.getContext('2d')
	const cx = size * (0.5 + highlightOffset.x * 0.3)
	const cy = size * (0.5 + highlightOffset.y * 0.3)
	const grad = ctx.createRadialGradient(
		cx,
		cy,
		size * 0.05,
		size * 0.55,
		size * 0.55,
		size * 0.65
	)
	grad.addColorStop(0, innerColor)
	grad.addColorStop(1, outerColor)
	ctx.fillStyle = grad
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2)
	ctx.fill()
	return PIXI.Texture.from(c)
}

function drawSevenSegTexture(size, num) {
	const c = document.createElement('canvas')
	c.width = c.height = size
	const ctx = c.getContext('2d')
	ctx.fillStyle = 'rgba(0,0,0,0.92)'
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2)
	ctx.fill()

	const s = size * 0.6
	const digitW = s * 0.45
	const digitH = s * 0.75
	const thickness = Math.max(6, Math.floor(size * 0.04))
	const color = '#24e0ff'
	const leftX = size / 2 - digitW - thickness
	const y = size / 2 - digitH / 2
	const segMap = [
		[1, 1, 1, 1, 1, 1, 0],
		[0, 1, 1, 0, 0, 0, 0],
		[1, 1, 0, 1, 1, 0, 1],
		[1, 1, 1, 1, 0, 0, 1],
		[0, 1, 1, 0, 0, 1, 1],
		[1, 0, 1, 1, 0, 1, 1],
		[1, 0, 1, 1, 1, 1, 1],
		[1, 1, 1, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 0, 1, 1],
	]
	function drawDigit(d, x, y, w, h, t, col) {
		const seg = segMap[d]
		ctx.fillStyle = col
		const a = { x: x + t, y: y, w: w - 2 * t, h: t }
		const b = { x: x + w - t, y: y + t, w: t, h: h / 2 - t - t / 2 }
		const c2 = {
			x: x + w - t,
			y: y + h / 2 + t / 2,
			w: t,
			h: h / 2 - t - t / 2,
		}
		const d2 = { x: x + t, y: y + h - t, w: w - 2 * t, h: t }
		const e = { x: x, y: y + h / 2 + t / 2, w: t, h: h / 2 - t - t / 2 }
		const f = { x: x, y: y + t, w: t, h: h / 2 - t - t / 2 }
		const g = { x: x + t, y: y + h / 2 - t / 2, w: w - 2 * t, h: t }
		const segs = [a, b, c2, d2, e, f, g]
		ctx.shadowColor = 'rgba(36,224,255,0.55)'
		ctx.shadowBlur = Math.floor(size * 0.03)
		for (let i = 0; i < 7; i++)
			if (seg[i]) ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h)
		ctx.shadowBlur = 0
	}
	const d1 = Math.floor(num / 10) % 10
	const d2 = num % 10
	drawDigit(d1, leftX, y, digitW, digitH, thickness, color)
	drawDigit(
		d2,
		leftX + digitW + thickness * 2,
		y,
		digitW,
		digitH,
		thickness,
		color
	)
	return PIXI.Texture.from(c)
}

function createBall2D() {
	const container = new PIXI.Container()
	const size = 600
	const baseTex = makeRadialTexture(size, '#e6812b', '#7e3f0f')
	const base = new PIXI.Sprite(baseTex)
	base.anchor.set(0.5)
	container.addChild(base)

	const bands = new PIXI.Graphics()
	bands.beginFill(0x0a0a10)
	bands.drawRect(-size * 0.5, -size * 0.38, size * 0.25, size * 0.76)
	bands.drawRect(size * 0.25, -size * 0.38, size * 0.25, size * 0.76)
	bands.endFill()
	container.addChild(bands)

	const stripes = new PIXI.Graphics()
	stripes.lineStyle({ width: 10, color: 0xffffff, alpha: 0.95 })
	stripes.moveTo(-size * 0.2, -size * 0.12)
	stripes.lineTo(-size * 0.05, -size * 0.08)
	stripes.moveTo(-size * 0.22, -size * 0.02)
	stripes.lineTo(-size * 0.05, 0.02)
	stripes.moveTo(-size * 0.23, 0.08)
	stripes.lineTo(-size * 0.06, 0.12)
	container.addChild(stripes)

	const bezel = new PIXI.Graphics()
	bezel.lineStyle({ width: 28, color: 0xb8c2cc, alpha: 1 })
	bezel.drawCircle(0, 0, size * 0.33)
	container.addChild(bezel)

	const displayTex = drawSevenSegTexture(512, 27)
	const display = new PIXI.Sprite(displayTex)
	display.anchor.set(0.5)
	display.scale.set(size * 0.0011)
	container.addChild(display)

	const hook = new PIXI.Graphics()
	hook.lineStyle({ width: 6, color: 0xb8c2cc, alpha: 1 })
	hook.drawCircle(0, size * 0.49, size * 0.03)
	container.addChild(hook)

	container.scale.set(0.6)
	return container
}

const ball = createBall2D()
stage.addChild(ball)

let running = false
const overlay = document.getElementById('overlay')
const menu = document.getElementById('menu')
const settings = document.getElementById('settings')
const startBtn = document.getElementById('startBtn')
const settingsBtn = document.getElementById('settingsBtn')
const closeSettingsBtn = document.getElementById('closeSettingsBtn')

function showMenu() {
	overlay.style.display = 'grid'
	menu.classList.remove('hidden')
	settings.classList.add('hidden')
}
function hideOverlay() {
	overlay.style.display = 'none'
}
function showSettings() {
	menu.classList.add('hidden')
	settings.classList.remove('hidden')
}
function closeSettings() {
	settings.classList.add('hidden')
	menu.classList.remove('hidden')
}

startBtn.addEventListener('click', () => {
	running = true
	hideOverlay()
})
settingsBtn.addEventListener('click', () => {
	showSettings()
})
closeSettingsBtn.addEventListener('click', () => {
	closeSettings()
})

showMenu()

function layout() {
	const w = window.innerWidth,
		h = window.innerHeight
	ball.x = w / 2
	ball.y = h / 2
	const s = Math.min(w, h) / 800
	ball.scale.set(s)
}
window.addEventListener('resize', layout)
layout()

app.ticker.add(() => {
	if (running) ball.rotation += 0.002
})
