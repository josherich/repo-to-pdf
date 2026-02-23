const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

jest.setTimeout(2 * 60 * 1000)

jest.mock('../src/puppeteer', () => {
  const fs = require('fs')

  return {
    pdf: jest.fn(async (templatePath, outputPath) => {
      fs.writeFileSync(outputPath, `mock-pdf:${templatePath}`)
    }),
    close: jest.fn(),
  }
})

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')

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
    expect(fs.existsSync(output)).toBe(true)
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
    expect(fs.existsSync(output)).toBe(true)
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
    expect(fs.existsSync(output)).toBe(true)
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
    expect(fs.existsSync(output)).toBe(true)
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
    expect(fs.existsSync(output)).toBe(true)
  })
})
