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
    // console.log('==========chrome init', this.chrome);
    this._initialized = true;
  }

  async pdf(templatePath, outputPath) {
    console.log('rendering ', templatePath, outputPath)
    await this._initializePlugins();
    const puppeteerPage = await this.chrome.newPage();

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