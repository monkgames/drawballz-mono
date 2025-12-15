const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')

function readLatex(texPath) {
	const raw = fs.readFileSync(texPath, 'utf8')
	const meta = {
		title: (raw.match(/\\title\{([^}]*)\}/) || [
			,
			'Drawballz: Formal Specification',
		])[1],
		author: (raw.match(/\\author\{([^}]*)\}/) || [, ''])[1],
		date: (raw.match(/\\date\{([^}]*)\}/) || [, ''])[1],
	}
	const start = raw.indexOf('\\begin{document}')
	const end = raw.indexOf('\\end{document}')
	const body = start !== -1 && end !== -1 ? raw.slice(start + 16, end) : raw
	return { meta, body }
}

function normalizeInlineLatex(s) {
	s = s.replace(/\r/g, '')
	s = s.replace(/\\texttt\{([^}]*)\}/g, '$1')
	s = s.replace(/\\emph\{([^}]*)\}/g, '$1')
	s = s.replace(/\\verb!\s*([^!]*)!/g, '$1')
	s = s.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)')
	s = s.replace(/\\url\{([^}]*)\}/g, '$1')
	s = s.replace(/%[^\n]*\n/g, '\n')
	s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => eq)
	s = s.replace(/\\\(([^\)]*)\\\)/g, '$1')
	s = s.replace(/\\newcommand\{[^}]*\}\{[^}]*\}/g, '')
	return s
}

function tokenizeLatex(body) {
	const tokens = []
	let s = normalizeInlineLatex(body)
	let i = 0
	const nextIndex = (re, pos) => {
		const m = re.exec(s.slice(pos))
		return m ? pos + m.index : -1
	}
	while (i < s.length) {
		const idxVerb = nextIndex(/\\begin\{verbatim\}/, i)
		const idxSec = nextIndex(/\\section\*?\{[^}]*\}/, i)
		const idxSub = nextIndex(/\\subsection\*?\{[^}]*\}/, i)
		const idxItem = nextIndex(/\\begin\{itemize\}|\\begin\{enumerate\}/, i)
		const idxs = [idxVerb, idxSec, idxSub, idxItem].filter(x => x !== -1)
		const next = idxs.length ? Math.min(...idxs) : -1
		if (next === -1) {
			const para = s.slice(i).trim()
			if (para) tokens.push({ type: 'paragraph', text: para })
			break
		}
		if (next > i) {
			const para = s.slice(i, next).trim()
			if (para) tokens.push({ type: 'paragraph', text: para })
			i = next
		}
		if (next === idxSec || next === idxSub) {
			const re =
				next === idxSec
					? /\\section\*?\{([^}]*)\}/
					: /\\subsection\*?\{([^}]*)\}/
			const m = re.exec(s.slice(i))
			if (m) {
				tokens.push({
					type: 'heading',
					level: next === idxSec ? 1 : 2,
					text: m[1].trim(),
				})
				i += m[0].length
				continue
			}
		}
		if (next === idxVerb) {
			const endRe = /\\end\{verbatim\}/
			const endIdx = nextIndex(endRe, idxVerb)
			if (endIdx !== -1) {
				const content = s
					.slice(idxVerb + '\\begin{verbatim}'.length + 2, endIdx)
					.trim()
				tokens.push({ type: 'code', text: content })
				i = endIdx + '\\end{verbatim}'.length + 2
				continue
			}
		}
		if (next === idxItem) {
			const isEnum = s.slice(idxItem, idxItem + 18).includes('enumerate')
			const endRe = isEnum ? /\\end\{enumerate\}/ : /\\end\{itemize\}/
			const endIdx = nextIndex(endRe, idxItem)
			if (endIdx !== -1) {
				const inner = s.slice(idxItem, endIdx)
				const items = inner
					.split(/\\item/)
					.slice(1)
					.map(t => t.replace(/^\s+/, '').replace(/\s+$/, ''))
				tokens.push({ type: 'list', ordered: isEnum, items })
				i =
					endIdx +
					(isEnum
						? '\\end{enumerate}'.length + 2
						: '\\end{itemize}'.length + 2)
				continue
			}
		}
		i += 1
	}
	return tokens
}

function drawHeaderFooter(doc, title, pageNum) {
	const { width, height, margins } = doc.page
	doc.save()
	// Header line
	doc.font('Helvetica').fontSize(9).fillColor('#666')
	doc.text(title, margins.left, margins.top - 30, {
		width: width - margins.left - margins.right,
		align: 'left',
	})
	doc.moveTo(margins.left, margins.top - 12)
		.lineTo(width - margins.right, margins.top - 12)
		.strokeColor('#e0e0e0')
		.lineWidth(1)
		.stroke()
	// Footer with page number
	doc.moveTo(margins.left, height - margins.bottom + 10)
		.lineTo(width - margins.right, height - margins.bottom + 10)
		.strokeColor('#e0e0e0')
		.lineWidth(1)
		.stroke()
	doc.font('Helvetica').fontSize(9).fillColor('#666')
	doc.text(`Page ${pageNum}`, margins.left, height - margins.bottom + 16, {
		width: width - margins.left - margins.right,
		align: 'right',
	})
	doc.restore()
}

async function writePdf(tokens, meta, outPath) {
	const doc = new PDFDocument({
		margin: 64,
		info: { Title: meta.title, Author: meta.author },
	})
	const stream = fs.createWriteStream(outPath)
	doc.pipe(stream)

	let pageNum = 1
	drawHeaderFooter(doc, meta.title, pageNum)

	doc.font('Helvetica-Bold')
		.fontSize(26)
		.fillColor('#111')
		.text(meta.title, { align: 'center' })
	doc.moveDown(0.5)
	doc.font('Helvetica')
		.fontSize(14)
		.fillColor('#333')
		.text(meta.author || '', { align: 'center' })
	doc.moveDown()
	const dateStr = meta.date || new Date().toLocaleDateString()
	doc.font('Helvetica')
		.fontSize(10)
		.fillColor('#666')
		.text(dateStr, { align: 'center' })
	doc.moveDown(2)
	doc.font('Helvetica')
		.fontSize(12)
		.fillColor('#222')
		.text('Generated from LaTeX source', { align: 'center' })
	doc.addPage()
	pageNum += 1
	drawHeaderFooter(doc, meta.title, pageNum)

	const toc = []
	const bodyWidth =
		doc.page.width - doc.page.margins.left - doc.page.margins.right

	function renderParagraph(text) {
		const paras = text
			.split(/\n{2,}/)
			.map(p => p.trim())
			.filter(Boolean)
		for (const p of paras) {
			const lines = p.split('\n')
			for (const line of lines) {
				doc.font('Helvetica')
					.fontSize(11)
					.fillColor('#111')
					.text(line, { width: bodyWidth, align: 'left' })
			}
			doc.moveDown(0.7)
		}
	}

	function renderHeading(level, text) {
		const size = level === 1 ? 18 : 14
		const color = level === 1 ? '#0b3d91' : '#1a73e8'
		doc.moveDown(level === 1 ? 0.8 : 0.6)
		doc.font('Helvetica-Bold')
			.fontSize(size)
			.fillColor(color)
			.text(text, { width: bodyWidth })
		doc.moveDown(0.3)
		toc.push({ level, text, page: pageNum })
	}

	function renderList(items, ordered) {
		const left = doc.x
		const indent = 16
		let idx = 1
		for (const it of items) {
			doc.font('Helvetica').fontSize(11).fillColor('#111')
			const bullet = ordered ? `${idx}.` : '•'
			doc.text(bullet, left, doc.y, { continued: true })
			doc.text(' ')
			doc.text(it, { width: bodyWidth - indent, align: 'left' })
			doc.moveDown(0.2)
			idx += 1
		}
		doc.moveDown(0.5)
	}

	function renderCode(code) {
		const padding = 8
		const textWidth = bodyWidth - 2 * padding
		const x = doc.page.margins.left
		const y = doc.y
		const lines = code.split('\n')
		const lineHeight = 14
		const boxHeight = padding * 2 + lines.length * lineHeight * 0.9
		doc.rect(x, y, bodyWidth, boxHeight).fillAndStroke('#f8f8f8', '#e5e5e5')
		doc.fillColor('#111').font('Courier').fontSize(10)
		let ty = y + padding
		for (const ln of lines) {
			doc.text(ln, x + padding, ty, { width: textWidth })
			ty += lineHeight * 0.9
		}
		doc.y = y + boxHeight + 4
		doc.moveDown(0.4)
	}

	for (const t of tokens) {
		if (t.type === 'heading') renderHeading(t.level, t.text)
		else if (t.type === 'paragraph') renderParagraph(t.text)
		else if (t.type === 'list') renderList(t.items, t.ordered)
		else if (t.type === 'code') renderCode(t.text)
	}

	doc.addPage()
	pageNum += 1
	drawHeaderFooter(doc, meta.title, pageNum)
	doc.font('Helvetica-Bold')
		.fontSize(16)
		.fillColor('#111')
		.text('Appendix — Table of Contents', { width: bodyWidth })
	doc.moveDown(0.6)
	for (const e of toc) {
		const indent = e.level === 1 ? '' : '  '
		doc.font('Helvetica').fontSize(11).fillColor('#333')
		doc.text(`${indent}${e.text}`, { continued: true })
		doc.text(' ', { continued: true })
		doc.text(`${e.page}`, { align: 'right' })
	}

	doc.end()
	return new Promise((resolve, reject) => {
		stream.on('finish', resolve)
		stream.on('error', reject)
	})
}

async function main() {
	const projectRoot = path.resolve(__dirname, '..')
	const texPath = path.join(projectRoot, 'spec', 'latex', 'main.tex')
	const outPath = path.join(projectRoot, 'spec', 'latex', 'main.pdf')
	if (!fs.existsSync(texPath)) {
		console.error(`LaTeX file not found: ${texPath}`)
		process.exit(1)
	}
	const { meta, body } = readLatex(texPath)
	const tokens = tokenizeLatex(body)
	await writePdf(tokens, meta, outPath)
	console.log(`PDF written: ${outPath}`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
