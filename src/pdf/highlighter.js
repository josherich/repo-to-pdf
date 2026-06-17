const hljs = require('highlight.js')

// Token colours mirror the Visual Studio theme shipped in html5bp/css/vs.css so
// the native renderer matches the existing HTML output.
const CLASS_COLORS = {
  comment: '#008000',
  quote: '#008000',
  variable: '#008000',
  keyword: '#0000ff',
  'selector-tag': '#0000ff',
  built_in: '#0000ff',
  name: '#0000ff',
  tag: '#0000ff',
  string: '#a31515',
  title: '#a31515',
  section: '#a31515',
  attribute: '#a31515',
  literal: '#a31515',
  'template-tag': '#a31515',
  'template-variable': '#a31515',
  type: '#a31515',
  addition: '#a31515',
  deletion: '#2b91af',
  'selector-attr': '#2b91af',
  'selector-pseudo': '#2b91af',
  meta: '#2b91af',
  doctag: '#808080',
  attr: '#ff0000',
  symbol: '#00b0e8',
  bullet: '#00b0e8',
  link: '#00b0e8',
}

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
}

function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39|#x2F);/g, (match) => ENTITIES[match] || match).replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
}

// Resolve the visual style for the current span stack. Inner spans win for the
// colour; bold/italic accumulate from any level.
function resolveStyle(stack) {
  let color = null
  let bold = false
  let italic = false

  for (const classes of stack) {
    for (const cls of classes) {
      if (cls === 'strong') {
        bold = true
      } else if (cls === 'emphasis') {
        italic = true
      }
    }
  }

  for (let i = stack.length - 1; i >= 0 && color === null; i--) {
    for (const cls of stack[i]) {
      if (CLASS_COLORS[cls]) {
        color = CLASS_COLORS[cls]
        break
      }
    }
  }

  return { color, bold, italic }
}

const TOKEN_PATTERN = /<span class="([^"]*)">|<\/span>|([^<]+)/g

// Flatten highlight.js HTML into a list of { text, color, bold, italic }
// segments. Segments may contain newlines; callers split them per line.
function htmlToSegments(html) {
  const segments = []
  const stack = []
  let match

  TOKEN_PATTERN.lastIndex = 0
  while ((match = TOKEN_PATTERN.exec(html)) !== null) {
    if (match[1] !== undefined) {
      const classes = match[1]
        .split(/\s+/)
        .filter(Boolean)
        .map((cls) => cls.replace(/^hljs-/, ''))
      stack.push(classes)
    } else if (match[2] !== undefined) {
      const text = decodeEntities(match[2])
      if (text) {
        segments.push({ text, ...resolveStyle(stack) })
      }
    } else {
      stack.pop()
    }
  }

  return segments
}

// Highlight a block of code and return an array of lines, where each line is an
// array of styled runs. When no language is known, the code is returned as a
// single uncoloured run per line.
function highlightCode(code, lang) {
  let html = null
  if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) {
    try {
      html = hljs.highlight(code, { language: lang }).value
    } catch (err) {
      html = null
    }
  }

  if (html === null) {
    return code.split('\n').map((line) => (line ? [{ text: line, color: null, bold: false, italic: false }] : []))
  }

  const segments = htmlToSegments(html)
  const lines = [[]]
  for (const segment of segments) {
    const parts = segment.text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([])
      }
      if (parts[i].length > 0) {
        lines[lines.length - 1].push({ text: parts[i], color: segment.color, bold: segment.bold, italic: segment.italic })
      }
    }
  }

  return lines
}

module.exports = { highlightCode, htmlToSegments }
