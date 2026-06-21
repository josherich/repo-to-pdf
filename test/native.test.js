const fs = require('fs')
const os = require('os')
const path = require('path')

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')
const { isPdf } = require('./utils/write-mock-pdf')
const { getPdfOutlineCount } = require('./utils/pdf-outline')
const { parseBlocks, parseInline } = require('../src/pdf/markdown')
const { highlightCode } = require('../src/pdf/highlighter')
const { renderMarkdownToPdf } = require('../src/pdf/layout')

jest.setTimeout(60 * 1000)

const baseUrl = path.resolve(__dirname, '../html5bp')
const PDF_SIZE = getSizeInByte(5)

function nativeOptions(overrides = {}) {
  return {
    renderer: 'native',
    pdf_size: PDF_SIZE,
    white_list: null,
    format: 'pdf',
    device: 'desktop',
    baseUrl,
    ...overrides,
  }
}

describe('native PDF renderer', () => {
  const created = []

  afterAll(() => {
    created.forEach((file) => fs.existsSync(file) && fs.rmSync(file, { force: true }))
  })

  it('generates a valid PDF without external dependencies', async () => {
    const output = 'native-self.pdf'
    created.push(output)
    await generateEbook('./src', output, 'repo-to-pdf', nativeOptions())
    expect(isPdf(output)).toBe(true)
    expect(fs.statSync(output).size).toBeGreaterThan(0)
  })

  it('embeds a PDF outline when enabled', async () => {
    const output = 'native-outline.pdf'
    created.push(output)
    await generateEbook('./src', output, 'repo-to-pdf', nativeOptions({ outline: true }))
    expect(getPdfOutlineCount(output)).toBeGreaterThan(0)
  })

  it('omits the PDF outline when disabled', async () => {
    const output = 'native-no-outline.pdf'
    created.push(output)
    await generateEbook('./src', output, 'repo-to-pdf', nativeOptions({ outline: false }))
    expect(getPdfOutlineCount(output)).toBe(0)
  })

  it('renders diverse example sources (markdown, tables, unicode, long lines)', async () => {
    const output = 'native-examples.pdf'
    created.push(output)
    await generateEbook(path.join(__dirname, 'examples'), output, 'examples', nativeOptions())
    expect(isPdf(output)).toBe(true)
  })

  it('splits into multiple PDFs when the size limit is exceeded', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-native-'))
    const longSource = Array.from({ length: 400 }, (_, i) => `const value${i} = ${i} // line ${i}`).join('\n')
    fs.writeFileSync(path.join(tmpDir, 'a.js'), longSource)
    fs.writeFileSync(path.join(tmpDir, 'b.js'), longSource)

    const output = path.join(tmpDir, 'book.pdf')
    await generateEbook(tmpDir, output, 'book', nativeOptions({ pdf_size: 4000 }))

    expect(isPdf(path.join(tmpDir, 'book-1.pdf'))).toBe(true)
    expect(isPdf(path.join(tmpDir, 'book-2.pdf'))).toBe(true)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('markdown parser', () => {
  it('parses headings, code fences and inline styles', () => {
    const blocks = parseBlocks('# Title\n\nSome **bold** and `code`.\n\n```js\nconst x = 1\n```')
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, text: 'Title' })
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2]).toMatchObject({ type: 'code', lang: 'js' })
  })

  it('parses links and emphasis into styled runs', () => {
    const runs = parseInline('see [the docs](https://example.com) and *italics*')
    const link = runs.find((r) => r.link)
    const italic = runs.find((r) => r.italic)
    expect(link).toBeTruthy()
    expect(link.link).toBe('https://example.com')
    expect(italic).toBeTruthy()
  })

  it('parses GFM tables', () => {
    const blocks = parseBlocks('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(blocks[0].type).toBe('table')
    expect(blocks[0].header).toHaveLength(2)
    expect(blocks[0].rows).toHaveLength(1)
  })
})

describe('syntax highlighter', () => {
  it('produces coloured runs for known languages', () => {
    const lines = highlightCode('const x = 1 // comment', 'javascript')
    const flat = lines.flat()
    expect(flat.some((run) => run.color)).toBe(true)
    expect(flat.map((run) => run.text).join('')).toContain('const')
  })

  it('falls back to plain runs for unknown languages', () => {
    const lines = highlightCode('hello world', 'not-a-language')
    expect(lines.flat().every((run) => run.color === null)).toBe(true)
  })
})

describe('layout', () => {
  it('renders markdown to a PDF buffer with a %PDF header', () => {
    const buffer = renderMarkdownToPdf('# Heading\n\nParagraph text.', { outline: true })
    expect(buffer.slice(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('embeds CJK and Unicode text with Identity-H fonts', () => {
    const zlib = require('zlib')
    const { BUNDLED_CJK_FONT } = require('../src/pdf/font-manager')
    const buffer = renderMarkdownToPdf('CJK: 你好，世界。Special: café — €\n', {
      fonts: { cjk: BUNDLED_CJK_FONT },
    })
    const pdf = buffer.toString('latin1')
    expect(pdf).toContain('/Subtype /Type0')
    expect(pdf).toContain('/UF7')

    const cidMapRef = pdf.match(/\/CIDToGIDMap (\d+) 0 R/)
    expect(cidMapRef).toBeTruthy()
    const cidMapObjectStart = buffer.indexOf(`${cidMapRef[1]} 0 obj\n`)
    const cidMapStreamStart = buffer.indexOf('stream\n', cidMapObjectStart) + 7
    const cidMapStreamEnd = buffer.indexOf('\nendstream', cidMapStreamStart)
    const cidMap = buffer.slice(cidMapStreamStart, cidMapStreamEnd)
    expect(cidMap.readUInt16BE(0x4f60 * 2)).toBeGreaterThan(0)

    const streamStart = buffer.indexOf('stream\n') + 7
    const streamEnd = buffer.indexOf('\nendstream', streamStart)
    const content = zlib.inflateSync(buffer.slice(streamStart, streamEnd)).toString('latin1')
    expect(content).toContain('<4F60>')
    expect(content).toContain('<597D>')
    expect(content).not.toMatch(/Tm \(\?+\) Tj/)
  })
})
