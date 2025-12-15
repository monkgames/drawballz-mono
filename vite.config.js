export default {
	root: 'public',
	server: {
		proxy: {
			'/simulate': {
				target: 'http://localhost:3002',
				changeOrigin: true,
			},
			'/health': {
				target: 'http://localhost:3002',
				changeOrigin: true,
			},
		},
	},
}
