const puppeteer = require('puppeteer');
const pageRenderTimeout = 10;

class HTML2PDF {
  constructor() {
    this.puppeteerConfig = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    };

    this._initialized = false;
    this.chrome = null;
  }

  async _initializePlugins() {
    if (this._initialized) {
      return;
    }
    this.chrome = await puppeteer.launch(this.puppeteerConfig);
    this.puppeteerPage = await this.chrome.newPage();
    await this.puppeteerPage.setJavaScriptEnabled(false)
    this._initialized = true;
  }

  async close() {
    if (this.chrome) {
      await this.chrome.close();
    }
    this.chrome = null;
    this.puppeteerPage = null;
    this._initialized = false;
  }

  async pdf(templatePath, outputPath, options = {}) {
    await this._initializePlugins();
    const puppeteerPage = this.puppeteerPage;
    const { outline = true } = options;

    try {
      await puppeteerPage.goto('file:' + templatePath, {
        waitUntil: ['load', 'domcontentloaded'],
        timeout: 1000 * (pageRenderTimeout || 30)
      })
    } catch (error) {
      console.log(error.message);
      console.error('Fail to load the page.');
      return error;
    }

    const pdfOptions = {
      path: outputPath,
      displayHeaderFooter: false,
      printBackground: true,
      timeout: 3 * 60 * 1000,
      outline,
    };

    await puppeteerPage.pdf(pdfOptions);
  }
}

module.exports = new HTML2PDF();
