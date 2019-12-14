#!/usr/bin/env node

let inputFolder, outputFile, outputFileName, device, title, pdf_size, white_list, renderer, format

const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawnSync } = require('child_process')
const version = require('../../package.json').version

const program = require('commander')
const { Remarkable } = require('remarkable')
const toc = require('markdown-toc')

const hljs = require('highlight.js')

const PDF_SIZE = getSizeInByte(5) // 10 Mb

program
  .version('repo-to-pdf ' + version)
  .usage('<input> [output] [options]')
  .arguments('<input> [output] [options]')
  .option('-d, --device <platform>', 'device [desktop(default)|mobile|tablet]', 'desktop')
  .option('-t, --title [name]', 'title')
  .option('-w, --whitelist [wlist]', 'file format white list, split by ,')
  .option('-s, --size [size]', 'pdf file size limit, in Mb')
  .option('-r, --renderer <engine>', 'use chrome or calibre to render pdf', 'node')
  .option('-f, --format <ext>', 'output format, pdf|mobi|epub', 'pdf')
  .action(function (input, output) {
    inputFolder = input
    outputFile = output
  })

program.parse(process.argv)

device      = program.device
title       = program.title || inputFolder
pdf_size    = program.size ? getSizeInByte(program.size) : PDF_SIZE
white_list  = program.whitelist
renderer    = program.renderer
format      = program.format

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

function getSizeInByte(mb) {
  return mb * 0.8 * 1000 * 1000
}

function getFileName(fpath) {
  let base = path.basename(fpath)
  return base[0] === '.' ? 'untitled' : base
}

function getCleanFilename(filename) {
  return filename.replace(inputFolder, '')
}

function getFileNameExt(fileName, ext = 'pdf') {
  return fileName.replace(/\.[0-9a-zA-Z]+$/, `.${ext}`)
}

class RepoBook {
  constructor(dir, title, pdf_size, white_list) {
    this.title = title
    this.pdf_size = pdf_size
    this.blackList = ['node_modules', 'vendor']

    this.aliases = {}
    this.byteOffset = 0
    this.fileOffset = 0
    this.partOffset = 0

    this.done = false

    this.white_list = white_list ? white_list.split(',') : null

    this.files = this.readDir(dir)
    this.registerLanguages()
  }

  hasNextPart() {
    return this.done === false
  }

  hasSingleFile() {
    return this.partOffset === 0 // effective after at least calling render() once
  }

  currentPart() {
    return this.partOffset
  }

  registerLanguage(name, language) {
    let lang = language(hljs)
    if (lang && lang.aliases) {
      name = name.split('.')[0]
      this.aliases[name] = name
      lang.aliases.map(alias => {
        if (this.white_list) {
          if (alias in this.white_list)
            this.aliases[alias] = name.split('.')[0]
        } else {
          this.aliases[alias] = name.split('.')[0]
        }
      })
    }
  }

  registerLanguages() {
    let listPath = path.join(path.dirname(require.resolve('highlight.js')), "languages")
    fs.readdirSync(listPath)
      .map(f => {
        this.registerLanguage(f, require(path.join(listPath, f)))
      })
  }

  readDir(dir, allFiles = [], level = 0) {
    let files = fs.readdirSync(dir).map(f => path.join(dir, f))
    files = files
      .filter(f => (fs.lstatSync(f).size / 1000) < 2000) // smaller than 2m
      .map(f => [f, level])

    allFiles.push(...files)
    files.map(pair => {
      let f = pair[0]
      let blackListHit = this.blackList.filter(e => {
        return !!f.match(e)
      }).length > 0
      fs.lstatSync(f).isDirectory()
        && path.basename(f)[0] != '.'
        && blackListHit == false
        && this.readDir(f, allFiles, level+1)
    })
    return allFiles
  }

  renderIndex(files) {
    return files
    .filter(f => {
      let fileName = getFileName(f[0])
      let ext = path.extname(fileName).slice(1)
      return fileName[0] != '.' && (ext in this.aliases)
    })
    .map(f => {
      let indexName = getCleanFilename(f[0])
      let left_pad = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(f[1])
      let h_level = '###' + '#'.repeat(Math.min(f[1], 3))
      return `${h_level} ${left_pad}[${indexName}](#${indexName})`
    })
    .join('\n')
  }

  render() {
    let files = this.files
    let contents = []
    let i = this.fileOffset

    for (; i < files.length; i++) {
      let file = files[i][0]

      let fileName = getFileName(file)
      if (fs.statSync(file).isDirectory()) {
        continue
      }

      let ext = path.extname(fileName).slice(1)

      if (ext.length == 0) {
        continue
      }

      if (fileName[0] == '.') {
        continue
      }

      let lang = this.aliases[ext]
      if (lang) {
        let data = fs.readFileSync(file)
        if (ext === 'md') {
          data = `#### ${getCleanFilename(file)} \n[to top](#Contents)`
            + "\n"
              + data
            + "\n"
        } else {
          data = `#### ${getCleanFilename(file)} \n[to top](#Contents)`
            + "\n``` " + lang  + "\n"
              + data
            + "\n```\n"
        }
        contents.push(data)

        this.byteOffset += data.length * 2
        if (this.byteOffset > this.pdf_size) {
          // if more than one part
          let title = `# ${this.title} (${++this.partOffset})\n\n\n\n`

          let toc = "## Contents\n"
          let index = this.renderIndex(files.slice(this.fileOffset, i+1))
          toc += index
          contents.unshift(title, toc)

          if (i == this.fileOffset) {
            // when single file exceeds size limit
            this.fileOffset++
          } else {
            this.fileOffset = i
          }
          this.byteOffset = 0

          return contents.join('\n')
        }

      }
    }

    if (contents.length === 0) {
      return null
    }

    // if one part
    let title = this.partOffset
      ? `# ${this.title} (${++this.partOffset})\n\n\n\n` // the last part
      : `# ${this.title} \n\n\n\n` // single pdf

    let toc = "## Contents\n"
    let index = this.renderIndex(files.slice(this.fileOffset, i+1))
    toc += index
    contents.unshift(title, toc)
    // contents.unshift(title)

    this.fileOffset = files.length // should return null next round
    this.done = true

    return contents.join('\n')
  }
}

function sequenceRenderPDF(htmlFiles, i, renderer = 'node') {
  if (i >= htmlFiles.length) return
  let htmlFile = path.resolve(process.cwd(), htmlFiles[i])
  let pdfFile = getFileNameExt(htmlFile, 'pdf')

  let args = {
    'node': ['node',
      [
        path.resolve(__dirname, require.resolve('relaxedjs')),
        htmlFile,
        '--build-once',
        '--no-sandbox'
      ]
    ],
    // 'calibre': ['/usr/bin/ebook-convert',
    'calibre': ['/Applications/calibre.app/Contents/MacOS/ebook-convert',
      [
        htmlFile,
        pdfFile,
        '--pdf-add-toc',
        '--paper-size', 'a4',
        '--pdf-default-font-size', '12',
        '--pdf-mono-font-size', '12',
        '--pdf-page-margin-left', '2',
        '--pdf-page-margin-right', '2',
        '--pdf-page-margin-top', '2',
        '--pdf-page-margin-bottom', '2',
        '--page-breaks-before', "/"
      ]
    ]
  }
  let cmd = args[renderer], startTS = Date.now()
  let pdf = spawnSync(cmd[0], cmd[1])

  let sec = (Date.now() - startTS) / 1000
  if (fs.existsSync(pdfFile)) {
    console.log(`${htmlFiles[i]} is created (${sec} seconds).`)
    sequenceRenderPDF(htmlFiles, i+1, renderer)
  } else {
    // retry
    console.log(`${htmlFiles[i]} is retried.`)
    sequenceRenderPDF(htmlFiles, i, renderer)
  }
}

function generatePDF(inputFolder, title) {
  let repoBook = new RepoBook(inputFolder, title, pdf_size, white_list)
  let outputFiles = []

  outputFileName = outputFile || inputFolder + '.pdf'
  outputFile = path.resolve(process.cwd(), getFileNameExt(outputFileName, 'html') || getFileName(inputFolder) + '.html')

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
    let html5bpPath = path.resolve(__dirname, '../../', './html5bp')
    let isWin = os.name === 'windows'
    let protocol = isWin ? 'file:///' : 'file://'
    let html = fs.readFileSync(html5bpPath + '/index.html', 'utf-8')
      .replace(/\{\{baseUrl\}\}/g, protocol + html5bpPath)
      .replace('{{content}}', mdHtml)
      .replace('{{cssPath}}', protocol + path.resolve(__dirname, '../../', opts.cssPath[device]))
      .replace('{{highlightPath}}', protocol + opts.highlightCssPath)
      .replace('{{relaxedCSS}}', opts.relaxedCSS[device])

    let _outputFile = outputFile
    if (!repoBook.hasSingleFile()) {
      _outputFile = outputFile.replace('.html', '-' + repoBook.currentPart() + '.html')
    }
    fs.writeFileSync(_outputFile, html)
    outputFiles.push(_outputFile)
  }
  sequenceRenderPDF(outputFiles, 0, renderer)
}

generatePDF(inputFolder, title)
