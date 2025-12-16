type Listener = (...args: any[]) => void

export class SocketClient {
	private ws?: WebSocket
	private url: string
	private listeners: Record<string, Listener[]> = {}
	private reconnectDelay = 1000

	constructor(url: string) {
		this.url = url
	}

	on(event: string, fn: Listener) {
		;(this.listeners[event] ||= []).push(fn)
	}

	private emit(event: string, ...args: any[]) {
		this.listeners[event]?.forEach(fn => fn(...args))
	}

	connect() {
		this.ws?.close()
		this.ws = new WebSocket(this.url)
		this.ws.addEventListener('open', () => this.emit('open'))
		this.ws.addEventListener('message', ev => this.emit('message', ev.data))
		this.ws.addEventListener('close', () => {
			this.emit('close')
			setTimeout(() => this.connect(), this.reconnectDelay)
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000)
		})
		this.ws.addEventListener('error', err => this.emit('error', err))
	}

	send(data: any) {
		this.ws?.send(typeof data === 'string' ? data : JSON.stringify(data))
	}
}
