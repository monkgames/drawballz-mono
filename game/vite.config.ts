import { defineConfig } from 'vite'

export default defineConfig({
	server: {
		port: 3001,
		strictPort: true,
		host: true,
		proxy: {
			'/simulate': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
			'/player': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
			'/ws': {
				target: 'ws://localhost:3001',
				ws: true,
			},
			'/health': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
			'/prize': {
				target: 'http://localhost:3001',
				changeOrigin: true,
			},
		},
	},
	preview: {
		port: 3001,
		strictPort: true,
		host: true,
	},
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
		},
	},
	optimizeDeps: {
		include: ['pixi.js', '@pixi/unsafe-eval', 'eventemitter3'],
	},
	build: {
		commonjsOptions: {
			exclude: [/node_modules\/pixi\.js/],
		},
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes(
							'/node_modules/@esotericsoftware/spine-pixi-v8/'
						)
					)
						return 'vendor-spine'
					if (id.includes('/node_modules/gsap/')) return 'vendor-gsap'
					return undefined
				},
			},
		},
	},
})
