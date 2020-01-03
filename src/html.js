const path = require('path')
const fs = require('fs')

const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')

const RepoBook = require('./repo')
const { sequenceRenderEbook } = require('./render')
const { getFileName, getFileNameExt } = require('./utils')

let opts = {
  cssPath: {
    desktop: "./css/github-min.css",
    tablet: "./css/github-min-tablet.css",
    mobile: "./css/github-min-mobile.css"
  },
  highlightCssPath: "./css/vs.css",
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
  let { renderer, calibrePath, pdf_size, white_list, format, device, baseUrl, protocol } = options
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

    let mdHtml = `<article class="markdown-body">`
                    + mdParser.render(mdString)
               + `</article>`
    let indexHtmlPath = path.join(__dirname, '../html5bp', 'index.html')
    let html = fs.readFileSync(indexHtmlPath, 'utf-8')
      // TODO: this sits before content replacing, to prevent replacing baseUrl in content text
      .replace(/\{\{baseUrl\}\}/g,  protocol + baseUrl)
      .replace('{{cssPath}}',       protocol + path.join(baseUrl, opts.cssPath[device]))
      .replace('{{highlightPath}}', protocol + path.join(baseUrl, opts.highlightCssPath))
      .replace('{{relaxedCSS}}',    protocol + path.join(baseUrl, opts.relaxedCSS[device]))
      .replace('{{content}}',       mdHtml)

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