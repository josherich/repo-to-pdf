const fs = require('fs')
const path = require('path')
const os = require('os')

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')

const PDF_SIZE = getSizeInByte(3) // 10 Mb
const protocol = os.name === 'windows' ? 'file:///' : 'file://'
const baseUrl = path.resolve(__dirname, '../html5bp')

jest.setTimeout(2 * 60 * 1000);

describe('render', () => {
  it('with default', async () => {
    const output = 'redis.pdf'
    await generateEbook('./test/data/redis-7.0.0/src', output, 'Redis', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'desktop',
      baseUrl,
      protocol
    })
    expect(fs.existsSync('redis-1.pdf')).toBe(true)
  })
})