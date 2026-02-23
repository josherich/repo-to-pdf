const fs = require('fs')
const path = require('path')
const os = require('os')

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

const PDF_SIZE = getSizeInByte(3)
const protocol = os.name === 'windows' ? 'file:///' : 'file://'
const baseUrl = path.resolve(__dirname, '../html5bp')

jest.setTimeout(2 * 60 * 1000)

describe('render', () => {
  it('with default', async () => {
    const srcPath = './test/data/redis-7.0.0/src'
    if (fs.existsSync(srcPath)) {
      const output = 'redis.pdf'
      await generateEbook(srcPath, output, 'Redis', {
        renderer: 'node',
        calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
        pdf_size: PDF_SIZE,
        white_list: null,
        format: 'pdf',
        device: 'desktop',
        baseUrl,
        protocol
      })
      // 6 pdfs with a size limit of 3mb, redis-7.0.0
      expect(fs.existsSync('redis-1.pdf')).toBe(true)
      expect(fs.existsSync('redis-6.pdf')).toBe(true)
    } else {
      console.log('skip because source folder is not specified.')
    }
  })
})
