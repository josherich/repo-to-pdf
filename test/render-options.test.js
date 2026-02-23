jest.mock('../src/puppeteer', () => ({
  pdf: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
}))

const html2PDF = require('../src/puppeteer')
const { sequenceRenderPDF } = require('../src/render')

describe('sequenceRenderPDF options', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes outline option to puppeteer renderer', async () => {
    await sequenceRenderPDF(['test.html'], { outline: false })

    expect(html2PDF.pdf).toHaveBeenCalledWith('test.html', 'test.pdf', { outline: false })
    expect(html2PDF.close).toHaveBeenCalledTimes(1)
  })

  it('always closes browser when rendering fails', async () => {
    html2PDF.pdf.mockRejectedValueOnce(new Error('render failed'))

    await expect(sequenceRenderPDF(['test.html'], { outline: true })).rejects.toThrow('render failed')
    expect(html2PDF.close).toHaveBeenCalledTimes(1)
  })
})
