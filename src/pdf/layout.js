const PDFDocument = require('./document')
const { FONT_KEYS, measureText: measureWinAnsi, encodePdfString } = require('./fonts')
const { getFontManager, resetFontManager, isCjkCodePoint, encodePdfHex } = require('./font-manager')
const { highlightCode } = require('./highlighter')
const { parseBlocks } = require('./markdown')

// Layout constants (in PDF points). Sizes are chosen to mirror the GitHub
// markdown styling used by the HTML renderer while keeping pages dense and
// readable.
const PAGE = { width: 612, height: 792 }
const MARGIN = { top: 54, bottom: 54, left: 54, right: 54 }
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right

const BODY_SIZE = 11
const BODY_LINE = 16
const CODE_SIZE = 8.5
const CODE_LINE = 11.5
const CODE_PAD = 8
const TABLE_SIZE = 9.5
const TABLE_LINE = 13

const HEADING = {
  1: { size: 21, gapBefore: 16, gapAfter: 8, rule: true },
  2: { size: 17, gapBefore: 14, gapAfter: 7, rule: true },
  3: { size: 14.5, gapBefore: 12, gapAfter: 6, rule: false },
  4: { size: 12.5, gapBefore: 12, gapAfter: 5, rule: false },
  5: { size: 11.5, gapBefore: 10, gapAfter: 4, rule: false },
  6: { size: 11, gapBefore: 10, gapAfter: 4, rule: false },
}

const COLORS = {
  text: '#24292e',
  heading: '#1f2328',
  link: '#0366d6',
  codeText: '#24292e',
  codeBg: '#f6f8fa',
  inlineCodeBg: '#eff1f3',
  quoteText: '#6a737d',
  quoteBar: '#dfe2e5',
  rule: '#d8dee4',
  border: '#d0d7de',
  altRow: '#f6f8fa',
  bullet: '#24292e',
}

const FOOTER = {
  height: 28,
  ruleOffset: 6,
  fontSize: 9,
  textOffset: 8,
  gap: 8,
  separatorWidth: 0.5,
  separatorHeight: 10,
}

const ASCENT = 0.78

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  return `${round(r)} ${round(g)} ${round(b)}`
}

function round(n) {
  return Math.round(n * 1000) / 1000
}

function runFont(run) {
  if (run.code) {
    return run.bold ? 'monoBold' : 'mono'
  }
  if (run.bold && run.italic) {
    return 'bodyBoldItalic'
  }
  if (run.bold) {
    return 'bodyBold'
  }
  if (run.italic) {
    return 'bodyItalic'
  }
  return 'body'
}

function runColor(run, defaultColor) {
  if (run.link) {
    return COLORS.link
  }
  return defaultColor
}

function measureText(str, fontKey, fontSize, fontManager) {
  if (fontManager && fontManager.enabled) {
    return fontManager.measureText(str, fontKey, fontSize)
  }
  return measureWinAnsi(str, fontKey, fontSize)
}

function splitWrappablePieces(text) {
  if (/^\s+$/.test(text)) {
    return [text]
  }
  const parts = []
  let latin = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (/\s/.test(ch)) {
      if (latin) {
        parts.push(latin)
        latin = ''
      }
      parts.push(ch)
    } else if (isCjkCodePoint(cp)) {
      if (latin) {
        parts.push(latin)
        latin = ''
      }
      parts.push(ch)
    } else {
      latin += ch
    }
  }
  if (latin) {
    parts.push(latin)
  }
  return parts.length > 0 ? parts : [text]
}

class Layout {
  constructor(options = {}) {
    this.doc = new PDFDocument(PAGE)
    this.fontManager = getFontManager(options)
    this.ops = []
    this.y = MARGIN.top
    this.pageIndex = 0
    this.outline = []
    this.headingStack = [] // for nested outline building
    this.leftBar = null
    this.footerPageNumber = !!options.footerPageNumber
    this.footerChapterTitle = !!options.footerChapterTitle
    this.currentChapterTitle = ''
  }

  _hasFooter() {
    return this.footerPageNumber || this.footerChapterTitle
  }

  _contentBottom() {
    return this._hasFooter() ? PAGE.height - MARGIN.bottom - FOOTER.height : PAGE.height - MARGIN.bottom
  }

  // --- low level drawing --------------------------------------------------

  _fillRect(x, top, w, h, color) {
    const pdfY = round(PAGE.height - top - h)
    this.ops.push(`${hexToRgb(color)} rg\n${round(x)} ${pdfY} ${round(w)} ${round(h)} re\nf`)
  }

  _strokeRect(x, top, w, h, color, lineWidth = 0.5) {
    const pdfY = round(PAGE.height - top - h)
    this.ops.push(`${lineWidth} w\n${hexToRgb(color)} RG\n${round(x)} ${pdfY} ${round(w)} ${round(h)} re\nS`)
  }

  _line(x1, top1, x2, top2, color, lineWidth = 0.5) {
    this.ops.push(`${lineWidth} w\n${hexToRgb(color)} RG\n${round(x1)} ${round(PAGE.height - top1)} m ${round(x2)} ${round(PAGE.height - top2)} l S`)
  }

  // Draw a piece of text whose baseline sits `baselineTop` points below the top
  // of the page.
  _text(x, baselineTop, text, fontKey, size, color) {
    if (!text) {
      return
    }
    this.fontManager.noteText(text, fontKey)
    const pdfY = round(PAGE.height - baselineTop)
    const unicodeKey = this.fontManager.pdfFontKey(fontKey, text)
    if (unicodeKey) {
      const hex = encodePdfHex(text)
      this.ops.push(`BT /${unicodeKey} ${size} Tf ${hexToRgb(color)} rg 1 0 0 1 ${round(x)} ${pdfY} Tm <${hex}> Tj ET`)
      return
    }
    const encoded = encodePdfString(text).toString('latin1')
    this.ops.push(`BT /${FONT_KEYS[fontKey]} ${size} Tf ${hexToRgb(color)} rg 1 0 0 1 ${round(x)} ${pdfY} Tm (${encoded}) Tj ET`)
  }

  // --- pagination ---------------------------------------------------------

  _drawFooter() {
    if (!this._hasFooter()) {
      return
    }

    const footerBottom = PAGE.height - MARGIN.bottom
    const ruleY = footerBottom - FOOTER.height + FOOTER.ruleOffset
    this._line(MARGIN.left, ruleY, PAGE.width - MARGIN.right, ruleY, COLORS.rule, 0.75)

    const baseline = footerBottom - FOOTER.textOffset
    const showChapter = this.footerChapterTitle && this.currentChapterTitle
    const showPage = this.footerPageNumber
    if (!showChapter && !showPage) {
      return
    }

    let x = PAGE.width - MARGIN.right

    if (showPage) {
      const pageText = String(this.pageIndex + 1)
      const pageWidth = measureText(pageText, 'body', FOOTER.fontSize, this.fontManager)
      x -= pageWidth
      this._text(x, baseline, pageText, 'body', FOOTER.fontSize, COLORS.quoteText)
    }

    if (showChapter && showPage) {
      x -= FOOTER.gap
      const sepTop = baseline - FOOTER.separatorHeight / 2
      const sepBottom = baseline + FOOTER.separatorHeight / 2
      this._line(x, sepTop, x, sepBottom, COLORS.rule, FOOTER.separatorWidth)
      x -= FOOTER.gap
    }

    if (showChapter) {
      const titleWidth = measureText(this.currentChapterTitle, 'body', FOOTER.fontSize, this.fontManager)
      x -= titleWidth
      this._text(x, baseline, this.currentChapterTitle, 'body', FOOTER.fontSize, COLORS.quoteText)
    }
  }

  _newPage() {
    if (this._hasFooter()) {
      this._drawFooter()
    }
    this.doc.addPage(this.ops.join('\n'))
    this.ops = []
    this.y = MARGIN.top
    this.pageIndex += 1
  }

  _ensure(height) {
    if (this.y + height > this._contentBottom()) {
      this._newPage()
      return true
    }
    return false
  }

  _drawLeftBar(top, height) {
    if (this.leftBar) {
      this._fillRect(this.leftBar.x, top, 3, height, this.leftBar.color)
    }
  }

  // --- inline wrapping ----------------------------------------------------

  // Break styled runs into lines that fit within `maxWidth`, keeping per-token
  // styling. Returns an array of lines; each line is an array of
  // { text, fontKey, color, code, width }.
  _wrapInline(runs, maxWidth, size, defaultColor) {
    const tokens = []
    for (const run of runs) {
      const fontKey = runFont(run)
      const color = runColor(run, defaultColor)
      const pieces = splitWrappablePieces(run.text.replace(/\t/g, '  '))
      for (const piece of pieces) {
        if (piece.length === 0) {
          continue
        }
        tokens.push({ text: piece, fontKey, color, code: !!run.code, isSpace: /^\s+$/.test(piece) })
      }
    }

    const lines = []
    let line = []
    let lineWidth = 0

    const pushLine = () => {
      while (line.length > 0 && line[line.length - 1].isSpace) {
        line.pop()
      }
      lines.push(line)
      line = []
      lineWidth = 0
    }

    for (const token of tokens) {
      let width = measureText(token.text, token.fontKey, size, this.fontManager)

      if (token.isSpace) {
        if (line.length === 0) {
          continue
        }
        line.push({ ...token, width })
        lineWidth += width
        continue
      }

      // Hard-break tokens that are wider than a full line.
      if (width > maxWidth && line.length === 0) {
        let remaining = token.text
        while (measureText(remaining, token.fontKey, size, this.fontManager) > maxWidth && remaining.length > 1) {
          let fit = remaining.length
          while (fit > 1 && measureText(remaining.slice(0, fit), token.fontKey, size, this.fontManager) > maxWidth) {
            fit--
          }
          lines.push([
            {
              ...token,
              text: remaining.slice(0, fit),
              width: measureText(remaining.slice(0, fit), token.fontKey, size, this.fontManager),
            },
          ])
          remaining = remaining.slice(fit)
        }
        width = measureText(remaining, token.fontKey, size, this.fontManager)
        line.push({ ...token, text: remaining, width })
        lineWidth += width
        continue
      }

      if (lineWidth + width > maxWidth && line.length > 0) {
        pushLine()
      }
      line.push({ ...token, width })
      lineWidth += width
    }

    pushLine()
    return lines.length > 0 ? lines : [[]]
  }

  _emitInline(runs, x, maxWidth, size, lineHeight, defaultColor) {
    const lines = this._wrapInline(runs, maxWidth, size, defaultColor)
    for (const line of lines) {
      this._ensure(lineHeight)
      this._drawLeftBar(this.y, lineHeight)
      const baseline = this.y + size * ASCENT
      let cursor = x
      for (const token of line) {
        if (token.code && !token.isSpace) {
          this._fillRect(cursor - 1, this.y + 1, token.width + 2, lineHeight - 2, COLORS.inlineCodeBg)
        }
        this._text(cursor, baseline, token.text, token.fontKey, size, token.code ? COLORS.codeText : token.color)
        cursor += token.width
      }
      this.y += lineHeight
    }
  }

  // --- block rendering ----------------------------------------------------

  render(markdown) {
    const blocks = parseBlocks(markdown)
    this._renderBlocks(blocks, MARGIN.left, CONTENT_WIDTH)
  }

  _renderBlocks(blocks, left, width) {
    let inToc = false

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      switch (block.type) {
        case 'heading': {
          // Detect repo-to-pdf navigation/TOC artefacts.
          const isContents = block.level === 2 && /^contents$/i.test(block.text)
          const next = blocks[i + 1]
          const isFileHeader = block.level === 4 && next && next.type === 'paragraph' && isToTopLink(next)

          if (isContents) {
            this._heading(block, left, width, { outline: false })
            inToc = true
            break
          }

          if (inToc && block.level === 4 && !isFileHeader) {
            this._tocEntry(block, left, width)
            break
          }

          inToc = false
          if (isFileHeader) {
            this.currentChapterTitle = block.text
          }
          this._heading(block, left, width, { outline: true })
          break
        }
        case 'paragraph':
          if (isToTopLink(block)) {
            break // skip "[to top]" navigation links
          }
          inToc = false
          this._emitInline(block.inlines, left, width, BODY_SIZE, BODY_LINE, COLORS.text)
          this.y += 4
          break
        case 'code':
          inToc = false
          this._codeBlock(block, left, width)
          break
        case 'hr':
          this._ensure(12)
          this.y += 5
          this._line(left, this.y, left + width, this.y, COLORS.rule, 1)
          this.y += 7
          break
        case 'blockquote':
          this._blockquote(block, left, width)
          break
        case 'list':
          this._list(block, left, width)
          break
        case 'table':
          this._table(block, left, width)
          break
        default:
          break
      }
    }
  }

  _heading(block, left, width, { outline }) {
    const spec = HEADING[block.level] || HEADING[6]
    this.y += this.y > MARGIN.top ? spec.gapBefore : 0
    this._ensure(spec.size + spec.gapAfter + (spec.rule ? 6 : 0))

    if (outline && block.text) {
      this._addOutline(block.level, block.text)
    }

    const runs = block.inlines.map((run) => ({ ...run, bold: true }))
    this._emitInline(runs, left, width, spec.size, spec.size * 1.3, COLORS.heading)

    if (spec.rule) {
      this.y += 3
      this._line(left, this.y, left + width, this.y, COLORS.rule, 0.75)
      this.y += 1
    }
    this.y += spec.gapAfter
  }

  _tocEntry(block, left, width) {
    // Render TOC index entries compactly without polluting the outline.
    const runs = block.inlines.map((run) => ({ ...run, bold: false }))
    this._emitInline(runs, left, width, 9.5, 13, COLORS.link)
  }

  _codeBlock(block, left, width) {
    const lines = highlightCode(block.code, block.lang)
    const innerWidth = width - 2 * CODE_PAD
    const monoCharWidth = measureText('0', 'mono', CODE_SIZE, this.fontManager)
    const maxChars = Math.max(1, Math.floor(innerWidth / monoCharWidth))

    const display = []
    for (const lineRuns of lines) {
      const wrapped = wrapMonoLine(lineRuns, maxChars, innerWidth, this.fontManager)
      for (const w of wrapped) {
        display.push(w)
      }
    }

    this.y += 4
    let segStart = this.ops.length
    let segTop = this.y
    this.y += CODE_PAD

    const finishSegment = () => {
      const bottom = this.y + CODE_PAD
      const rect = this._rectString(left, segTop, width, bottom - segTop, COLORS.codeBg)
      this.ops.splice(segStart, 0, rect)
      this.y = bottom
    }

    for (const lineRuns of display) {
      if (this.y + CODE_LINE > this._contentBottom()) {
        finishSegment()
        this._newPage()
        segStart = this.ops.length
        segTop = this.y
        this.y += CODE_PAD
      }

      const baseline = this.y + CODE_SIZE * ASCENT
      let cursor = left + CODE_PAD
      for (const run of lineRuns) {
        const fontKey = run.bold ? 'monoBold' : 'mono'
        this._text(cursor, baseline, run.text, fontKey, CODE_SIZE, run.color || COLORS.codeText)
        cursor += measureText(run.text, fontKey, CODE_SIZE, this.fontManager)
      }
      this.y += CODE_LINE
    }

    finishSegment()
    this.y += 6
  }

  // Build a fill-rectangle op string without appending it (used for splicing
  // backgrounds beneath already-emitted text).
  _rectString(x, top, w, h, color) {
    const pdfY = round(PAGE.height - top - h)
    return `${hexToRgb(color)} rg\n${round(x)} ${pdfY} ${round(w)} ${round(h)} re\nf`
  }

  _blockquote(block, left, width) {
    const previousBar = this.leftBar
    this.y += 4
    this.leftBar = { x: left, color: COLORS.quoteBar }
    const indent = 14
    const quoteColor = COLORS.quoteText
    this._renderQuoteBlocks(block.blocks, left + indent, width - indent, quoteColor)
    this.leftBar = previousBar
    this.y += 4
  }

  _renderQuoteBlocks(blocks, left, width, color) {
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        this._emitInline(block.inlines, left, width, BODY_SIZE, BODY_LINE, color)
        this.y += 2
      } else if (block.type === 'heading') {
        this._emitInline(
          block.inlines.map((r) => ({ ...r, bold: true })),
          left,
          width,
          (HEADING[block.level] || HEADING[6]).size,
          (HEADING[block.level] || HEADING[6]).size * 1.3,
          color
        )
        this.y += 2
      } else if (block.type === 'code') {
        this._codeBlock(block, left, width)
      } else if (block.type === 'list') {
        this._list(block, left, width, color)
      }
    }
  }

  _list(block, left, width, color = COLORS.text) {
    let index = 1
    for (const item of block.items) {
      const marker = block.ordered ? `${index}.` : '\u2022'
      const markerWidth = 18
      this._ensure(BODY_LINE)
      const baseline = this.y + BODY_SIZE * ASCENT
      this._drawLeftBar(this.y, BODY_LINE)
      this._text(left + 2, baseline, marker, 'body', BODY_SIZE, color)

      const startY = this.y
      this._emitInline(item.inlines, left + markerWidth, width - markerWidth, BODY_SIZE, BODY_LINE, color)
      if (this.y === startY) {
        this.y += BODY_LINE
      }

      if (item.blocks && item.blocks.length) {
        this._renderBlocks(item.blocks, left + markerWidth, width - markerWidth)
      }
      index++
    }
    this.y += 4
  }

  _table(block, left, width) {
    const colCount = Math.max(block.header.length, ...block.rows.map((r) => r.length), 1)
    const padX = 5
    const padY = 3

    // Natural widths from single-line cell measurements, then scaled to fit.
    const natural = new Array(colCount).fill(20)
    const allRows = [block.header, ...block.rows]
    for (const row of allRows) {
      for (let c = 0; c < colCount; c++) {
        const cell = row[c] || []
        const text = cell.map((r) => r.text).join('')
        natural[c] = Math.max(natural[c], measureText(text, 'body', TABLE_SIZE, this.fontManager) + 2 * padX)
      }
    }
    const naturalSum = natural.reduce((a, b) => a + b, 0)
    const scale = width / naturalSum
    const colWidths = natural.map((w) => w * scale)

    const drawRow = (cells, isHeader, rowIndex) => {
      const cellLines = []
      let maxLines = 1
      for (let c = 0; c < colCount; c++) {
        const runs = (cells[c] || []).map((r) => (isHeader ? { ...r, bold: true } : r))
        const lines = this._wrapInline(runs, colWidths[c] - 2 * padX, TABLE_SIZE, COLORS.text)
        cellLines.push(lines)
        maxLines = Math.max(maxLines, lines.length)
      }
      const rowHeight = maxLines * TABLE_LINE + 2 * padY

      if (this.y + rowHeight > this._contentBottom() && this.y > MARGIN.top) {
        this._newPage()
      }

      const rowTop = this.y
      if (!isHeader && rowIndex % 2 === 1) {
        this._fillRect(left, rowTop, width, rowHeight, COLORS.altRow)
      }

      let x = left
      for (let c = 0; c < colCount; c++) {
        const lines = cellLines[c]
        let textTop = rowTop + padY
        for (const line of lines) {
          const baseline = textTop + TABLE_SIZE * ASCENT
          let cursor = x + padX
          for (const token of line) {
            this._text(cursor, baseline, token.text, token.fontKey, TABLE_SIZE, token.color)
            cursor += token.width
          }
          textTop += TABLE_LINE
        }
        this._strokeRect(x, rowTop, colWidths[c], rowHeight, COLORS.border, 0.5)
        x += colWidths[c]
      }
      this.y = rowTop + rowHeight
    }

    this.y += 4
    drawRow(block.header, true, -1)
    block.rows.forEach((row, idx) => drawRow(row, false, idx))
    this.y += 6
  }

  // --- outline ------------------------------------------------------------

  _addOutline(level, title) {
    const node = { title, level, pageIndex: this.pageIndex, y: PAGE.height - this.y + 2, children: [] }

    while (this.headingStack.length > 0 && this.headingStack[this.headingStack.length - 1].level >= level) {
      this.headingStack.pop()
    }

    if (this.headingStack.length === 0) {
      this.outline.push(node)
    } else {
      this.headingStack[this.headingStack.length - 1].children.push(node)
    }
    this.headingStack.push(node)
  }

  finish(options = {}) {
    if (this._hasFooter()) {
      this._drawFooter()
    }
    if (this.ops.length > 0 || this.doc.pages.length === 0) {
      this.doc.addPage(this.ops.join('\n'))
      this.ops = []
    }
    this.fontManager.finalize(this.doc)
    const outline = options.outline === false ? null : this.outline
    return this.doc.build(outline)
  }
}

// Wrap a single source line (array of styled runs) to fit within the line width.
function wrapMonoLine(runs, maxChars, maxWidth, fontManager) {
  if (!runs || runs.length === 0) {
    return [[]]
  }

  const out = []
  let current = []
  let length = 0
  let lineWidth = 0

  const pushLine = () => {
    out.push(current)
    current = []
    length = 0
    lineWidth = 0
  }

  for (const run of runs) {
    const text = run.text.replace(/\t/g, '  ')
    const chars = [...text]
    let index = 0
    while (index < chars.length) {
      const ch = chars[index]
      const fontKey = run.bold ? 'monoBold' : 'mono'
      const charW = measureText(ch, fontKey, CODE_SIZE, fontManager)

      if (maxWidth && lineWidth + charW > maxWidth && current.length > 0) {
        pushLine()
        continue
      }

      if (!maxWidth) {
        const space = maxChars - length
        if (space <= 0) {
          pushLine()
          continue
        }
        const take = chars.slice(index, index + space).join('')
        current.push({ text: take, color: run.color, bold: run.bold, italic: run.italic })
        length += take.length
        index += take.length
        continue
      }

      const last = current[current.length - 1]
      if (last && last.bold === run.bold && last.color === run.color) {
        last.text += ch
      } else {
        current.push({ text: ch, color: run.color, bold: run.bold, italic: run.italic })
      }
      lineWidth += charW
      index++
    }
  }
  pushLine()
  return out.length > 0 ? out : [[]]
}

function isToTopLink(paragraph) {
  if (!paragraph || paragraph.type !== 'paragraph') {
    return false
  }
  const runs = paragraph.inlines
  if (runs.length !== 1) {
    return false
  }
  const run = runs[0]
  return run.link && /^#contents$/i.test(run.link) && /to top/i.test(run.text)
}

// Render a markdown string into a PDF Buffer.
function renderMarkdownToPdf(markdown, options = {}) {
  resetFontManager()
  const layout = new Layout(options)
  layout.render(markdown)
  return layout.finish(options)
}

module.exports = { renderMarkdownToPdf, Layout }
