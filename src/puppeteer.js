const puppeteer = require('puppeteer');
const pageRenderTimeout = 10;

class HTML2PDF {
  constructor() {
    this.puppeteerConfig = {
      headless: true,
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
    this.puppeteerPage.setJavaScriptEnabled(false)
    this._initialized = true;
  }

  close() {
    this.chrome && this.chrome.close();
    this._initialized = false;
  }

  async pdf(templatePath, outputPath) {
    await this._initializePlugins();
    const puppeteerPage = this.puppeteerPage;

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

    const options = {
      path: outputPath,
      displayHeaderFooter: false,
      printBackground: true,
      timeout: 3 * 60 * 1000,
    };

    await puppeteerPage.pdf(options);
  }
}

module.exports = new HTML2PDF();