const path = require('path')
const fs = require('fs')
const os = require('os')

const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')

const RepoBook = require('./repo')
const { sequenceRenderEbook } = require('./render')
const { getFileName, getFileNameExt } = require('./utils')

let opts = {
  cssPath: {
    desktop: "./github-min.css",
    tablet: "./github-min-tablet.css",
    mobile: "./github-min-mobile.css"
  },
  highlightCssPath: require.resolve('highlight.js') + "/../../styles/vs.css",
  relaxedCSS: {
    desktop: "",
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
            }`
  }
}

function generateEbook(inputFolder, outputFile, title, options) {
  let { renderer, calibrePath, pdf_size, white_list, format, device } = options
  let repoBook = new RepoBook(inputFolder, title, pdf_size, white_list)
  let outputFiles = []

  outputFileName = outputFile || inputFolder + '.pdf'
  outputFile = path.resolve(
    process.cwd(),
    getFileNameExt(outputFileName, 'html') || getFileName(inputFolder) + '.html'
  )

  while(repoBook.hasNextPart()) {
    let mdString = repoBook.render()
    let mdParser = new Remarkable({
      breaks: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(lang, str).value
          } catch (err) {}
        }

        try {
          return hljs.highlightAuto(str).value
        } catch (err) {}

        return ''
      }
    })
    .use(function(remarkable) {
      remarkable.renderer.rules.heading_open = function(tokens, idx) {
        return '<h' + tokens[idx].hLevel + ' id=' + tokens[idx + 1].content + ' anchor=true>';
      }
    })

    let mdHtml = `<article class="markdown-body">` + mdParser.render(mdString) + "</article>"
    let html5bpPath = path.resolve(__dirname, '../', './html5bp')
    let isWin = os.name === 'windows'
    let protocol = isWin ? 'file:///' : 'file://'
    let html = fs.readFileSync(html5bpPath + '/index.html', 'utf-8')
      .replace(/\{\{baseUrl\}\}/g, protocol + html5bpPath)
      .replace('{{content}}', mdHtml)
      .replace('{{cssPath}}', protocol + path.resolve(__dirname, '../', opts.cssPath[device]))
      .replace('{{highlightPath}}', protocol + opts.highlightCssPath)
      .replace('{{relaxedCSS}}', opts.relaxedCSS[device])

    let _outputFile = outputFile
    if (!repoBook.hasSingleFile()) {
      _outputFile = outputFile.replace('.html', '-' + repoBook.currentPart() + '.html')
    }
    fs.writeFileSync(_outputFile, html)
    outputFiles.push(_outputFile)
  }
  sequenceRenderEbook(outputFiles, 0, options)
}

module.exports = { generateEbook }