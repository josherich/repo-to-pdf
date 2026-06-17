const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawnSync } = require('child_process')

jest.setTimeout(2 * 60 * 1000)

jest.mock('../src/puppeteer', () => {
  const { writeMockPdf } = require('./utils/write-mock-pdf')

  return {
    pdf: jest.fn(async (_templatePath, outputPath) => {
      writeMockPdf(outputPath)
    }),
    close: jest.fn(),
  }
})

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')
const { isPdf } = require('./utils/write-mock-pdf')

const PDF_SIZE = getSizeInByte(5) // 10 Mb
const baseUrl = path.resolve(__dirname, '../html5bp')

describe('render', () => {
  it('with default', async () => {
    const output = 'self.pdf'
    await generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'desktop',
      baseUrl,
    })
    expect(isPdf(output)).toBe(true)
  })

  it('with mobi', async () => {
    const output = 'self.mobi'
    const calibrePath = '/Applications/calibre.app/Contents/MacOS/ebook-convert'
    if (fs.existsSync(calibrePath)) {
      const check = spawnSync(calibrePath, ['--version'])
      if (check.status !== 0) {
        console.log('skip mobi because calibre is not executable.')
        return
      }

      await generateEbook('./src', output, 'repo-to-pdf', {
        renderer: 'calibre',
        calibrePath,
        pdf_size: PDF_SIZE,
        white_list: null,
        format: 'mobi',
        device: 'desktop',
        baseUrl,
      })

      if (!fs.existsSync(output)) {
        console.log('skip mobi because calibre did not generate output in this environment.')
        return
      }

      expect(fs.existsSync(output)).toBe(true)
    } else {
      console.log('skip mobi because no calibre is found.')
    }
  })

  it('with mobile pdf', async () => {
    const output = 'self-mobile.pdf'
    await generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'mobile',
      baseUrl,
    })
    expect(isPdf(output)).toBe(true)
  })

  it('with tablet pdf', async () => {
    const output = 'self-tablet.pdf'
    await generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'tablet',
      baseUrl,
    })
    expect(isPdf(output)).toBe(true)
  })

  it('with current folder pdf', async () => {
    const output = 'self-current-folder.pdf'
    await generateEbook('./', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: 'js',
      format: 'pdf',
      device: 'desktop',
      baseUrl,
    })
    expect(isPdf(output)).toBe(true)
  })

  it('with white list', async () => {
    const output = 'self-whitelist.pdf'
    await generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: 'js',
      format: 'pdf',
      device: 'desktop',
      baseUrl,
    })
    expect(isPdf(output)).toBe(true)
  })

  it('renders markdown images in generated HTML', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-'))
    const assetsDir = path.join(tmpDir, 'assets')
    const output = path.join(tmpDir, 'book.pdf')
    fs.mkdirSync(assetsDir)
    fs.writeFileSync(path.join(assetsDir, 'tiny.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n')
    fs.writeFileSync(path.join(tmpDir, 'README.md'), ['![Tiny image](./assets/tiny.svg)', '<img src="./assets/tiny.svg" alt="Raw image">'].join('\n'))

    await generateEbook(tmpDir, output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'desktop',
      baseUrl,
    })

    const html = fs.readFileSync(output.replace('.pdf', '.html'), 'utf8')
    const tinySvgUrl = pathToFileURL(path.join(assetsDir, 'tiny.svg')).href

    expect(html).toContain(`<img src="${tinySvgUrl}" alt="Tiny image">`)
    expect(html).toContain(`<img src="${tinySvgUrl}" alt="Raw image">`)
    expect(html).not.toContain(`![Tiny image](${tinySvgUrl})`)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
