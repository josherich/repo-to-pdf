jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}))

function getPage() {
  return {
    setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    pdf: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }
}

describe('puppeteer renderer init', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('launches browser only once for concurrent PDF jobs', async () => {
    const puppeteer = require('puppeteer')
    const browser = {
      newPage: jest.fn(async () => getPage()),
      close: jest.fn().mockResolvedValue(undefined),
    }

    puppeteer.launch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(browser), 20))
    )

    const html2PDF = require('../src/puppeteer')

    await Promise.all([
      html2PDF.pdf('/tmp/a.html', '/tmp/a.pdf'),
      html2PDF.pdf('/tmp/b.html', '/tmp/b.pdf'),
      html2PDF.pdf('/tmp/c.html', '/tmp/c.pdf'),
    ])

    expect(puppeteer.launch).toHaveBeenCalledTimes(1)
    expect(browser.newPage).toHaveBeenCalledTimes(3)

    await html2PDF.close()
    expect(browser.close).toHaveBeenCalledTimes(1)
  })
})
