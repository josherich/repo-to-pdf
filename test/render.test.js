const fs = require('fs')
const path = require('path')
const os = require('os')

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')

const PDF_SIZE = getSizeInByte(10) // 10 Mb
const protocol = os.name === 'windows' ? 'file:///' : 'file://'
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
      protocol
    })
    expect(fs.existsSync(output)).toBe(true)
  })

  // it('with mobi', async () => {
  //   const output = 'self.mobi'
  //   generateEbook('./src', output, 'repo-to-pdf', {
  //     renderer: 'calibre',
  //     calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
  //     pdf_size: PDF_SIZE,
  //     white_list: null,
  //     format: 'mobi',
  //     device: 'desktop',
  //     baseUrl,
  //     protocol
  //   })
  //   expect(fs.existsSync(output)).toBe(true)
  // })

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
      protocol
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
      protocol
    })
    expect(fs.existsSync(output)).toBe(true)
  })
})
