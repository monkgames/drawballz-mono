async function init() {
	const status = document.getElementById('status')
	const alertBox = document.getElementById('alert')
	const loaderEl = document.getElementById('loader')
	function humanizeN(n) {
		const num = Number(n || 0)
		if (!(Number.isFinite(num) && num >= 0)) return ''
		const k = num / 1_000
		const m = num / 1_000_000
		const b = num / 1_000_000_000
		function fmt(x) {
			if (x >= 100) return x.toFixed(0)
			if (x >= 10) return x.toFixed(1)
			return x.toFixed(3)
		}
		return `K ${fmt(k)} • M ${fmt(m)} • B ${fmt(b)}`
	}
	function updateRepeatNHuman() {
		const el = document.getElementById('repeatNHuman')
		const n = Number(document.getElementById('repeatN')?.value || 0)
		if (el) el.textContent = humanizeN(n)
	}
	function parseRepeatNShorthand(s) {
		if (!s) return NaN
		const t = String(s).trim().replace(/,/g, '')
		const m = t.match(/^([0-9]*\.?[0-9]+)\s*([KkMmBb])?$/)
		if (!m) return NaN
		const v = Number(m[1])
		if (!Number.isFinite(v)) return NaN
		const suf = m[2] || ''
		let mul = 1
		if (suf === 'k' || suf === 'K') mul = 1_000
		else if (suf === 'm' || suf === 'M') mul = 1_000_000
		else if (suf === 'b' || suf === 'B') mul = 1_000_000_000
		return Math.floor(v * mul)
	}
	const repeatNEl = document.getElementById('repeatN')
	if (repeatNEl) {
		repeatNEl.addEventListener('input', updateRepeatNHuman)
		updateRepeatNHuman()
	}
	const repeatNShortEl = document.getElementById('repeatNShorthand')
	if (repeatNShortEl) {
		repeatNShortEl.addEventListener('input', () => {
			const n = parseRepeatNShorthand(repeatNShortEl.value)
			if (Number.isInteger(n) && n >= 1) {
				const numEl = document.getElementById('repeatN')
				if (numEl) numEl.value = String(n)
				updateRepeatNHuman()
			}
		})
	}
	function setRepeatNPreset(n) {
		const numEl = document.getElementById('repeatN')
		if (numEl) numEl.value = String(n)
		updateRepeatNHuman()
	}
	const p10k = document.getElementById('preset10K')
	const p100k = document.getElementById('preset100K')
	const p1m = document.getElementById('preset1M')
	const p10m = document.getElementById('preset10M')
	if (p10k) p10k.addEventListener('click', () => setRepeatNPreset(10_000))
	if (p100k) p100k.addEventListener('click', () => setRepeatNPreset(100_000))
	if (p1m) p1m.addEventListener('click', () => setRepeatNPreset(1_000_000))
	if (p10m) p10m.addEventListener('click', () => setRepeatNPreset(10_000_000))
	function setProbabilities(dist) {
		const vals = dist.map(v => Math.max(0, Number(v || 0)))
		let sum = 0
		for (const v of vals) sum += v
		let norm = vals.slice()
		if (!(Number.isFinite(sum) && sum > 0)) {
			norm = [1, 0, 0, 0, 0, 0]
		} else {
			norm = norm.map(v => v / sum)
		}
		let rounded = norm.map(v => Math.round(v * 100) / 100)
		let rsum = 0
		for (const v of rounded) rsum += v
		let diff = Math.round((1 - rsum) * 100) / 100
		let idx = 0
		let mx = -1
		for (let i = 0; i < rounded.length; i++) {
			if (rounded[i] > mx) {
				mx = rounded[i]
				idx = i
			}
		}
		rounded[idx] = Math.round((rounded[idx] + diff) * 100) / 100
		const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']
		for (let i = 0; i < ids.length; i++) {
			const el = document.getElementById(ids[i])
			if (el) el.value = String(rounded[i].toFixed(2))
		}
	}
	document
		.getElementById('probUniform')
		?.addEventListener('click', () => setProbabilities([1, 1, 1, 1, 1, 1]))
	document
		.getElementById('probLow')
		?.addEventListener('click', () =>
			setProbabilities([0.3, 0.25, 0.2, 0.15, 0.07, 0.03])
		)
	document
		.getElementById('probMid')
		?.addEventListener('click', () =>
			setProbabilities([0.1, 0.2, 0.25, 0.25, 0.15, 0.05])
		)
	document
		.getElementById('probHigh')
		?.addEventListener('click', () =>
			setProbabilities([0.05, 0.1, 0.15, 0.25, 0.25, 0.2])
		)
	document.getElementById('probZero')?.addEventListener('click', () => {
		setProbabilities([1, 0, 0, 0, 0, 0])
		const el = document.getElementById('maxMaskSize')
		if (el) el.value = '0'
	})
	// Enforce integer-only multipliers in inputs
	function enforceIntegerMultipliers() {
		for (const id of ['f0', 'f1', 'f2', 'f3', 'f4', 'f5']) {
			const el = document.getElementById(id)
			if (el) {
				const apply = () => {
					const v = Math.round(Number(el.value || 0))
					el.value = String(Math.max(0, v))
				}
				el.addEventListener('input', apply)
				el.addEventListener('change', apply)
				apply()
			}
		}
	}
	enforceIntegerMultipliers()
	function getProbPresets() {
		try {
			const s = localStorage.getItem('probPresets') || '{}'
			const obj = JSON.parse(s)
			if (obj && typeof obj === 'object') return obj
		} catch {}
		return {}
	}
	function setProbPresets(obj) {
		try {
			localStorage.setItem('probPresets', JSON.stringify(obj))
		} catch {}
	}
	function refreshProbPresetSelect() {
		const sel = document.getElementById('probPresetSelect')
		if (!sel) return
		while (sel.firstChild) sel.removeChild(sel.firstChild)
		const presets = getProbPresets()
		const names = Object.keys(presets)
		for (const n of names) {
			const opt = document.createElement('option')
			opt.value = n
			opt.textContent = n
			sel.appendChild(opt)
		}
	}
	document.getElementById('saveProbPreset')?.addEventListener('click', () => {
		const name = String(
			document.getElementById('probPresetName')?.value || ''
		).trim()
		if (!name) {
			showAlert('Preset name required')
			return
		}
		const maxMaskSize = Number(
			document.getElementById('maxMaskSize')?.value || 5
		)
		const p0 = Number(document.getElementById('p0').value)
		const p1 = Number(document.getElementById('p1').value)
		const p2 = Number(document.getElementById('p2').value)
		const p3 = Number(document.getElementById('p3').value)
		const p4 = Number(document.getElementById('p4').value)
		const p5 = Number(document.getElementById('p5').value)
		const arr = [p0, p1, p2, p3, p4, p5]
		const presets = getProbPresets()
		presets[name] = { maxMaskSize, dist: arr }
		setProbPresets(presets)
		refreshProbPresetSelect()
	})
	document.getElementById('loadProbPreset')?.addEventListener('click', () => {
		const sel = document.getElementById('probPresetSelect')
		const name = String(sel?.value || '')
		if (!name) return
		const presets = getProbPresets()
		const p = presets[name]
		if (!p) return
		if (typeof p.maxMaskSize === 'number') {
			const el = document.getElementById('maxMaskSize')
			if (el) el.value = String(p.maxMaskSize)
		}
		if (Array.isArray(p.dist) && p.dist.length === 6) {
			setProbabilities(p.dist)
		}
	})
	document
		.getElementById('setDefaultProbPreset')
		?.addEventListener('click', () => {
			const sel = document.getElementById('probPresetSelect')
			const name = String(sel?.value || '')
			if (!name) return
			try {
				localStorage.setItem('probDefaultName', name)
			} catch {}
		})
	function showAlert(msg) {
		alertBox.textContent = String(msg)
		alertBox.style.display = 'block'
	}
	function hideAlert() {
		alertBox.textContent = ''
		alertBox.style.display = 'none'
	}
	function showLoader() {
		if (loaderEl) loaderEl.style.display = 'block'
	}
	function hideLoader() {
		if (loaderEl) loaderEl.style.display = 'none'
	}
	function fmtUSD(v) {
		const n = Number(v || 0)
		const a = Math.abs(n)
		if (a >= 1e12) {
			const x = a / 1e12
			return `${n < 0 ? '-' : ''}$${x.toFixed(
				x < 10 ? 2 : x < 100 ? 1 : 0
			)}T`
		}
		if (a >= 1e9) {
			const x = a / 1e9
			return `${n < 0 ? '-' : ''}$${x.toFixed(
				x < 10 ? 2 : x < 100 ? 1 : 0
			)}B`
		}
		if (a >= 1e6) {
			const x = a / 1e6
			return `${n < 0 ? '-' : ''}$${x.toFixed(
				x < 10 ? 2 : x < 100 ? 1 : 0
			)}M`
		}
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 2,
		}).format(n)
	}
	function applyNumberRangeToPlayerInputs() {
		const min = 0
		const max = 9
		const ids = ['aG', 'aP', 'aO', 'aY', 'aB', 'bG', 'bP', 'bO', 'bY', 'bB']
		for (const id of ids) {
			const el = document.getElementById(id)
			if (el) {
				el.min = String(min)
				el.max = String(max)
				const v = Number(el.value)
				if (!Number.isFinite(v)) {
					el.value = String(min)
				} else if (v < min) {
					el.value = String(min)
				} else if (v > max) {
					el.value = String(max)
				}
			}
		}
	}
	const numberMinEl = document.getElementById('numberMin')
	const numberMaxEl = document.getElementById('numberMax')
	if (numberMinEl)
		numberMinEl.addEventListener('input', applyNumberRangeToPlayerInputs)
	if (numberMaxEl)
		numberMaxEl.addEventListener('input', applyNumberRangeToPlayerInputs)
	applyNumberRangeToPlayerInputs()
	try {
		const resp = await fetch('/health')
		const data = await resp.json()
		status.textContent = data.ok ? 'Server: OK' : 'Server: Not OK'
	} catch {
		status.textContent = 'Server: Unreachable'
	}
	refreshProbPresetSelect()
	try {
		const defName = localStorage.getItem('probDefaultName') || ''
		if (defName) {
			const presets = getProbPresets()
			const p = presets[defName]
			if (p) {
				if (typeof p.maxMaskSize === 'number') {
					const el = document.getElementById('maxMaskSize')
					if (el) el.value = String(p.maxMaskSize)
				}
				if (Array.isArray(p.dist) && p.dist.length === 6) {
					setProbabilities(p.dist)
				}
			}
		}
	} catch {}
	;(async function defaultTune() {
		try {
			const desired = Number(document.getElementById('desiredRTP').value)
			const p0 = Number(document.getElementById('p0').value)
			const p1 = Number(document.getElementById('p1').value)
			const p2 = Number(document.getElementById('p2').value)
			const p3 = Number(document.getElementById('p3').value)
			const p4 = Number(document.getElementById('p4').value)
			const p5 = Number(document.getElementById('p5').value)
			const seedAuto =
				'auto-' + Date.now() + '-' + Math.floor(Math.random() * 1e9)
			const seedEl = document.getElementById('seed')
			if (seedEl) seedEl.value = seedAuto
			const f0El = document.getElementById('f0')
			const f1El = document.getElementById('f1')
			const f2El = document.getElementById('f2')
			const f3El = document.getElementById('f3')
			const f4El = document.getElementById('f4')
			const f5El = document.getElementById('f5')
			const numberMin = Number(
				document.getElementById('numberMin')?.value || 0
			)
			const numberMax = Number(
				document.getElementById('numberMax')?.value || 9
			)
			const maxMaskSize = Number(
				document.getElementById('maxMaskSize')?.value || 5
			)
			if (
				!(
					Number.isInteger(numberMin) &&
					Number.isInteger(numberMax) &&
					numberMin <= numberMax
				)
			) {
				showAlert('Number range invalid')
				return
			}
			if (
				!(
					Number.isInteger(maxMaskSize) &&
					maxMaskSize >= 0 &&
					maxMaskSize <= 5
				)
			) {
				showAlert('Max mask size must be 0–5')
				return
			}
			const epoch = {
				maskSizeDistribution: {
					0: p0,
					1: p1,
					2: p2,
					3: p3,
					4: p4,
					5: p5,
				},
				fixedPrizeTable: {
					0: Number(f0El.value),
					1: Number(f1El.value),
					2: Number(f2El.value),
					3: Number(f3El.value),
					4: Number(f4El.value),
					5: Number(f5El.value),
				},
				seed: seedAuto,
				numberMin,
				numberMax,
				maxMaskSize,
			}
			const playerA = {
				id: 'A',
				balls: [
					{
						number: Number(document.getElementById('aG').value),
						color: 1,
					},
					{
						number: Number(document.getElementById('aP').value),
						color: 2,
					},
					{
						number: Number(document.getElementById('aO').value),
						color: 3,
					},
					{
						number: Number(document.getElementById('aY').value),
						color: 4,
					},
					{
						number: Number(document.getElementById('aB').value),
						color: 5,
					},
				],
				betAmount: Number(document.getElementById('betA')?.value) || 1,
			}
			const playerB = {
				id: 'B',
				balls: [
					{
						number: Number(document.getElementById('bG').value),
						color: 1,
					},
					{
						number: Number(document.getElementById('bP').value),
						color: 2,
					},
					{
						number: Number(document.getElementById('bO').value),
						color: 3,
					},
					{
						number: Number(document.getElementById('bY').value),
						color: 4,
					},
					{
						number: Number(document.getElementById('bB').value),
						color: 5,
					},
				],
				betAmount: Number(document.getElementById('betB')?.value) || 1,
			}
			const enableBetRange =
				!!document.getElementById('enableBetRange')?.checked
			let betMin = 1
			let betMax = 10
			if (enableBetRange) {
				betMin = Number(document.getElementById('betMin').value)
				betMax = Number(document.getElementById('betMax').value)
			}
			const tuneN = 1500
			const rnd = true
			const resp = await fetch('/simulate/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					epoch,
					playerA,
					playerB,
					N: tuneN,
					randomizeBet: enableBetRange,
					betMin: enableBetRange ? betMin : undefined,
					betMax: enableBetRange ? betMax : undefined,
					randomizePlayers: rnd,
					sampleOutcomes: 0,
				}),
			})
			if (!resp.ok) return
			const d = await resp.json()
			const currentRTP = Number(d?.metrics?.rtp || 0)
			const target = desired / 100
			if (currentRTP > 0 && Math.abs(currentRTP - target) > 0.005) {
				let factor = target / currentRTP
				if (!Number.isFinite(factor) || factor <= 0) return
				factor = Math.max(0.25, Math.min(4, factor))
				f0El.value = String(
					Math.max(0, Math.round(Number(f0El.value) * factor))
				)
				f1El.value = String(
					Math.max(0, Math.round(Number(f1El.value) * factor))
				)
				f2El.value = String(
					Math.max(0, Math.round(Number(f2El.value) * factor))
				)
				f3El.value = String(
					Math.max(0, Math.round(Number(f3El.value) * factor))
				)
				f4El.value = String(
					Math.max(0, Math.round(Number(f4El.value) * factor))
				)
				f5El.value = String(
					Math.max(0, Math.round(Number(f5El.value) * factor))
				)
				try {
					const resp2 = await fetch('/simulate/batch', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							epoch: {
								maskSizeDistribution: {
									0: p0,
									1: p1,
									2: p2,
									3: p3,
									4: p4,
									5: p5,
								},
								fixedPrizeTable: {
									0: Number(f0El.value),
									1: Number(f1El.value),
									2: Number(f2El.value),
									3: Number(f3El.value),
									4: Number(f4El.value),
									5: Number(f5El.value),
								},
								seed: seedAuto,
								numberMin: 0,
								numberMax: 9,
								maxMaskSize,
							},
							playerA,
							playerB,
							N: tuneN,
							randomizeBet: enableBetRange,
							betMin: enableBetRange ? betMin : undefined,
							betMax: enableBetRange ? betMax : undefined,
							randomizePlayers: rnd,
							sampleOutcomes: 0,
						}),
					})
					if (resp2.ok) {
						const d2 = await resp2.json()
						const afterRTP = Number(d2?.metrics?.rtp || 0)
						const diff = Math.abs(afterRTP - target)
						if (afterRTP > 0 && diff > 0.002) {
							let f2 = target / afterRTP
							if (Number.isFinite(f2) && f2 > 0) {
								f2 = Math.max(0.5, Math.min(2, f2))
								f0El.value = String(
									Math.max(
										0,
										Math.round(Number(f0El.value) * f2)
									)
								)
								f1El.value = String(
									Math.max(
										0,
										Math.round(Number(f1El.value) * f2)
									)
								)
								f2El.value = String(
									Math.max(
										0,
										Math.round(Number(f2El.value) * f2)
									)
								)
								f3El.value = String(
									Math.max(
										0,
										Math.round(Number(f3El.value) * f2)
									)
								)
								f4El.value = String(
									Math.max(
										0,
										Math.round(Number(f4El.value) * f2)
									)
								)
								f5El.value = String(
									Math.max(
										0,
										Math.round(Number(f5El.value) * f2)
									)
								)
							}
						}
					}
				} catch {}
			}
		} catch {}
	})()
	// Toggle advanced option inputs via checkboxes
	const enableBetRangeEl = document.getElementById('enableBetRange')
	const betMinEl = document.getElementById('betMin')
	const betMaxEl = document.getElementById('betMax')
	const enableMaxRowsEl = document.getElementById('enableMaxRows')
	const sampleLimitEl = document.getElementById('sampleLimit')
	function syncBetRangeDisabled() {
		const on = !!enableBetRangeEl?.checked
		if (betMinEl) betMinEl.disabled = !on
		if (betMaxEl) betMaxEl.disabled = !on
	}
	function syncMaxRowsDisabled() {
		const on = !!enableMaxRowsEl?.checked
		if (sampleLimitEl) sampleLimitEl.disabled = !on
	}
	enableBetRangeEl?.addEventListener('change', syncBetRangeDisabled)
	enableMaxRowsEl?.addEventListener('change', syncMaxRowsDisabled)
	syncBetRangeDisabled()
	syncMaxRowsDisabled()
	document.getElementById('runBatchN').addEventListener('click', async () => {
		hideAlert()
		const runBtn = document.getElementById('runBatchN')
		const bar = document.getElementById('batchProgressBar')
		const ptxt = document.getElementById('batchProgressText')
		const cancelBtn = document.getElementById('cancelBatch')
		let cancel = false
		let controller = null
		if (cancelBtn) {
			cancelBtn.disabled = false
			cancelBtn.onclick = () => {
				cancel = true
				if (controller && typeof controller.abort === 'function') {
					try {
						controller.abort()
					} catch {}
				}
				if (ptxt) ptxt.textContent = 'Cancelling…'
				cancelBtn.disabled = true
			}
		}
		const p0 = Number(document.getElementById('p0').value)
		const p1 = Number(document.getElementById('p1').value)
		const p2 = Number(document.getElementById('p2').value)
		const p3 = Number(document.getElementById('p3').value)
		const p4 = Number(document.getElementById('p4').value)
		const p5 = Number(document.getElementById('p5').value)
		const seedAuto =
			'auto-' + Date.now() + '-' + Math.floor(Math.random() * 1e9)
		const seedEl = document.getElementById('seed')
		if (seedEl) seedEl.value = seedAuto
		const f0 = Number(document.getElementById('f0').value)
		const f1 = Number(document.getElementById('f1').value)
		const f2 = Number(document.getElementById('f2').value)
		const f3 = Number(document.getElementById('f3').value)
		const f4 = Number(document.getElementById('f4').value)
		const f5 = Number(document.getElementById('f5').value)
		const distSum = p0 + p1 + p2 + p3 + p4 + p5
		if (!Number.isFinite(distSum)) {
			showAlert('p0..p5 must be numbers')
			return
		}
		if (Math.abs(distSum - 1) > 1e-3) {
			showAlert('p0..p5 must sum to 1')
			return
		}
		setProbabilities([p0, p1, p2, p3, p4, p5])
		const N = Number(document.getElementById('repeatN').value)
		if (!(Number.isInteger(N) && N >= 1)) {
			showAlert('N must be an integer ≥ 1')
			return
		}
		const enableBetRange =
			!!document.getElementById('enableBetRange')?.checked
		let betMin = 1
		let betMax = 10
		if (enableBetRange) {
			betMin = Number(document.getElementById('betMin').value)
			betMax = Number(document.getElementById('betMax').value)
			if (
				!(
					Number.isFinite(betMin) &&
					Number.isFinite(betMax) &&
					betMin > 0 &&
					betMax >= betMin
				)
			) {
				showAlert('Bet range invalid')
				return
			}
		}
		const numberMinVal = 0
		const numberMaxVal = 9
		if (
			!(
				Number.isInteger(numberMinVal) &&
				Number.isInteger(numberMaxVal) &&
				numberMinVal <= numberMaxVal
			)
		) {
			showAlert('Number range invalid')
			return
		}
		if (runBtn) {
			runBtn.disabled = true
			runBtn.dataset.prev = runBtn.textContent
			runBtn.textContent = 'Running…'
		}
		showLoader()
		const epoch = {
			maskSizeDistribution: { 0: p0, 1: p1, 2: p2, 3: p3, 4: p4, 5: p5 },
			fixedPrizeTable: { 0: f0, 1: f1, 2: f2, 3: f3, 4: f4, 5: f5 },
			seed: seedAuto,
			numberMin: 0,
			numberMax: 9,
			maxMaskSize: Number(
				document.getElementById('maxMaskSize')?.value || 5
			),
		}
		const playerA = {
			id: 'A',
			balls: [
				{
					number: Number(document.getElementById('aG').value),
					color: 1,
				},
				{
					number: Number(document.getElementById('aP').value),
					color: 2,
				},
				{
					number: Number(document.getElementById('aO').value),
					color: 3,
				},
				{
					number: Number(document.getElementById('aY').value),
					color: 4,
				},
				{
					number: Number(document.getElementById('aB').value),
					color: 5,
				},
			],
			betAmount: Number(document.getElementById('betA')?.value) || 1,
		}
		const playerB = {
			id: 'B',
			balls: [
				{
					number: Number(document.getElementById('bG').value),
					color: 1,
				},
				{
					number: Number(document.getElementById('bP').value),
					color: 2,
				},
				{
					number: Number(document.getElementById('bO').value),
					color: 3,
				},
				{
					number: Number(document.getElementById('bY').value),
					color: 4,
				},
				{
					number: Number(document.getElementById('bB').value),
					color: 5,
				},
			],
			betAmount: Number(document.getElementById('betB')?.value) || 1,
		}
		const outEl = document.getElementById('batchOut')
		const start = Date.now()
		let done = 0
		let totalPrizeAcc = 0
		let totalMAcc = 0
		let totalBetRevenueAcc = 0
		const distributionAcc = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
		const matchesPerColorAcc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
		const colorPresenceAcc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
		const maskColorFrequencyAcc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
		const cancellationsPerColorAcc = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
		const outcomesSample = []
		const sampleIdxs = []
		function updateProgress() {
			const pct = Math.min(100, Math.floor((done / N) * 100))
			if (bar) bar.style.width = `${pct}%`
			const elapsed = (Date.now() - start) / 1000
			const rate = done > 0 ? done / elapsed : 0
			const remain = N - done
			const eta = rate > 0 ? Math.ceil(remain / rate) : 0
			const mins = Math.floor(eta / 60)
			const secs = eta % 60
			if (ptxt)
				ptxt.textContent = `Progress: ${pct}% | ETA ${mins}m ${secs}s`
		}
		const fast = !!document.getElementById('fastMode')?.checked
		const fullSample = !!document.getElementById('fullSample')?.checked
		const enableMaxRows =
			!!document.getElementById('enableMaxRows')?.checked
		const sampleLimitEl2 = document.getElementById('sampleLimit')
		const sampleLimitVal = Number(sampleLimitEl2?.value) || 0
		const sampleLimit = enableMaxRows
			? Math.max(100, Math.min(200000, sampleLimitVal || 0))
			: 0
		const maxSample = enableMaxRows ? sampleLimit : N
		const chunkSize = fast
			? Math.max(10000, Math.floor(N / 4) || 10000)
			: Math.max(1000, Math.min(10000, Math.floor(N / 10) || 1000))
		while (done < N) {
			const remain = N - done
			const take = Math.min(chunkSize, remain)
			if (cancel) break
			let resp
			try {
				controller = new AbortController()
				resp = await fetch('/simulate/batch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						epoch,
						playerA,
						playerB,
						N: take,
						offset: done,
						randomizeBet: enableBetRange,
						betMin: enableBetRange ? betMin : undefined,
						betMax: enableBetRange ? betMax : undefined,
						randomizePlayers: true,
						sampleOutcomes: enableMaxRows
							? Math.max(0, sampleLimit - outcomesSample.length)
							: Math.max(0, N - outcomesSample.length),
					}),
					signal: controller.signal,
				})
			} catch (e) {
				if (cancel || (e && e.name === 'AbortError')) {
					break
				} else {
					outEl.textContent = `Request failed: ${String(e)}`
					if (runBtn) {
						runBtn.disabled = false
						runBtn.textContent =
							runBtn.dataset.prev || 'Run N Simulations'
					}
					if (cancelBtn) cancelBtn.disabled = true
					hideLoader()
					return
				}
			}
			if (!resp.ok) {
				let err = ''
				try {
					const d = await resp.json()
					err = d?.error || JSON.stringify(d)
				} catch {
					err = `HTTP ${resp.status}`
				}
				showAlert(`Error: ${err}`)
				outEl.textContent = ''
				if (runBtn) {
					runBtn.disabled = false
					runBtn.textContent =
						runBtn.dataset.prev || 'Run N Simulations'
				}
				if (cancelBtn) cancelBtn.disabled = true
				hideLoader()
				return
			}
			const chunk = await resp.json()
			const baseIdx = done
			totalPrizeAcc += Number(chunk.metrics?.totalPrize || 0)
			totalMAcc += Number(chunk.metrics?.avgM || 0) * take
			totalBetRevenueAcc += Number(chunk.metrics?.totalBetRevenue || 0)
			for (const k of [0, 1, 2, 3, 4, 5]) {
				distributionAcc[k] += Number(
					chunk.metrics?.distributionM?.[k] || 0
				)
			}
			for (const c of [1, 2, 3, 4, 5]) {
				matchesPerColorAcc[c] += Number(
					chunk.metrics?.matchesPerColor?.[c] || 0
				)
				colorPresenceAcc[c] += Number(
					chunk.metrics?.colorPresence?.[c] || 0
				)
				maskColorFrequencyAcc[c] += Number(
					chunk.metrics?.maskColorFrequency?.[c] || 0
				)
				cancellationsPerColorAcc[c] += Number(
					chunk.metrics?.cancellationsPerColor?.[c] || 0
				)
			}
			if (
				Array.isArray(chunk.outcomes) &&
				outcomesSample.length < maxSample
			) {
				for (let j = 0; j < chunk.outcomes.length; j++) {
					const o = chunk.outcomes[j]
					if (outcomesSample.length >= maxSample) break
					outcomesSample.push(o)
					sampleIdxs.push(baseIdx + j)
				}
			}
			done += take
			updateProgress()
		}
		hideAlert()
		const totalBetRevenue = totalBetRevenueAcc
		const rtp = totalBetRevenue > 0 ? totalPrizeAcc / totalBetRevenue : 0
		const payoutRatio = rtp
		const houseEdge = 1 - rtp
		const bankProfit = totalBetRevenue - totalPrizeAcc
		const m = {
			count: done,
			totalPrize: totalPrizeAcc,
			totalBetRevenue,
			payoutRatio,
			rtp,
			houseEdge,
			bankProfit,
			avgPrize: done > 0 ? totalPrizeAcc / done : 0,
			avgM: done > 0 ? totalMAcc / done : 0,
			distributionM: distributionAcc,
			matchesPerColor: matchesPerColorAcc,
			colorPresence: colorPresenceAcc,
			maskColorFrequency: maskColorFrequencyAcc,
			cancellationsPerColor: cancellationsPerColorAcc,
		}
		function xorshift32(state) {
			let x = state >>> 0
			x ^= x << 13
			x ^= x >>> 17
			x ^= x << 5
			return x >>> 0
		}
		function hashSeed(str) {
			let h = 2166136261 >>> 0
			for (let i = 0; i < str.length; i++) {
				h ^= str.charCodeAt(i)
				h = Math.imul(h, 16777619)
			}
			return h >>> 0
		}
		function rng(seedStr) {
			let s = hashSeed(seedStr)
			return () => {
				s = xorshift32(s)
				return (s >>> 0) / 4294967296
			}
		}
		function countMatches(mask, rem) {
			const set = new Set((rem || []).map(b => `${b.number}-${b.color}`))
			let k = 0
			for (const w of mask || []) {
				if (set.has(`${w.number}-${w.color}`)) k++
			}
			return k
		}
		let expectedPrizeAcc = 0
		const span = Math.max(
			0,
			(enableBetRange ? betMax : 1) - (enableBetRange ? betMin : 1)
		)
		for (let i = 0; i < outcomesSample.length; i++) {
			let a = Number(document.getElementById('betA')?.value) || 1
			let b = Number(document.getElementById('betB')?.value) || 1
			if (enableBetRange) {
				const r = rng(epoch.seed + ':bet:' + i)
				a =
					betMin +
					Math.floor(r() * (Math.max(0, betMax - betMin) + 1))
				b =
					betMin +
					Math.floor(r() * (Math.max(0, betMax - betMin) + 1))
			}
			const o = outcomesSample[i]
			const mA = countMatches(o?.winningMask, o?.remainingA)
			const mB = countMatches(o?.winningMask, o?.remainingB)
			const pA = (epoch.fixedPrizeTable[mA] ?? 0) * a
			const pB = (epoch.fixedPrizeTable[mB] ?? 0) * b
			expectedPrizeAcc += pA + pB
		}
		const prizeCheckOK =
			Math.abs(expectedPrizeAcc - (m.totalPrize || 0)) <= 0.01
		function distHTML(dist) {
			return [0, 1, 2, 3, 4, 5]
				.map(k => `m${k}:${dist[k] ?? 0}`)
				.join(' | ')
		}
		function distFromOutcomes(arr) {
			const d = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
			for (const o of arr || []) {
				const k = Number(o?.m || 0)
				if (k >= 0 && k <= 5) d[k] = (d[k] ?? 0) + 1
			}
			return d
		}
		function colorCountsHTML(label, counts) {
			return `
        <span class="badge bg-G">G</span> ${counts[1] ?? 0}
        <span class="badge bg-P">P</span> ${counts[2] ?? 0}
        <span class="badge bg-O">O</span> ${counts[3] ?? 0}
        <span class="badge bg-Y">Y</span> ${counts[4] ?? 0}
        <span class="badge bg-B">B</span> ${counts[5] ?? 0}
      `
		}
		const cmap = { 1: 'G', 2: 'P', 3: 'O', 4: 'Y', 5: 'B' }
		function pct(v) {
			return `${(Number(v || 0) * 100).toFixed(2)}%`
		}
		const cancelledNote = cancel
			? `<div class="small">Cancelled after ${done}/${N} runs</div>`
			: ''
		const desiredVal = Number(
			document.getElementById('desiredRTP')?.value || 0
		)
		const targetDesired = desiredVal > 0 ? desiredVal / 100 : 0
		outEl.innerHTML = `
      ${cancelledNote}
      <div class="metrics-grid">
        <div class="metric"><strong>Count</strong><br/>${m.count}</div>
        <div class="metric"><strong>Total prize</strong><br/>${fmtUSD(
			m.totalPrize
		)} <a id="viewPayouts" style="color:#2563eb;font-size:12px;cursor:pointer">view player payouts</a></div>
        <div class="metric"><strong>Prize check</strong><br/>${fmtUSD(
			expectedPrizeAcc
		)} ${prizeCheckOK ? '✅' : '⚠️'}</div>
        <div class="metric"><strong>Total bet revenue</strong><br/>${fmtUSD(
			m.totalBetRevenue || 0
		)} <a id="viewBets" style="color:#2563eb;font-size:12px;cursor:pointer">view player bets</a></div>
		<div class="metric"><strong>Payout ratio</strong><br/>${pct(
			m.payoutRatio
		)}</div>
        <div class="metric"><strong>RTP</strong><br/>${pct(m.rtp)}</div>
        ${
			targetDesired > 0
				? `<div class="metric"><strong>Target RTP</strong><br/>${pct(
						targetDesired
				  )}</div>`
				: ''
		}
        ${
			targetDesired > 0
				? `<div class="metric"><strong>Δ to target</strong><br/>${pct(
						m.rtp - targetDesired
				  )}</div>`
				: ''
		}
        <div class="metric"><strong>House edge</strong><br/>${pct(
			m.houseEdge
		)}</div>
        <div class="metric"><strong>Bank profit</strong><br/>${fmtUSD(
			m.bankProfit || 0
		)}</div>
        <div class="metric"><strong>Avg prize</strong><br/>${fmtUSD(
			m.avgPrize
		)}</div>
        <div class="metric"><strong>Avg matches</strong><br/>${Number(
			m.avgM
		).toFixed(2)}</div>
        <div class="metric"><strong>Distribution</strong><br/>${distHTML(
			m.distributionM
		)}</div>
        <div class="metric"><strong>Sample (captured)</strong><br/>${distHTML(
			distFromOutcomes(outcomesSample)
		)}</div>
        <div class="metric"><strong>Matches per color</strong><br/>
          <span class="badge bg-G">G</span> ${m.matchesPerColor[1] ?? 0}
          <span class="badge bg-P">P</span> ${m.matchesPerColor[2] ?? 0}
          <span class="badge bg-O">O</span> ${m.matchesPerColor[3] ?? 0}
          <span class="badge bg-Y">Y</span> ${m.matchesPerColor[4] ?? 0}
          <span class="badge bg-B">B</span> ${m.matchesPerColor[5] ?? 0}
        </div>
        <div class="metric"><strong>Color presence</strong><br/>${colorCountsHTML(
			'Presence',
			m.colorPresence || {}
		)}</div>
        <div class="metric"><strong>Mask color frequency</strong><br/>${colorCountsHTML(
			'MaskFreq',
			m.maskColorFrequency || {}
		)}</div>
        <div class="metric"><strong>Cancellations per color</strong><br/>${colorCountsHTML(
			'Cancels',
			m.cancellationsPerColor || {}
		)}</div>
      </div>
      <div class="small" style="margin-top:8px">Outcomes sample</div>
      <div class="row" style="margin:6px 0; gap:8px; align-items:center">
        <label>Match count</label>
        <select id="fltMExact">
          <option value="all">All</option>
          <option value="0">m = 0</option>
          <option value="1">m = 1</option>
          <option value="2">m = 2</option>
          <option value="3">m = 3</option>
          <option value="4">m = 4</option>
          <option value="5">m = 5</option>
        </select>
        <label>Prize</label>
        <select id="fltPrizeMode">
          <option value="any">Any</option>
          <option value="gt0">Prize > 0</option>
          <option value="eq0">Prize = 0</option>
        </select>
        <label>Require match in colors</label>
        <span class="badge bg-G">G</span><input type="checkbox" id="fltC1"/>
        <span class="badge bg-P">P</span><input type="checkbox" id="fltC2"/>
        <span class="badge bg-O">O</span><input type="checkbox" id="fltC3"/>
        <span class="badge bg-Y">Y</span><input type="checkbox" id="fltC4"/>
        <span class="badge bg-B">B</span><input type="checkbox" id="fltC5"/>
        <label>Sort</label>
        <select id="sortBy">
          <option value="index">Index</option>
          <option value="m">m</option>
          <option value="prize">Prize</option>
        </select>
        <select id="sortDir">
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
        <label>Page size</label><input type="number" id="pageSize" value="50" min="10" max="200" step="10"/>
        <button id="prevPage">Prev</button>
        <span id="pageInfo" class="small"></span>
        <button id="nextPage">Next</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>m</th><th>Prize</th><th>Winning Mask</th><th>Color Matches</th></tr></thead>
        <tbody id="outcomesTBody">${
			outcomesSample.length
				? ''
				: `<tr><td colspan="5">Sample disabled (Fast mode)</td></tr>`
		}</tbody>
      </table></div>
      <div id="sampleDist" class="small" style="margin-top:6px"></div>
      <div id="maskDistPanel" class="small" style="margin-top:4px"></div>
    `
		if (runBtn) {
			runBtn.disabled = false
			runBtn.textContent = runBtn.dataset.prev || 'Run N Simulations'
		}
		if (cancelBtn) cancelBtn.disabled = true
		hideLoader()
		updateProgress()
		if (outcomesSample.length) {
			const viewBetsLink = document.getElementById('viewBets')
			const viewPayoutsLink = document.getElementById('viewPayouts')
			function openModal(id) {
				const el = document.getElementById(id)
				if (el) el.style.display = 'block'
			}
			function closeModal(id) {
				const el = document.getElementById(id)
				if (el) el.style.display = 'none'
			}
			const betsClose = document.getElementById('betsModalClose')
			if (betsClose) betsClose.onclick = () => closeModal('betsModal')
			const payoutsClose = document.getElementById('payoutsModalClose')
			if (payoutsClose)
				payoutsClose.onclick = () => closeModal('payoutsModal')
			function xorshift32(state) {
				let x = state >>> 0
				x ^= x << 13
				x ^= x >>> 17
				x ^= x << 5
				return x >>> 0
			}
			function hashSeed(str) {
				let h = 2166136261 >>> 0
				for (let i = 0; i < str.length; i++) {
					h ^= str.charCodeAt(i)
					h = Math.imul(h, 16777619)
				}
				return h >>> 0
			}
			function rng(seedStr) {
				let s = hashSeed(seedStr)
				return () => {
					s = xorshift32(s)
					return (s >>> 0) / 4294967296
				}
			}
			function countMatches(mask, rem) {
				const set = new Set(
					(rem || []).map(b => `${b.number}-${b.color}`)
				)
				let k = 0
				for (const w of mask || []) {
					if (set.has(`${w.number}-${w.color}`)) k++
				}
				return k
			}
			if (viewBetsLink) {
				viewBetsLink.onclick = () => {
					const body = document.getElementById('betsModalBody')
					if (!body) return
					const N = Number(document.getElementById('repeatN').value)
					const enableBetRange =
						!!document.getElementById('enableBetRange')?.checked
					let betMin =
						Number(document.getElementById('betMin')?.value) || 1
					let betMax =
						Number(document.getElementById('betMax')?.value) || 10
					const aFixed =
						Number(document.getElementById('betA')?.value) || 1
					const bFixed =
						Number(document.getElementById('betB')?.value) || 1
					let sumA = 0
					let sumB = 0
					let sumEff = 0
					const sampleRows = []
					for (let i = 0; i < outcomesSample.length; i++) {
						const idx = sampleIdxs[i]
						let a = aFixed
						let b = bFixed
						if (enableBetRange) {
							const r = rng(epoch.seed + ':bet:' + idx)
							const span = Math.max(0, betMax - betMin)
							a = betMin + Math.floor(r() * (span + 1))
							b = betMin + Math.floor(r() * (span + 1))
						}
						const o = outcomesSample[i]
						const ms = Array.isArray(o?.winningMask)
							? o.winningMask.length
							: 0
						const eff = (a + b) / 2
						sumA += a
						sumB += b
						sumEff += eff
						sampleRows.push({
							i: idx + 1,
							a,
							b,
							eff,
							ms,
						})
					}
					const estFactor =
						outcomesSample.length > 0
							? N / outcomesSample.length
							: 0
					function renderBets(maskSel, effMin, effMax) {
						const baseRows = sampleRows
						const byMask =
							typeof maskSel === 'number'
								? baseRows.filter(r => r.ms === maskSel)
								: baseRows
						const rowsToShow = byMask.filter(r => {
							const minOk =
								typeof effMin === 'number'
									? r.eff >= effMin
									: true
							const maxOk =
								typeof effMax === 'number'
									? r.eff <= effMax
									: true
							return minOk && maxOk
						})
						const distMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						for (const r of baseRows)
							distMs[r.ms] = (distMs[r.ms] ?? 0) + 1
						const sumA2 = rowsToShow.reduce(
							(acc, r) => acc + r.a,
							0
						)
						const sumB2 = rowsToShow.reduce(
							(acc, r) => acc + r.b,
							0
						)
						const sumEff2 = rowsToShow.reduce(
							(acc, r) => acc + r.eff,
							0
						)
						const estEff2 = sumEff2 * estFactor
						const htmlRows = rowsToShow
							.map(
								r =>
									`<tr><td>${r.i}</td><td>${r.a}</td><td>${
										r.b
									}</td><td>${r.eff.toFixed(2)}</td></tr>`
							)
							.join('')
						const infoNote = `Rows: ${rowsToShow.length}/${sampleRows.length} | Repeat N: ${N}`
						const expectedTotal = Number(m?.totalBetRevenue || 0)
						const displayTotal =
							outcomesSample.length === N ? sumEff2 : estEff2
						const status =
							outcomesSample.length === N &&
							rowsToShow.length === sampleRows.length
								? Math.abs(displayTotal - expectedTotal) <= 0.01
									? 'OK'
									: 'Mismatch'
								: 'Estimate'
						body.innerHTML = `
            <div class="row" style="align-items:center; gap:12px">
              <label class="small">Mask size:
                <select id="betsMaskSizeFilter">
                  <option value="all"${
						typeof maskSel !== 'number' ? ' selected' : ''
					}>All</option>
                  <option value="0"${maskSel === 0 ? ' selected' : ''}>k0 (${
							distMs[0] ?? 0
						})</option>
                  <option value="1"${maskSel === 1 ? ' selected' : ''}>k1 (${
							distMs[1] ?? 0
						})</option>
                  <option value="2"${maskSel === 2 ? ' selected' : ''}>k2 (${
							distMs[2] ?? 0
						})</option>
                  <option value="3"${maskSel === 3 ? ' selected' : ''}>k3 (${
							distMs[3] ?? 0
						})</option>
                  <option value="4"${maskSel === 4 ? ' selected' : ''}>k4 (${
							distMs[4] ?? 0
						})</option>
                  <option value="5"${maskSel === 5 ? ' selected' : ''}>k5 (${
							distMs[5] ?? 0
						})</option>
                </select>
              </label>
              <label class="small">Effective ≥
                <input type="number" id="effMin" value="${
					typeof effMin === 'number' ? effMin : ''
				}" placeholder="" style="width:80px" />
              </label>
              <label class="small">Effective ≤
                <input type="number" id="effMax" value="${
					typeof effMax === 'number' ? effMax : ''
				}" placeholder="" style="width:80px" />
              </label>
              <div class="small">${infoNote}</div>
            </div>
            <div class="row" style="gap:12px">
              <div><strong>Player A subtotal (filtered)</strong><br/>${fmtUSD(
					sumA2
				)}</div>
              <div><strong>Player B subtotal (filtered)</strong><br/>${fmtUSD(
					sumB2
				)}</div>
              <div><strong>Total bet revenue (filtered)</strong><br/>${fmtUSD(
					outcomesSample.length === N ? sumEff2 : estEff2
				)}</div>
              <div class="small"><strong>Verification</strong><br/>Display ${fmtUSD(
					displayTotal
				)} vs Metrics ${fmtUSD(expectedTotal)} • ${status}</div>
            </div>
            <div class="table-wrap" style="margin-top:8px"><table>
              <thead><tr><th>#</th><th>Bet A</th><th>Bet B</th><th>Effective</th></tr></thead>
              <tbody>${htmlRows}</tbody>
            </table></div>
          `
						const sel =
							document.getElementById('betsMaskSizeFilter')
						if (sel)
							sel.onchange = () =>
								renderBets(
									(() => {
										const v = String(
											document.getElementById(
												'betsMaskSizeFilter'
											)?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('effMin')
												?.value || ''
										)
										return v === '' ? undefined : Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('effMax')
												?.value || ''
										)
										return v === '' ? undefined : Number(v)
									})()
								)
						const effMinEl = document.getElementById('effMin')
						const effMaxEl = document.getElementById('effMax')
						const apply = () =>
							renderBets(
								(() => {
									const v = String(
										document.getElementById(
											'betsMaskSizeFilter'
										)?.value || 'all'
									)
									return v === 'all' ? undefined : Number(v)
								})(),
								(() => {
									const v = String(
										document.getElementById('effMin')
											?.value || ''
									)
									return v === '' ? undefined : Number(v)
								})(),
								(() => {
									const v = String(
										document.getElementById('effMax')
											?.value || ''
									)
									return v === '' ? undefined : Number(v)
								})()
							)
						if (effMinEl) {
							effMinEl.addEventListener('input', apply)
							effMinEl.addEventListener('change', apply)
						}
						if (effMaxEl) {
							effMaxEl.addEventListener('input', apply)
							effMaxEl.addEventListener('change', apply)
						}
					}
					renderBets(undefined, undefined, undefined)
					openModal('betsModal')
				}
			}
			if (viewPayoutsLink) {
				viewPayoutsLink.onclick = () => {
					const body = document.getElementById('payoutsModalBody')
					if (!body) return
					const enableBetRange =
						!!document.getElementById('enableBetRange')?.checked
					let betMin =
						Number(document.getElementById('betMin')?.value) || 1
					let betMax =
						Number(document.getElementById('betMax')?.value) || 10
					const aFixed =
						Number(document.getElementById('betA')?.value) || 1
					const bFixed =
						Number(document.getElementById('betB')?.value) || 1
					let sumPA = 0
					let sumPB = 0
					const sampleRows = []
					for (let i = 0; i < outcomesSample.length; i++) {
						const o = outcomesSample[i]
						const idx = sampleIdxs[i]
						let a = aFixed
						let b = bFixed
						if (enableBetRange) {
							const r = rng(epoch.seed + ':bet:' + idx)
							const span = Math.max(0, betMax - betMin)
							a = betMin + Math.floor(r() * (span + 1))
							b = betMin + Math.floor(r() * (span + 1))
						}
						const mA = countMatches(o?.winningMask, o?.remainingA)
						const mB = countMatches(o?.winningMask, o?.remainingB)
						const ms = Array.isArray(o?.winningMask)
							? o.winningMask.length
							: 0
						const pA = (epoch.fixedPrizeTable[mA] ?? 0) * a
						const pB = (epoch.fixedPrizeTable[mB] ?? 0) * b
						sumPA += pA
						sumPB += pB
						sampleRows.push({
							i: idx + 1,
							a,
							b,
							mA,
							mB,
							ms,
							pA,
							pB,
							t: pA + pB,
						})
					}
					const N =
						Number(document.getElementById('repeatN')?.value) || 0
					const estFactor =
						outcomesSample.length > 0
							? N / outcomesSample.length
							: 0
					const fullNote =
						outcomesSample.length === N
							? 'Computed over all runs'
							: `Estimated totals scaled from sample of ${outcomesSample.length} runs`
					function renderPayouts(winOnly, maskSel, mSelA, mSelB) {
						const baseRows = winOnly
							? sampleRows.filter(r => r.pA > 0 || r.pB > 0)
							: sampleRows
						const rowsByMask =
							typeof maskSel === 'number'
								? baseRows.filter(r => r.ms === maskSel)
								: baseRows
						const rowsToShow = rowsByMask.filter(r => {
							const aOk =
								typeof mSelA === 'number'
									? r.mA === mSelA
									: true
							const bOk =
								typeof mSelB === 'number'
									? r.mB === mSelB
									: true
							return aOk && bOk
						})
						const distMs = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						for (const r of baseRows)
							distMs[r.ms] = (distMs[r.ms] ?? 0) + 1
						const distMA = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						const distMB = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						for (const r of baseRows) {
							if (r.mA >= 0 && r.mA <= 5)
								distMA[r.mA] = (distMA[r.mA] ?? 0) + 1
							if (r.mB >= 0 && r.mB <= 5)
								distMB[r.mB] = (distMB[r.mB] ?? 0) + 1
						}
						const sumPA2 = winOnly
							? rowsToShow.reduce((acc, r) => acc + r.pA, 0)
							: sumPA
						const sumPB2 = winOnly
							? rowsToShow.reduce((acc, r) => acc + r.pB, 0)
							: sumPB
						const estPA2 = sumPA2 * estFactor
						const estPB2 = sumPB2 * estFactor
						const htmlRows = rowsToShow
							.map(
								r =>
									`<tr><td>${r.i}</td><td>${r.a}</td><td>${
										r.b
									}</td><td>${r.mA} [${
										epoch.fixedPrizeTable[r.mA] ?? 0
									}×${r.a}]</td><td>${r.mB} [${
										epoch.fixedPrizeTable[r.mB] ?? 0
									}×${r.b}]</td><td>${fmtUSD(
										r.pA
									)}</td><td>${fmtUSD(r.pB)}</td><td>${fmtUSD(
										r.t
									)}</td></tr>`
							)
							.join('')
						const infoNote = `${fullNote} — Rows: ${rowsToShow.length}/${sampleRows.length} | Repeat N: ${N}`
						const aSubtotal = fmtUSD(
							outcomesSample.length === N ? sumPA2 : estPA2
						)
						const bSubtotal = fmtUSD(
							outcomesSample.length === N ? sumPB2 : estPB2
						)
						const totalSubtotal = fmtUSD(
							outcomesSample.length === N
								? sumPA2 + sumPB2
								: estPA2 + estPB2
						)
						const aG = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						const bG = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
						for (const r of rowsToShow) {
							if (r.mA >= 0 && r.mA <= 5)
								aG[r.mA] = (aG[r.mA] ?? 0) + 1
							if (r.mB >= 0 && r.mB <= 5)
								bG[r.mB] = (bG[r.mB] ?? 0) + 1
						}
						const expectedTotal = Number(m?.totalPrize || 0)
						const displayTotal =
							outcomesSample.length === N
								? sumPA2 + sumPB2
								: estPA2 + estPB2
						const status =
							outcomesSample.length === N
								? Math.abs(displayTotal - expectedTotal) <= 0.01
									? 'OK'
									: 'Mismatch'
								: 'Estimate'
						body.innerHTML = `
            <div class="row" style="align-items:center; gap:12px">
              <label class="small"><input type="checkbox" id="winOnlyFilter"${
					winOnly ? ' checked' : ''
				} /> Wins-only</label>
              <label class="small">Mask size:
                <select id="maskSizeFilter">
                  <option value="all"${
						typeof maskSel !== 'number' ? ' selected' : ''
					}>All</option>
                  <option value="0"${maskSel === 0 ? ' selected' : ''}>k0 (${
							distMs[0] ?? 0
						})</option>
                  <option value="1"${maskSel === 1 ? ' selected' : ''}>k1 (${
							distMs[1] ?? 0
						})</option>
                  <option value="2"${maskSel === 2 ? ' selected' : ''}>k2 (${
							distMs[2] ?? 0
						})</option>
                  <option value="3"${maskSel === 3 ? ' selected' : ''}>k3 (${
							distMs[3] ?? 0
						})</option>
                  <option value="4"${maskSel === 4 ? ' selected' : ''}>k4 (${
							distMs[4] ?? 0
						})</option>
                  <option value="5"${maskSel === 5 ? ' selected' : ''}>k5 (${
							distMs[5] ?? 0
						})</option>
                </select>
              </label>
              <label class="small">mA:
                <select id="mAFilter">
                  <option value="all"${
						typeof mSelA !== 'number' ? ' selected' : ''
					}>All</option>
                  <option value="0"${mSelA === 0 ? ' selected' : ''}>mA=0 (${
							distMA[0] ?? 0
						})</option>
                  <option value="1"${mSelA === 1 ? ' selected' : ''}>mA=1 (${
							distMA[1] ?? 0
						})</option>
                  <option value="2"${mSelA === 2 ? ' selected' : ''}>mA=2 (${
							distMA[2] ?? 0
						})</option>
                  <option value="3"${mSelA === 3 ? ' selected' : ''}>mA=3 (${
							distMA[3] ?? 0
						})</option>
                  <option value="4"${mSelA === 4 ? ' selected' : ''}>mA=4 (${
							distMA[4] ?? 0
						})</option>
                  <option value="5"${mSelA === 5 ? ' selected' : ''}>mA=5 (${
							distMA[5] ?? 0
						})</option>
                </select>
              </label>
              <label class="small">mB:
                <select id="mBFilter">
                  <option value="all"${
						typeof mSelB !== 'number' ? ' selected' : ''
					}>All</option>
                  <option value="0"${mSelB === 0 ? ' selected' : ''}>mB=0 (${
							distMB[0] ?? 0
						})</option>
                  <option value="1"${mSelB === 1 ? ' selected' : ''}>mB=1 (${
							distMB[1] ?? 0
						})</option>
                  <option value="2"${mSelB === 2 ? ' selected' : ''}>mB=2 (${
							distMB[2] ?? 0
						})</option>
                  <option value="3"${mSelB === 3 ? ' selected' : ''}>mB=3 (${
							distMB[3] ?? 0
						})</option>
                  <option value="4"${mSelB === 4 ? ' selected' : ''}>mB=4 (${
							distMB[4] ?? 0
						})</option>
                  <option value="5"${mSelB === 5 ? ' selected' : ''}>mB=5 (${
							distMB[5] ?? 0
						})</option>
                </select>
              </label>
              <div class="small">${infoNote}</div>
            </div>
            <div class="row" style="gap:12px">
              <div><strong>Player A subtotal${
					winOnly ? ' (wins-only)' : ''
				}</strong><br/>${aSubtotal}</div>
              <div><strong>Player B subtotal${
					winOnly ? ' (wins-only)' : ''
				}</strong><br/>${bSubtotal}</div>
              <div><strong>Total prize${
					winOnly ? ' (wins-only)' : ''
				}</strong><br/>${totalSubtotal}</div>
            </div>
            <div class="table-wrap" style="margin-top:8px"><table>
              <thead><tr><th>#</th><th>Bet A</th><th>Bet B</th><th>mA</th><th>mB</th><th>Payout A</th><th>Payout B</th><th>Total</th></tr></thead>
              <tbody>${htmlRows}</tbody>
            </table></div>
            <div class="small" style="margin-top:6px">
              <div><strong>Groups mA</strong> — 0:${aG[0]} 1:${aG[1]} 2:${
							aG[2]
						} 3:${aG[3]} 4:${aG[4]} 5:${aG[5]}</div>
              <div><strong>Groups mB</strong> — 0:${bG[0]} 1:${bG[1]} 2:${
							bG[2]
						} 3:${bG[3]} 4:${bG[4]} 5:${bG[5]}</div>
              <div><strong>Verification</strong> — Display ${fmtUSD(
					displayTotal
				)} vs Metrics ${fmtUSD(expectedTotal)} • ${status}</div>
            </div>
          `
						const chk = document.getElementById('winOnlyFilter')
						if (chk)
							chk.onchange = () =>
								renderPayouts(
									!!document.getElementById('winOnlyFilter')
										?.checked,
									(() => {
										const v = String(
											document.getElementById(
												'maskSizeFilter'
											)?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mAFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mBFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})()
								)
						const sel = document.getElementById('maskSizeFilter')
						if (sel)
							sel.onchange = () =>
								renderPayouts(
									!!document.getElementById('winOnlyFilter')
										?.checked,
									(() => {
										const v = String(
											document.getElementById(
												'maskSizeFilter'
											)?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mAFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mBFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})()
								)
						const selA = document.getElementById('mAFilter')
						if (selA)
							selA.onchange = () =>
								renderPayouts(
									!!document.getElementById('winOnlyFilter')
										?.checked,
									(() => {
										const v = String(
											document.getElementById(
												'maskSizeFilter'
											)?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mAFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mBFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})()
								)
						const selB = document.getElementById('mBFilter')
						if (selB)
							selB.onchange = () =>
								renderPayouts(
									!!document.getElementById('winOnlyFilter')
										?.checked,
									(() => {
										const v = String(
											document.getElementById(
												'maskSizeFilter'
											)?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mAFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})(),
									(() => {
										const v = String(
											document.getElementById('mBFilter')
												?.value || 'all'
										)
										return v === 'all'
											? undefined
											: Number(v)
									})()
								)
					}
					renderPayouts(false)
					openModal('payoutsModal')
				}
			}
			let page = 1
			function getFilters() {
				const mExact = String(
					document.getElementById('fltMExact')?.value || 'all'
				)
				const prizeMode = String(
					document.getElementById('fltPrizeMode')?.value || 'any'
				)
				const colors = [1, 2, 3, 4, 5].filter(
					c => !!document.getElementById('fltC' + c)?.checked
				)
				const sortBy = String(
					document.getElementById('sortBy')?.value || 'index'
				)
				const sortDir = String(
					document.getElementById('sortDir')?.value || 'asc'
				)
				const pageSize = Math.max(
					10,
					Math.min(
						200,
						Number(document.getElementById('pageSize').value) || 50
					)
				)
				return { mExact, prizeMode, colors, sortBy, sortDir, pageSize }
			}
			function isValidBall(b) {
				return (
					b &&
					typeof b.number === 'number' &&
					Number.isFinite(b.number) &&
					typeof b.color === 'number' &&
					b.color >= 1 &&
					b.color <= 5
				)
			}
			function matchesSelectedColors(o, sel) {
				if (!sel.length) return true
				const remSet = new Set([
					...(o.remainingA || [])
						.filter(isValidBall)
						.map(b => `${b.number}-${b.color}`),
					...(o.remainingB || [])
						.filter(isValidBall)
						.map(b => `${b.number}-${b.color}`),
				])
				for (const w of (o.winningMask || []).filter(isValidBall)) {
					if (
						remSet.has(`${w.number}-${w.color}`) &&
						sel.includes(w.color)
					)
						return true
				}
				return false
			}
			function render() {
				const { mExact, prizeMode, colors, sortBy, sortDir, pageSize } =
					getFilters()
				const withIndex = outcomesSample.map((o, i) => ({ o, i }))
				let arr = withIndex.filter(x => {
					const mOk =
						mExact === 'all' ? true : x.o.m === Number(mExact)
					const pOk =
						prizeMode === 'any'
							? true
							: prizeMode === 'gt0'
							? Number(x.o.prize) > 0
							: Number(x.o.prize) === 0
					const cOk = matchesSelectedColors(x.o, colors)
					return mOk && pOk && cOk
				})
				const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
				for (const x of arr) dist[x.o.m] = (dist[x.o.m] ?? 0) + 1
				arr.sort((a, b) => {
					let va = 0
					let vb = 0
					if (sortBy === 'index') {
						va = a.i
						vb = b.i
					} else if (sortBy === 'm') {
						va = a.o.m
						vb = b.o.m
					} else if (sortBy === 'prize') {
						va = Number(a.o.prize)
						vb = Number(b.o.prize)
					}
					return sortDir === 'asc' ? va - vb : vb - va
				})
				const total = arr.length
				const pages = Math.max(1, Math.ceil(total / pageSize))
				if (page > pages) page = pages
				if (page < 1) page = 1
				const start = (page - 1) * pageSize
				const slice = arr.slice(start, start + pageSize)
				const cmap = { 1: 'G', 2: 'P', 3: 'O', 4: 'Y', 5: 'B' }
				const rows = slice
					.map(({ o, i }) => {
						const remSet = new Set([
							...(o.remainingA || [])
								.filter(isValidBall)
								.map(b => `${b.number}-${b.color}`),
							...(o.remainingB || [])
								.filter(isValidBall)
								.map(b => `${b.number}-${b.color}`),
						])
						const wm =
							Array.isArray(o.winningMask) && o.winningMask.length
								? o.winningMask
										.filter(isValidBall)
										.map(
											b =>
												`<span class="badge bg-${
													cmap[b.color]
												}">${cmap[b.color]} ${
													b.number
												}</span>`
										)
										.join(' ')
								: 'Empty'
						const cm =
							Array.isArray(o.winningMask) && o.winningMask.length
								? o.winningMask
										.filter(isValidBall)
										.filter(b =>
											remSet.has(`${b.number}-${b.color}`)
										)
										.map(
											b =>
												`<span class="badge bg-${
													cmap[b.color]
												}">${cmap[b.color]}</span>`
										)
										.join(' ')
								: ''
						return `<tr>
              <td>${i + 1}</td>
              <td>${o.m}</td>
              <td>${fmtUSD(Number(o.prize))}</td>
              <td>${wm}</td>
              <td>${cm || '-'}</td>
            </tr>`
					})
					.join('')
				const tbody = document.getElementById('outcomesTBody')
				if (tbody)
					tbody.innerHTML =
						rows || '<tr><td colspan="5">No rows</td></tr>'
				const info = document.getElementById('pageInfo')
				if (info)
					info.textContent = `Page ${page}/${pages} • ${total} rows`
				const sd = document.getElementById('sampleDist')
				if (sd)
					sd.textContent = `Sample distribution (n:${total}): m0:${dist[0]} | m1:${dist[1]} | m2:${dist[2]} | m3:${dist[3]} | m4:${dist[4]} | m5:${dist[5]}`
				const md = document.getElementById('maskDistPanel')
				if (md) {
					const kDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
					for (const x of arr) {
						const k = x.o.winningMask?.length ?? 0
						if (kDist.hasOwnProperty(k))
							kDist[k] = (kDist[k] ?? 0) + 1
					}
					const p0 = Number(document.getElementById('p0').value)
					const p1 = Number(document.getElementById('p1').value)
					const p2 = Number(document.getElementById('p2').value)
					const p3 = Number(document.getElementById('p3').value)
					const p4 = Number(document.getElementById('p4').value)
					const p5 = Number(document.getElementById('p5').value)
					md.textContent = `Mask size distribution: k0:${
						kDist[0]
					} | k1:${kDist[1]} | k2:${kDist[2]} | k3:${kDist[3]} | k4:${
						kDist[4]
					} | k5:${kDist[5]} • Configured: p0:${Number(p0).toFixed(
						2
					)} | p1:${Number(p1).toFixed(2)} | p2:${Number(p2).toFixed(
						2
					)} | p3:${Number(p3).toFixed(2)} | p4:${Number(p4).toFixed(
						2
					)} | p5:${Number(p5).toFixed(2)}`
				}
			}
			for (const id of [
				'fltMExact',
				'fltPrizeMode',
				'fltC1',
				'fltC2',
				'fltC3',
				'fltC4',
				'fltC5',
				'sortBy',
				'sortDir',
				'pageSize',
			]) {
				const el = document.getElementById(id)
				if (el)
					el.addEventListener('change', () => {
						page = 1
						render()
					})
			}
			const prev = document.getElementById('prevPage')
			const next = document.getElementById('nextPage')
			if (prev)
				prev.addEventListener('click', () => {
					page = Math.max(1, page - 1)
					render()
				})
			if (next)
				next.addEventListener('click', () => {
					page = page + 1
					render()
				})
			render()
		}
	})
	;(function setupTuneToggle() {
		const toggle = document.getElementById('enableAutoTune')
		const desired = document.getElementById('desiredRTP')
		const btn = document.getElementById('autoTuneRTP')
		function getAutoPrefs() {
			try {
				const s = localStorage.getItem('autoTunePrefs') || '{}'
				const obj = JSON.parse(s)
				if (obj && typeof obj === 'object') return obj
			} catch {}
			return {}
		}
		function setAutoPrefs(obj) {
			try {
				localStorage.setItem('autoTunePrefs', JSON.stringify(obj))
			} catch {}
		}
		const saved = getAutoPrefs()
		if (desired && typeof saved.desired === 'number') {
			desired.value = String(saved.desired)
		}
		if (toggle && typeof saved.enable === 'boolean') {
			toggle.checked = !!saved.enable
		}
		function apply() {
			const on = !!toggle?.checked
			if (desired) desired.disabled = !on
			if (btn) btn.disabled = !on
		}
		if (toggle) {
			toggle.addEventListener('change', () => {
				apply()
				setAutoPrefs({
					enable: !!toggle.checked,
					desired: Number(desired?.value || 0),
				})
			})
			if (desired) {
				const upd = () =>
					setAutoPrefs({
						enable: !!toggle.checked,
						desired: Number(desired?.value || 0),
					})
				desired.addEventListener('input', upd)
				desired.addEventListener('change', upd)
			}
			apply()
		} else {
			if (desired) desired.disabled = true
			if (btn) btn.disabled = true
		}
	})()
	;(function setupTabs() {
		const navR = document.getElementById('tabNavRng')
		const navG = document.getElementById('tabNavRules')
		const tabR = document.getElementById('tabRNG')
		const tabG = document.getElementById('tabRules')
		function showR() {
			if (tabR) tabR.style.display = ''
			if (tabG) tabG.style.display = 'none'
			if (navR) navR.classList.add('btn-primary')
			if (navG) navG.classList.remove('btn-primary')
		}
		function showG() {
			if (tabR) tabR.style.display = 'none'
			if (tabG) tabG.style.display = ''
			if (navR) navR.classList.remove('btn-primary')
			if (navG) navG.classList.add('btn-primary')
		}
		if (navR) navR.addEventListener('click', showR)
		if (navG) navG.addEventListener('click', showG)
		showR()
	})()
	document
		.getElementById('autoTuneRTP')
		.addEventListener('click', async () => {
			hideAlert()
			const btnEl = document.getElementById('autoTuneRTP')
			if (btnEl) {
				btnEl.disabled = true
				btnEl.dataset.prev = btnEl.textContent
				btnEl.textContent = 'Tuning…'
			}
			showLoader()
			function restore() {
				if (btnEl) {
					btnEl.disabled = false
					btnEl.textContent = btnEl.dataset.prev || '🔧 Autofine-tune'
				}
				hideLoader()
			}
			const desired = Number(document.getElementById('desiredRTP').value)
			if (!(Number.isFinite(desired) && desired > 0)) {
				showAlert('Desired RTP must be > 0')
				restore()
				return
			}
			const target = desired / 100
			const p0 = Number(document.getElementById('p0').value)
			const p1 = Number(document.getElementById('p1').value)
			const p2 = Number(document.getElementById('p2').value)
			const p3 = Number(document.getElementById('p3').value)
			const p4 = Number(document.getElementById('p4').value)
			const p5 = Number(document.getElementById('p5').value)
			const seedAuto =
				'auto-' + Date.now() + '-' + Math.floor(Math.random() * 1e9)
			const seedEl = document.getElementById('seed')
			if (seedEl) seedEl.value = seedAuto
			const f0El = document.getElementById('f0')
			const f1El = document.getElementById('f1')
			const f2El = document.getElementById('f2')
			const f3El = document.getElementById('f3')
			const f4El = document.getElementById('f4')
			const f5El = document.getElementById('f5')
			const numberMin = 0
			const numberMax = 9
			const epoch = {
				maskSizeDistribution: {
					0: p0,
					1: p1,
					2: p2,
					3: p3,
					4: p4,
					5: p5,
				},
				fixedPrizeTable: {
					0: Number(f0El.value),
					1: Number(f1El.value),
					2: Number(f2El.value),
					3: Number(f3El.value),
					4: Number(f4El.value),
					5: Number(f5El.value),
				},
				seed: seedAuto,
				numberMin: 0,
				numberMax: 9,
				maxMaskSize: Number(
					document.getElementById('maxMaskSize')?.value || 5
				),
			}
			const playerA = {
				id: 'A',
				balls: [
					{
						number: Number(document.getElementById('aG').value),
						color: 1,
					},
					{
						number: Number(document.getElementById('aP').value),
						color: 2,
					},
					{
						number: Number(document.getElementById('aO').value),
						color: 3,
					},
					{
						number: Number(document.getElementById('aY').value),
						color: 4,
					},
					{
						number: Number(document.getElementById('aB').value),
						color: 5,
					},
				],
			}
			const playerB = {
				id: 'B',
				balls: [
					{
						number: Number(document.getElementById('bG').value),
						color: 1,
					},
					{
						number: Number(document.getElementById('bP').value),
						color: 2,
					},
					{
						number: Number(document.getElementById('bO').value),
						color: 3,
					},
					{
						number: Number(document.getElementById('bY').value),
						color: 4,
					},
					{
						number: Number(document.getElementById('bB').value),
						color: 5,
					},
				],
			}
			const betMin = Number(document.getElementById('betMin').value)
			const betMax = Number(document.getElementById('betMax').value)
			const tuneN = 5000
			const rnd = true
			let resp
			try {
				resp = await fetch('/simulate/batch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						epoch,
						playerA,
						playerB,
						N: tuneN,
						randomizeBet: true,
						betMin,
						betMax,
						randomizePlayers: rnd,
						sampleOutcomes: 0,
					}),
				})
			} catch (e) {
				showAlert(`Request failed: ${String(e)}`)
				restore()
				return
			}
			if (!resp.ok) {
				let err = ''
				try {
					const d = await resp.json()
					err = d?.error || JSON.stringify(d)
				} catch {
					err = `HTTP ${resp.status}`
				}
				showAlert(`Error: ${err}`)
				restore()
				return
			}
			const data = await resp.json()
			const currentRTP = Number(data?.metrics?.rtp || 0)
			if (!(currentRTP > 0)) {
				showAlert('Current RTP is 0; adjust prizes or ticket price')
				restore()
				return
			}
			const before = [
				Number(f0El.value),
				Number(f1El.value),
				Number(f2El.value),
				Number(f3El.value),
				Number(f4El.value),
				Number(f5El.value),
			]
			let factor = target / currentRTP
			if (!Number.isFinite(factor) || factor <= 0) {
				showAlert('Invalid scaling factor; check inputs')
				restore()
				return
			}
			factor = Math.max(0.25, Math.min(4, factor))
			const base = [
				Number(f0El.value),
				Number(f1El.value),
				Number(f2El.value),
				Number(f3El.value),
				Number(f4El.value),
				Number(f5El.value),
			]
			let scale = factor
			function applyScale() {
				f0El.value = String(Math.max(0, Math.round(base[0] * scale)))
				f1El.value = String(Math.max(0, Math.round(base[1] * scale)))
				f2El.value = String(Math.max(0, Math.round(base[2] * scale)))
				f3El.value = String(Math.max(0, Math.round(base[3] * scale)))
				f4El.value = String(Math.max(0, Math.round(base[4] * scale)))
				f5El.value = String(Math.max(0, Math.round(base[5] * scale)))
			}
			applyScale()
			let iterations = 1
			let afterRTP = 0
			for (let i = 0; i < 6; i++) {
				let resp2
				try {
					resp2 = await fetch('/simulate/batch', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							epoch: {
								maskSizeDistribution: {
									0: p0,
									1: p1,
									2: p2,
									3: p3,
									4: p4,
									5: p5,
								},
								fixedPrizeTable: {
									0: Number(f0El.value),
									1: Number(f1El.value),
									2: Number(f2El.value),
									3: Number(f3El.value),
									4: Number(f4El.value),
									5: Number(f5El.value),
								},
								seed: seedAuto,
								numberMin: 0,
								numberMax: 9,
							},
							playerA,
							playerB,
							N: tuneN,
							randomizeBet: true,
							betMin,
							betMax,
							randomizePlayers: rnd,
							sampleOutcomes: 0,
						}),
					})
				} catch (e) {
					showAlert(`Request failed: ${String(e)}`)
					restore()
					return
				}
				if (!resp2.ok) {
					let err = ''
					try {
						const d2 = await resp2.json()
						err = d2?.error || JSON.stringify(d2)
					} catch {
						err = `HTTP ${resp2.status}`
					}
					showAlert(`Error: ${err}`)
					restore()
					return
				}
				const data2 = await resp2.json()
				afterRTP = Number(data2?.metrics?.rtp || 0)
				if (!(afterRTP > 0)) break
				const diff = Math.abs(afterRTP - target)
				if (diff <= 0.001) break
				let step = target / afterRTP
				if (!Number.isFinite(step) || step <= 0) break
				step = Math.max(0.85, Math.min(1.15, step))
				scale = scale * step
				applyScale()
				iterations++
			}
			if (afterRTP <= 0) afterRTP = target
			showAlert(
				`Autofine-tuned prizes with factor ${scale.toFixed(
					3
				)} (${iterations} iterations)`
			)
			const after = [
				Number(f0El.value),
				Number(f1El.value),
				Number(f2El.value),
				Number(f3El.value),
				Number(f4El.value),
				Number(f5El.value),
			]
			function pct(v) {
				return `${(Number(v || 0) * 100).toFixed(2)}%`
			}
			const tuneEl = document.getElementById('tuneOut')
			const rows = [0, 1, 2, 3, 4, 5]
				.map(
					k =>
						`<tr><td>${k}</td><td>${Math.round(
							Number(before[k])
						)}X</td><td>${Math.round(Number(after[k]))}X</td></tr>`
				)
				.join('')
			const estRTP = afterRTP
			const delta = estRTP - target
			const absErr = Math.abs(delta)
			const tuneHTML = `
        <div class="metrics-grid">
          <div class="metric"><strong>Desired RTP</strong><br/>${pct(
				target
			)}</div>
          <div class="metric"><strong>Before RTP</strong><br/>${pct(
				currentRTP
			)}</div>
          <div class="metric"><strong>After RTP</strong><br/>${pct(
				estRTP
			)}</div>
          <div class="metric"><strong>RTP Δ vs desired</strong><br/>${pct(
				delta
			)}</div>
          <div class="metric"><strong>Abs error</strong><br/>${pct(
				absErr
			)}</div>
          <div class="metric"><strong>Scaling factor</strong><br/>${scale.toFixed(
				3
			)}</div>
          <div class="metric"><strong>Avg bet (est)</strong><br/>${Number(
				(betMin + betMax) / 2
			).toFixed(2)}</div>
          <div class="metric"><strong>Calibration runs</strong><br/>${tuneN}</div>
          <div class="metric"><strong>Iterations</strong><br/>${iterations}</div>
        </div>
        <div class="table-wrap" style="margin-top:8px"><table>
          <thead><tr><th>m</th><th>Before</th><th>After</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      `
			if (tuneEl) tuneEl.innerHTML = tuneHTML
			;(function showTuneModal() {
				const modal = document.getElementById('tuneModal')
				const body = document.getElementById('tuneModalBody')
				const bar = document.getElementById('tuneModalProgressBar')
				const txt = document.getElementById('tuneModalCountdown')
				const closeBtn = document.getElementById('tuneModalClose')
				if (body) body.innerHTML = tuneHTML
				let remain = 20
				function render() {
					if (txt) txt.textContent = `Closing in ${remain}s`
					if (bar)
						bar.style.width = `${Math.max(
							0,
							Math.floor((remain / 20) * 100)
						)}%`
				}
				let timer = null
				function open() {
					if (modal) modal.style.display = 'flex'
					remain = 20
					render()
					timer = setInterval(() => {
						remain--
						render()
						if (remain <= 0) {
							close()
						}
					}, 1000)
				}
				function close() {
					if (timer) {
						clearInterval(timer)
						timer = null
					}
					if (modal) modal.style.display = 'none'
				}
				if (closeBtn) {
					closeBtn.onclick = () => {
						close()
					}
				}
				open()
			})()
			restore()
		})
	// Randomize and swap controls
	function randNum() {
		const min = 0
		const max = 9
		const span = Math.max(0, max - min + 1)
		return min + Math.floor(Math.random() * span)
	}
	function randBet() {
		const min = Number(document.getElementById('betMin')?.value || 1)
		const max = Number(document.getElementById('betMax')?.value || 10)
		const span = Math.max(0, max - min)
		return min + Math.floor(Math.random() * (span + 1))
	}
	function setPlayerVals(prefix, vals) {
		document.getElementById(prefix + 'G').value = vals[0]
		document.getElementById(prefix + 'P').value = vals[1]
		document.getElementById(prefix + 'O').value = vals[2]
		document.getElementById(prefix + 'Y').value = vals[3]
		document.getElementById(prefix + 'B').value = vals[4]
	}
	function setPlayerBet(prefix, v) {
		const el = document.getElementById('bet' + prefix.toUpperCase())
		if (el) el.value = String(v)
	}
	function getPlayerVals(prefix) {
		return [
			Number(document.getElementById(prefix + 'G').value),
			Number(document.getElementById(prefix + 'P').value),
			Number(document.getElementById(prefix + 'O').value),
			Number(document.getElementById(prefix + 'Y').value),
			Number(document.getElementById(prefix + 'B').value),
		]
	}
	document.getElementById('randA').addEventListener('click', () => {
		setPlayerVals('a', [
			randNum(),
			randNum(),
			randNum(),
			randNum(),
			randNum(),
		])
		setPlayerBet('a', randBet())
	})
	document.getElementById('randB').addEventListener('click', () => {
		setPlayerVals('b', [
			randNum(),
			randNum(),
			randNum(),
			randNum(),
			randNum(),
		])
		setPlayerBet('b', randBet())
	})
	document.getElementById('randBoth').addEventListener('click', () => {
		setPlayerVals('a', [
			randNum(),
			randNum(),
			randNum(),
			randNum(),
			randNum(),
		])
		setPlayerVals('b', [
			randNum(),
			randNum(),
			randNum(),
			randNum(),
			randNum(),
		])
		setPlayerBet('a', randBet())
		setPlayerBet('b', randBet())
	})
	document.getElementById('swapPlayers').addEventListener('click', () => {
		const a = getPlayerVals('a')
		const b = getPlayerVals('b')
		setPlayerVals('a', b)
		setPlayerVals('b', a)
		const betAEl = document.getElementById('betA')
		const betBEl = document.getElementById('betB')
		if (betAEl && betBEl) {
			const tmp = betAEl.value
			betAEl.value = betBEl.value
			betBEl.value = tmp
		}
	})
	document.getElementById('simulate').addEventListener('click', async () => {
		hideAlert()
		const simBtn = document.getElementById('simulate')
		const p0 = Number(document.getElementById('p0').value)
		const p1 = Number(document.getElementById('p1').value)
		const p2 = Number(document.getElementById('p2').value)
		const p3 = Number(document.getElementById('p3').value)
		const p4 = Number(document.getElementById('p4').value)
		const p5 = Number(document.getElementById('p5').value)
		const seedAuto =
			'auto-' + Date.now() + '-' + Math.floor(Math.random() * 1e9)
		const seedEl = document.getElementById('seed')
		if (seedEl) seedEl.value = seedAuto
		const f0 = Number(document.getElementById('f0').value)
		const f1 = Number(document.getElementById('f1').value)
		const f2 = Number(document.getElementById('f2').value)
		const f3 = Number(document.getElementById('f3').value)
		const f4 = Number(document.getElementById('f4').value)
		const f5 = Number(document.getElementById('f5').value)
		const aG = Number(document.getElementById('aG').value)
		const aP = Number(document.getElementById('aP').value)
		const aO = Number(document.getElementById('aO').value)
		const aY = Number(document.getElementById('aY').value)
		const aB = Number(document.getElementById('aB').value)
		const bG = Number(document.getElementById('bG').value)
		const bP = Number(document.getElementById('bP').value)
		const bO = Number(document.getElementById('bO').value)
		const bY = Number(document.getElementById('bY').value)
		const bB = Number(document.getElementById('bB').value)
		const betA = Number(document.getElementById('betA')?.value || 1)
		const betB = Number(document.getElementById('betB')?.value || 1)
		const numberMin = 0
		const numberMax = 9
		function isIntInRange(n, min, max) {
			return Number.isInteger(n) && n >= min && n <= max
		}
		function isNonNeg(n) {
			return Number.isFinite(n) && n >= 0
		}
		const invalid = []
		const distSum = p0 + p1 + p2 + p3 + p4 + p5
		if (!Number.isFinite(distSum)) {
			invalid.push('p0..p5 must be numbers')
		} else if (Math.abs(distSum - 1) > 1e-3) {
			invalid.push('p0..p5 must sum to 1')
		} else {
			// normalize to exactly 1 for numerical stability and UI consistency
			setProbabilities([p0, p1, p2, p3, p4, p5])
		}
		if (!isNonNeg(f0)) invalid.push('f0 must be ≥ 0')
		if (!isNonNeg(f1)) invalid.push('f1 must be ≥ 0')
		if (!isNonNeg(f2)) invalid.push('f2 must be ≥ 0')
		if (!isNonNeg(f3)) invalid.push('f3 must be ≥ 0')
		if (!isNonNeg(f4)) invalid.push('f4 must be ≥ 0')
		if (!isNonNeg(f5)) invalid.push('f5 must be ≥ 0')
		if (!isIntInRange(aG, numberMin, numberMax))
			invalid.push(`A:G must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(aP, numberMin, numberMax))
			invalid.push(`A:P must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(aO, numberMin, numberMax))
			invalid.push(`A:O must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(aY, numberMin, numberMax))
			invalid.push(`A:Y must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(aB, numberMin, numberMax))
			invalid.push(`A:B must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(bG, numberMin, numberMax))
			invalid.push(`B:G must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(bP, numberMin, numberMax))
			invalid.push(`B:P must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(bO, numberMin, numberMax))
			invalid.push(`B:O must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(bY, numberMin, numberMax))
			invalid.push(`B:Y must be ${numberMin}–${numberMax}`)
		if (!isIntInRange(bB, numberMin, numberMax))
			invalid.push(`B:B must be ${numberMin}–${numberMax}`)
		if (!(Number.isFinite(betA) && betA > 0))
			invalid.push('Bet A must be > 0')
		if (!(Number.isFinite(betB) && betB > 0))
			invalid.push('Bet B must be > 0')
		if (invalid.length) {
			showAlert(invalid.join('; '))
			const out = document.getElementById('out')
			out.textContent = ''
			return
		}
		if (simBtn) {
			simBtn.disabled = true
			simBtn.dataset.prev = simBtn.textContent
			simBtn.textContent = 'Simulating…'
		}
		showLoader()
		const epoch = {
			maskSizeDistribution: { 0: p0, 1: p1, 2: p2, 3: p3, 4: p4, 5: p5 },
			fixedPrizeTable: { 0: f0, 1: f1, 2: f2, 3: f3, 4: f4, 5: f5 },
			seed: seedAuto,
			numberMin,
			numberMax,
			maxMaskSize: Math.max(
				1,
				Number(document.getElementById('maxMaskSize')?.value || 5)
			),
		}
		const playerA = {
			id: 'A',
			balls: [
				{
					number: aG,
					color: 1,
				},
				{
					number: aP,
					color: 2,
				},
				{
					number: aO,
					color: 3,
				},
				{
					number: aY,
					color: 4,
				},
				{
					number: aB,
					color: 5,
				},
			],
			betAmount: betA,
		}
		const playerB = {
			id: 'B',
			balls: [
				{
					number: bG,
					color: 1,
				},
				{
					number: bP,
					color: 2,
				},
				{
					number: bO,
					color: 3,
				},
				{
					number: bY,
					color: 4,
				},
				{
					number: bB,
					color: 5,
				},
			],
			betAmount: betB,
		}
		let resp
		const out = document.getElementById('out')
		try {
			resp = await fetch('/simulate/match', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					epoch,
					playerA,
					playerB,
				}),
			})
		} catch (e) {
			out.textContent = `Request failed: ${String(e)}`
			if (simBtn) {
				simBtn.disabled = false
				simBtn.textContent = simBtn.dataset.prev || 'Simulate Match'
			}
			hideLoader()
			return
		}
		if (!resp.ok) {
			let err = ''
			try {
				const data = await resp.json()
				err = data?.error || JSON.stringify(data)
			} catch {
				err = `HTTP ${resp.status}`
			}
			showAlert(`Error: ${err}`)
			out.textContent = ''
			if (simBtn) {
				simBtn.disabled = false
				simBtn.textContent = simBtn.dataset.prev || 'Simulate Match'
			}
			hideLoader()
			return
		}
		const data = await resp.json()
		hideAlert()
		const cmap = { 1: 'G', 2: 'P', 3: 'O', 4: 'Y', 5: 'B' }
		function ballsHTML(arr) {
			return arr
				.map(
					b =>
						`<span class="badge bg-${cmap[b.color]}">${
							cmap[b.color]
						} ${b.number}</span>`
				)
				.join(' ')
		}
		const wm =
			Array.isArray(data.winningMask) && data.winningMask.length
				? ballsHTML(data.winningMask)
				: 'Empty'
		const remA = ballsHTML(data.remainingA || [])
		const remB = ballsHTML(data.remainingB || [])
		const cancelled = ballsHTML(data.cancelled || [])
		const elim = Array.isArray(data.eliminatedNumbers)
			? data.eliminatedNumbers.join(', ')
			: ''
		out.innerHTML = `
      <div><strong>m</strong>: ${data.m} | <strong>Prize</strong>: ${fmtUSD(
			Number(data.prize)
		)}</div>
      <div><strong>Winning Mask</strong>: ${wm}</div>
      <div><strong>Remaining A</strong>: ${remA || 'None'}</div>
      <div><strong>Remaining B</strong>: ${remB || 'None'}</div>
      <div><strong>Cancelled</strong>: ${cancelled || 'None'}</div>
      <div><strong>Eliminated numbers</strong>: ${elim || 'None'}</div>
    `
		if (simBtn) {
			simBtn.disabled = false
			simBtn.textContent = simBtn.dataset.prev || 'Simulate Match'
		}
		hideLoader()
	})
}
init()
