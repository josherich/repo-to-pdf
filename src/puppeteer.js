const puppeteer = require('puppeteer')

const DEFAULT_RENDER_TIMEOUT_SECONDS = 120
const DEFAULT_PDF_TIMEOUT_SECONDS = 3 * 60

class HTML2PDF {
  constructor() {
    this.puppeteerConfig = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    }

    this._initialized = false
    this._initializing = null
    this.chrome = null
  }

  async _initializePlugins() {
    if (this._initialized) {
      return
    }

    if (this._initializing) {
      await this._initializing
      return
    }

    this._initializing = (async () => {
      this.chrome = await puppeteer.launch(this.puppeteerConfig)
      this._initialized = true
    })()

    try {
      await this._initializing
    } finally {
      this._initializing = null
    }
  }

  async close() {
    if (this._initializing) {
      await this._initializing
    }

    if (this.chrome) {
      await this.chrome.close()
    }
    this.chrome = null
    this._initialized = false
  }

  async pdf(templatePath, outputPath, options = {}) {
    await this._initializePlugins()
    const { outline = true, footerPageNumber = false, footerChapterTitle = false } = options
    const puppeteerPage = await this.chrome.newPage()
    await puppeteerPage.setJavaScriptEnabled(false)

    try {
      await puppeteerPage.goto('file:' + templatePath, {
        waitUntil: 'load',
        timeout: DEFAULT_RENDER_TIMEOUT_SECONDS * 1000,
      })
      const pdfOptions = {
        path: outputPath,
        displayHeaderFooter: footerPageNumber && !footerChapterTitle,
        printBackground: true,
        timeout: DEFAULT_PDF_TIMEOUT_SECONDS * 1000,
        outline,
      }

      if (footerPageNumber || footerChapterTitle) {
        pdfOptions.margin = { top: '54px', bottom: '72px', left: '54px', right: '54px' }
      }

      if (footerPageNumber && !footerChapterTitle) {
        pdfOptions.footerTemplate =
          '<div style="width: 100%; font-size: 9px; color: #6a737d; padding: 4px 54px 0; border-top: 0.75px solid #d8dee4; text-align: right;"><span class="pageNumber"></span></div>'
      }

      await puppeteerPage.pdf(pdfOptions)
    } finally {
      await puppeteerPage.close()
    }
  }
}

module.exports = new HTML2PDF()
