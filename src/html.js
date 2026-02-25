const path = require('path')
const fs = require('fs')
const os = require('os')

const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')

const RepoBook = require('./repo')
const { sequenceRenderEbook, sequenceRenderPDF, renderPDF } = require('./render')
const { getFileName, getFileNameExt } = require('./utils')

function getRemarkableParser() {
  return new Remarkable({
    breaks: true,
    html: true, // allow raw HTML emitted by repo.js (file-header, to-top links)
    highlight: function(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(lang, str).value
        } catch (err) {}
      }

      try {
        return hljs.highlightAuto(str).value
      } catch (err) {}

      return ''
    },
  }).use(function(remarkable) {
    remarkable.renderer.rules.heading_open = function(tokens, idx) {
      return '<h' + tokens[idx].hLevel + ' id=' + tokens[idx + 1].content + ' anchor=true>'
    }
  })
}

// => './path/file-1.html'
function getHTMLFiles(mdString, repoBook, options) {
  const { pdf_size, white_list, device, baseUrl, protocol, renderer, outputFileName, inputFolder, title, customCss } = options
  const opts = {
    cssPath: {
      desktop: '/css/github-min.css',
      tablet: '/css/github-min-tablet.css',
      mobile: '/css/github-min-mobile.css',
    },
    highlightCssPath: '/css/vs.css',
    // desktop: explicit Letter page with generous margins so output is
    // predictable and easy to override via --custom-css.
    // tablet/mobile: custom page sizes (override print.css defaults).
    relaxedCSS: {
      desktop: '',
      tablet: `@page {
                size: 8in 14in;
                -relaxed-page-width: 8in;
                -relaxed-page-height: 14in;
                margin: 0;
              }`,
      mobile: `@page {
                size: 6in 10in;
                -relaxed-page-width: 6in;
                -relaxed-page-height: 10in;
                margin: 0;
              }`,
    },
  }
  const HTMLFileNameWithExt = getFileNameExt(outputFileName, 'html') || getFileName(inputFolder) + '.html'
  let outputFile = path.resolve(process.cwd(), HTMLFileNameWithExt)

  const mdParser = getRemarkableParser()

  const mdHtml = `<article class="markdown-body">` + mdParser.render(mdString) + `</article>`
  const indexHtmlPath = path.join(__dirname, '../html5bp', 'index.html')
  const htmlString = fs
    .readFileSync(indexHtmlPath, 'utf-8')
    // TODO: this sits before content replacing, to prevent replacing baseUrl in content text
    .replace(/\{\{baseUrl\}\}/g, protocol + baseUrl)
    .replace('{{cssPath}}', protocol + baseUrl + opts.cssPath[device])
    .replace('{{highlightPath}}', protocol + baseUrl + opts.highlightCssPath)
    .replace('{{relaxedCSS}}', opts.relaxedCSS[device])
    .replace('{{title}}', title || '')
    .replace('{{customCSS}}', customCss || '')
    .replace('{{content}}', mdHtml)

  if (!repoBook.hasSingleFile()) {
    outputFile = outputFile.replace('.html', '-' + repoBook.currentPart() + '.html')
  }
  fs.writeFileSync(outputFile, htmlString)
  return outputFile
}

function checkOptions(options) {
  if (options.outline === undefined) {
    options.outline = true
  }

  if (options.concurrency !== undefined) {
    const concurrency = Number(options.concurrency)
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      console.log(`Invalid concurrency "${options.concurrency}", fallback to auto mode.`)
      delete options.concurrency
    } else {
      options.concurrency = concurrency
    }
  }

  if (options.baseUrl) {
    options.protocol = ''
  } else {
    options.protocol = os.name === 'windows' ? 'file:///' : 'file://'
    options.baseUrl = path.resolve(__dirname, '../html5bp')
  }

  // Load user-supplied custom CSS file if provided
  if (options.customCssPath) {
    if (!fs.existsSync(options.customCssPath)) {
      console.log(`Custom CSS file not found: ${options.customCssPath}`)
      return false
    }
    options.customCss = fs.readFileSync(options.customCssPath, 'utf-8')
  }

  if (options.format !== 'pdf' && options.renderer === 'node') {
    console.log(`Try to create ${options.format}, use renderer Calibre.`)
    options.renderer = 'calibre'
  }

  // check calibre path
  const calibrePaths = ['/Applications/calibre.app/Contents/MacOS/ebook-convert', '/usr/bin/ebook-convert']
  if (options.calibrePath) {
    calibrePaths.unshift(options.calibrePath)
  }

  let i = 0
  for (; i < calibrePaths.length; i++) {
    if (fs.existsSync(calibrePaths[i])) {
      options.calibrePath = calibrePaths[i]
      break
    }
  }
  if (i === calibrePaths.length && ['mobi', 'epub'].includes(options.format)) {
    console.log('Calibre ebook-convert not found, make sure you specify the path by --calibre /path/to/ebook-convert.')
    return false
  }
  return true
}

/**
 * @typedef Options
 * @type {object}
 * @property {string} renderer - [node|calibre|wkhtmltopdf] can be either node, calibre and wkhtmltopdf
 * @property {string} calibrePath - path of calibre's ebook-convert
 * @property {string} pdf_size - pdf size limit, in bytes
 * @property {string} white_list - list of file extensions to be included, separate by ','
 * @property {string} format - [mobi|epub|pdf] can be either mobi, epub, pdf
 * @property {string} device - [desktop|tablet|mobile] style can be opt for desktop, tablet and mobile
 * @property {string} baseUrl - base url of CSS style files
 * @property {boolean} outline - include PDF outline/bookmarks (default true)
 * @property {number} concurrency - max number of parallel Puppeteer render jobs (default auto)
 */

/**
 * Generate ebook from content folder with the given file format
 * @param {string} inputFolder - content folder
 * @param {string} outputFile - output file name
 * @param {string} title - title in ebook file
 * @param {Options} options
 */
async function generateEbook(inputFolder, outputFile, title, options = { renderer: 'node' }) {
  if (!checkOptions(options)) {
    return
  }

  const { pdf_size, white_list, renderer } = options
  const repoBook = new RepoBook(inputFolder, title, pdf_size, white_list)

  const defaultOutputFileName = getFileName(inputFolder) + '.pdf'
  const outputFileName = outputFile || defaultOutputFileName

  options.outputFileName = outputFileName
  options.inputFolder = inputFolder
  options.outputFile = outputFile
  options.title = title

  const outputFiles = []
  while (repoBook.hasNextPart()) {
    const mdString = repoBook.render()
    if (!mdString) {
      console.log('Nothing to generate.')
      return
    }
    let outputFile = null
    outputFile = getHTMLFiles(mdString, repoBook, options)

    if (!outputFile) {
      console.log('Fail to generate HTML files that are used to generate PDFs.')
      break
    }
    outputFiles.push(outputFile)
  }
  if (renderer === 'calibre') {
    sequenceRenderEbook(outputFiles, options)
  } else if (renderer === 'node') {
    await sequenceRenderPDF(outputFiles, options)
  } else if (renderer === 'wkhtmltopdf') {
    renderPDF(outputFiles)
  }
}

module.exports = { generateEbook }
