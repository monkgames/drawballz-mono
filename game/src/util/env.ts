export function isMobileDevice() {
	const ua = navigator.userAgent || ''
	return (
		/iPad|iPhone|iPod|Android|Mobile/i.test(ua) ||
		(navigator.maxTouchPoints || 0) > 1
	)
}

export function isSlowNetwork() {
	const nav = navigator as any
	const conn = nav.connection || nav.mozConnection || nav.webkitConnection
	if (!conn) return false
	const down = conn.downlink || 0
	const save = !!conn.saveData
	return save || down < 2
}
