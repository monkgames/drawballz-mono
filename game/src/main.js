import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e0e12)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture

const camera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	100
)
camera.position.set(0, 1.2, 3)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const hemi = new THREE.HemisphereLight(0xffffff, 0x202030, 1.0)
scene.add(hemi)
const dir = new THREE.DirectionalLight(0xffffff, 0.6)
dir.position.set(3, 4, 2)
scene.add(dir)

function createBall() {
	const radius = 0.6
	const geo = new THREE.SphereGeometry(radius, 128, 128)
	const mat = new THREE.MeshStandardMaterial({
		color: 0xcd6a1e,
		roughness: 0.38,
		metalness: 0.25,
	})

	mat.onBeforeCompile = shader => {
		shader.uniforms.bandCenter1 = { value: 0.12 }
		shader.uniforms.bandCenter2 = { value: 0.88 }
		shader.uniforms.bandWidth = { value: 0.12 }
		shader.uniforms.stripe1A = { value: 0.06 }
		shader.uniforms.stripe1B = { value: 0.095 }
		shader.uniforms.stripe2A = { value: 0.105 }
		shader.uniforms.stripe2B = { value: 0.135 }
		shader.uniforms.stripe3A = { value: 0.145 }
		shader.uniforms.stripe3B = { value: 0.165 }
		shader.uniforms.stripeOpacity = { value: 0.9 }

		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				`#include <common>
                varying vec2 vMyUv;`
			)
			.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>
                vMyUv = uv;`
			)

		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>
                varying vec2 vMyUv;
                uniform float bandCenter1; uniform float bandCenter2; uniform float bandWidth;
                uniform float stripe1A; uniform float stripe1B;
                uniform float stripe2A; uniform float stripe2B;
                uniform float stripe3A; uniform float stripe3B;
                uniform float stripeOpacity;`
			)
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
                float u = vMyUv.x;
                float band1 = smoothstep(bandCenter1 - bandWidth, bandCenter1, u) * (1.0 - smoothstep(bandCenter1, bandCenter1 + bandWidth, u));
                float band2 = smoothstep(bandCenter2 - bandWidth, bandCenter2, u) * (1.0 - smoothstep(bandCenter2, bandCenter2 + bandWidth, u));
                float band = max(band1, band2);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.04, 0.06), band);
                float stripe1 = step(stripe1A, u) * step(u, stripe1B);
                float stripe2 = step(stripe2A, u) * step(u, stripe2B);
                float stripe3 = step(stripe3A, u) * step(u, stripe3B);
                float stripe = max(stripe1, max(stripe2, stripe3));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), stripe * stripeOpacity);
                `
			)
	}

	const shell = new THREE.Mesh(geo, mat)

	const displaySize = 256
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = displaySize
	const ctx = canvas.getContext('2d')

	function drawSevenSegmentDigit(d, x, y, w, h, thickness, onColor) {
		const seg = [
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
		][d]

		ctx.fillStyle = onColor
		const ox = x,
			oy = y
		const sx = thickness,
			sy = thickness

		const a = { x: ox + sx, y: oy, w: w - 2 * sx, h: thickness }
		const b = {
			x: ox + w - thickness,
			y: oy + sy,
			w: thickness,
			h: h / 2 - sy - thickness / 2,
		}
		const c = {
			x: ox + w - thickness,
			y: oy + h / 2 + thickness / 2,
			w: thickness,
			h: h / 2 - sy - thickness / 2,
		}
		const d2 = {
			x: ox + sx,
			y: oy + h - thickness,
			w: w - 2 * sx,
			h: thickness,
		}
		const e = {
			x: ox,
			y: oy + h / 2 + thickness / 2,
			w: thickness,
			h: h / 2 - sy - thickness / 2,
		}
		const f = {
			x: ox,
			y: oy + sy,
			w: thickness,
			h: h / 2 - sy - thickness / 2,
		}
		const g = {
			x: ox + sx,
			y: oy + h / 2 - thickness / 2,
			w: w - 2 * sx,
			h: thickness,
		}

		const segs = [a, b, c, d2, e, f, g]
		for (let i = 0; i < 7; i++) {
			if (seg[i]) ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h)
		}
	}

	function drawNumber(num) {
		ctx.clearRect(0, 0, displaySize, displaySize)
		ctx.fillStyle = 'rgba(0,0,0,0.9)'
		ctx.beginPath()
		ctx.arc(
			displaySize / 2,
			displaySize / 2,
			displaySize * 0.46,
			0,
			Math.PI * 2
		)
		ctx.fill()

		const s = displaySize * 0.6
		const digitW = s * 0.45
		const digitH = s * 0.75
		const thickness = Math.max(6, Math.floor(displaySize * 0.03))
		const color = '#24e0ff'
		const leftX = displaySize / 2 - digitW - thickness
		const y = displaySize / 2 - digitH / 2

		const d1 = Math.floor(num / 10) % 10
		const d2 = num % 10
		ctx.shadowColor = 'rgba(36,224,255,0.6)'
		ctx.shadowBlur = Math.floor(displaySize * 0.03)
		drawSevenSegmentDigit(d1, leftX, y, digitW, digitH, thickness, color)
		drawSevenSegmentDigit(
			d2,
			leftX + digitW + thickness * 2,
			y,
			digitW,
			digitH,
			thickness,
			color
		)
		ctx.shadowBlur = 0
	}

	drawNumber(27)
	const tex = new THREE.CanvasTexture(canvas)
	tex.anisotropy = 4
	tex.needsUpdate = true

	const display = new THREE.Mesh(
		new THREE.CircleGeometry(radius * 0.65, 128),
		new THREE.MeshBasicMaterial({ map: tex, transparent: true })
	)
	display.position.set(0, 0, radius * 0.01)

	const ring = new THREE.Mesh(
		new THREE.RingGeometry(radius * 0.7, radius * 0.78, 64),
		new THREE.MeshPhysicalMaterial({
			color: 0xb8c2cc,
			metalness: 0.95,
			roughness: 0.2,
			clearcoat: 1.0,
			clearcoatRoughness: 0.15,
		})
	)
	ring.position.copy(display.position)

	const hook = new THREE.Mesh(
		new THREE.TorusGeometry(radius * 0.06, radius * 0.01, 12, 24),
		new THREE.MeshStandardMaterial({
			color: 0xb8c2cc,
			metalness: 0.9,
			roughness: 0.25,
		})
	)
	hook.position.set(0, -radius * 0.98, 0)

	const group = new THREE.Group()
	group.add(shell)
	group.add(display)
	group.add(ring)
	group.add(hook)
	group.userData.setNumber = n => {
		drawNumber(n)
		tex.needsUpdate = true
	}
	return group
}

const ball = createBall()
scene.add(ball)

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

function resize() {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', resize)

const clock = new THREE.Clock()

function tick() {
	const dt = clock.getDelta()
	ball.rotation.y += dt * 0.6
	controls.update()
	renderer.render(scene, camera)
	requestAnimationFrame(tick)
}

tick()
