// A small, dependency-free Markdown parser. It only implements the subset of
// CommonMark/GFM that repo-to-pdf emits (headings, paragraphs, fenced code,
// lists, blockquotes, tables, rules) plus the common inline constructs. The
// goal is readable output, not perfect spec compliance.

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
  '&copy;': '\u00a9',
  '&reg;': '\u00ae',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&hellip;': '\u2026',
}

function decodeEntities(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|nbsp|copy|reg|mdash|ndash|hellip|#x27|#39|#x2F);/g, (match) => ENTITIES[match] || match)
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => safeCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_m, code) => safeCodePoint(Number(code)))
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code)
  } catch (err) {
    return ''
  }
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const FENCE_RE = /^(\s*)(`{3,}|~{3,})\s*([^`]*)$/
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const BLOCKQUOTE_RE = /^\s*>\s?(.*)$/
const TABLE_SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/

function isBlank(line) {
  return /^\s*$/.test(line)
}

// Split a GFM table row into trimmed cell strings.
function splitTableRow(line) {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1)
  }
  if (trimmed.endsWith('|')) {
    trimmed = trimmed.slice(0, -1)
  }

  const cells = []
  let current = ''
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|'
      i++
    } else if (ch === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      i++
      continue
    }

    const fence = line.match(FENCE_RE)
    if (fence) {
      const marker = fence[2][0]
      const lang = fence[3].trim().split(/\s+/)[0].toLowerCase()
      const code = []
      i++
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) {
        code.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, inlines: parseInline(heading[2]), text: stripInline(heading[2]) })
      i++
      continue
    }

    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines = []
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].match(BLOCKQUOTE_RE)[1])
        i++
      }
      blocks.push({ type: 'blockquote', blocks: parseBlocks(quoteLines.join('\n')) })
      continue
    }

    // GFM table: header row followed by a delimiter row.
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const header = splitTableRow(line).map((cell) => parseInline(cell))
      i += 2
      const rows = []
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]).map((cell) => parseInline(cell)))
        i++
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    if (LIST_RE.test(line)) {
      const { list, next } = parseList(lines, i)
      blocks.push(list)
      i = next
      continue
    }

    // Paragraph: gather consecutive lines until a blank line or new block start.
    const para = []
    while (i < lines.length && !isBlank(lines[i])) {
      const current = lines[i]
      if (HEADING_RE.test(current) || FENCE_RE.test(current) || HR_RE.test(current) || BLOCKQUOTE_RE.test(current) || LIST_RE.test(current)) {
        break
      }
      para.push(current.trim())
      i++
    }
    if (para.length > 0) {
      blocks.push({ type: 'paragraph', inlines: parseInline(para.join('\n')) })
    }
  }

  return blocks
}

// Parse a (possibly nested) list starting at index `start`.
function parseList(lines, start) {
  const first = lines[start].match(LIST_RE)
  const baseIndent = first[1].length
  const ordered = /\d/.test(first[2])
  const items = []
  let i = start

  while (i < lines.length) {
    const match = lines[i].match(LIST_RE)
    if (!match || match[1].length < baseIndent) {
      break
    }

    if (match[1].length > baseIndent) {
      // Nested list belongs to the previous item.
      const { list, next } = parseList(lines, i)
      if (items.length > 0) {
        items[items.length - 1].blocks.push(list)
      }
      i = next
      continue
    }

    const itemLines = [match[3]]
    i++
    // Continuation lines (indented or plain) until a blank line or next item.
    while (i < lines.length && !isBlank(lines[i]) && !LIST_RE.test(lines[i])) {
      itemLines.push(lines[i].trim())
      i++
    }
    items.push({ inlines: parseInline(itemLines.join(' ')), blocks: [], ordered })

    while (i < lines.length && isBlank(lines[i])) {
      // Allow one blank line between items without ending the list.
      if (i + 1 < lines.length && LIST_RE.test(lines[i + 1]) && lines[i + 1].match(LIST_RE)[1].length >= baseIndent) {
        i++
      } else {
        break
      }
    }
  }

  return { list: { type: 'list', ordered, items }, next: i }
}

// --- Inline parsing -------------------------------------------------------

// Convert inline markdown text into an array of styled runs:
// { text, bold, italic, code, link }
function parseInline(text) {
  const runs = []
  scanInline(text, { bold: false, italic: false, code: false, link: null }, runs)
  return mergeRuns(runs)
}

function pushRun(runs, text, style) {
  if (text.length === 0) {
    return
  }
  runs.push({ text, bold: style.bold, italic: style.italic, code: style.code, link: style.link })
}

function scanInline(text, style, runs) {
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) {
      pushRun(runs, decodeEntities(buffer), style)
      buffer = ''
    }
  }

  while (i < text.length) {
    const ch = text[i]
    const rest = text.slice(i)

    // Escaped character.
    if (ch === '\\' && i + 1 < text.length) {
      buffer += text[i + 1]
      i += 2
      continue
    }

    // Inline code span.
    if (ch === '`') {
      const fenceMatch = rest.match(/^(`+)/)
      const ticks = fenceMatch[1]
      const closeIndex = text.indexOf(ticks, i + ticks.length)
      if (closeIndex !== -1) {
        flush()
        const codeText = text.slice(i + ticks.length, closeIndex).replace(/^ | $/g, '')
        pushRun(runs, codeText, { ...style, code: true })
        i = closeIndex + ticks.length
        continue
      }
    }

    // Image: render the alt text only (images are not embedded).
    if (ch === '!' && text[i + 1] === '[') {
      const image = matchLink(rest.slice(1))
      if (image) {
        flush()
        if (image.text) {
          scanInline(image.text, style, runs)
        }
        i += 1 + image.length
        continue
      }
    }

    // Link.
    if (ch === '[') {
      const link = matchLink(rest)
      if (link) {
        flush()
        scanInline(link.text, { ...style, link: link.url }, runs)
        i += link.length
        continue
      }
    }

    // Strong emphasis.
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2)
      const end = text.indexOf(marker, i + 2)
      if (end !== -1 && end > i + 2) {
        flush()
        scanInline(text.slice(i + 2, end), { ...style, bold: true }, runs)
        i = end + 2
        continue
      }
    }

    // Emphasis.
    if ((ch === '*' || ch === '_') && text[i + 1] !== ch) {
      const end = text.indexOf(ch, i + 1)
      if (end !== -1 && end > i + 1) {
        flush()
        scanInline(text.slice(i + 1, end), { ...style, italic: true }, runs)
        i = end + 1
        continue
      }
    }

    // Strip inline HTML tags.
    if (ch === '<') {
      const close = text.indexOf('>', i)
      if (close !== -1 && /^<\/?[a-zA-Z!][^>]*>$/.test(text.slice(i, close + 1))) {
        i = close + 1
        continue
      }
    }

    buffer += ch
    i++
  }

  flush()
}

// Match a [text](url) construct at the start of `str`. Returns the link text,
// url and total consumed length, or null.
function matchLink(str) {
  if (str[0] !== '[') {
    return null
  }
  let depth = 0
  let i = 0
  for (; i < str.length; i++) {
    if (str[i] === '\\') {
      i++
      continue
    }
    if (str[i] === '[') {
      depth++
    } else if (str[i] === ']') {
      depth--
      if (depth === 0) {
        break
      }
    }
  }
  if (depth !== 0 || str[i + 1] !== '(') {
    return null
  }
  const text = str.slice(1, i)
  const close = str.indexOf(')', i + 2)
  if (close === -1) {
    return null
  }
  const url = str.slice(i + 2, close).split(/\s+/)[0]
  return { text, url, length: close + 1 }
}

// Combine adjacent runs that share identical styling.
function mergeRuns(runs) {
  const merged = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && last.bold === run.bold && last.italic === run.italic && last.code === run.code && last.link === run.link) {
      last.text += run.text
    } else {
      merged.push({ ...run })
    }
  }
  return merged
}

// Plain-text version of inline markdown, used for outline/bookmark titles.
function stripInline(text) {
  return parseInline(text)
    .map((run) => run.text)
    .join('')
    .trim()
}

module.exports = { parseBlocks, parseInline, stripInline }
