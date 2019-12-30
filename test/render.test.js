const fs = require('fs')

const { generateEbook } = require('../src/html')
const { getSizeInByte } = require('../src/utils')

const PDF_SIZE = getSizeInByte(10) // 10 Mb

describe('render', () => {
  it('with default', async () => {
    const output = 'self.pdf'
    generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'desktop'
    })
    expect(fs.existsSync(output)).toBe(true);
  })

  it('with mobi', async () => {
    const output = 'self.mobi'
    generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'calibre',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'mobi',
      device: 'desktop'
    })
    expect(fs.existsSync(output)).toBe(true);
  })

  it('with mobile pdf', async () => {
    const output = 'self-mobile.pdf'
    generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'mobile'
    })
    expect(fs.existsSync(output)).toBe(true);
  })

  it('with tablet pdf', async () => {
    const output = 'self-tablet.pdf'
    generateEbook('./src', output, 'repo-to-pdf', {
      renderer: 'node',
      calibrePath: '/Applications/calibre.app/Contents/MacOS/ebook-convert',
      pdf_size: PDF_SIZE,
      white_list: null,
      format: 'pdf',
      device: 'tablet'
    })
    expect(fs.existsSync(output)).toBe(true);
  })

});