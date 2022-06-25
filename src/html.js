const path = require('path')
const fs = require('fs')

const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')

const RepoBook = require('./repo')
const { sequenceRenderEbook, sequenceRenderPDF, renderPDF } = require('./render')
const { getFileName, getFileNameExt } = require('./utils')

function getRemarkableParser() {
  return new Remarkable({
    breaks: true,
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
  const { pdf_size, white_list, device, baseUrl, protocol, renderer, outputFileName, inputFolder } = options
  const opts = {
    cssPath: {
      desktop: '/css/github-min.css',
      tablet: '/css/github-min-tablet.css',
      mobile: '/css/github-min-mobile.css',
    },
    highlightCssPath: '/css/vs.css',
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
    .replace('{{content}}', mdHtml)

  if (!repoBook.hasSingleFile()) {
    outputFile = outputFile.replace('.html', '-' + repoBook.currentPart() + '.html')
  }
  fs.writeFileSync(outputFile, htmlString)
  return outputFile
}

async function generateEbook(inputFolder, outputFile, title, options = { renderer: 'node' }) {
  const { pdf_size, white_list, renderer } = options
  const repoBook = new RepoBook(inputFolder, title, pdf_size, white_list)

  const defaultOutputFileName = getFileName(inputFolder) + '.pdf'
  const outputFileName = outputFile || defaultOutputFileName

  options.outputFileName = outputFileName
  options.inputFolder = inputFolder
  options.outputFile = outputFile

  const outputFiles = []
  while (repoBook.hasNextPart()) {
    const mdString = repoBook.render()
    let outputFile = null
    outputFile = getHTMLFiles(mdString, repoBook, options)

    if (!outputFile) {
      console.log('Fail to generate HTML files that are used to generate PDFs.')
      break
    }
    outputFiles.push(outputFile)
  }
  if (renderer === 'node' || renderer === 'calibre') {
    sequenceRenderEbook(outputFiles, options)
  } else if (renderer === 'puppeteer') {
    await sequenceRenderPDF(outputFiles)
  } else if (renderer === 'wkhtmltopdf') {
    renderPDF(outputFiles)
  }
}

module.exports = { generateEbook }
