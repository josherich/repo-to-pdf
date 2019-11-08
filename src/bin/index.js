#!/usr/bin/env node

let inputFolder, outputFile, outputFileName

const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const version = require('../../package.json').version

const program = require('commander')
const { Remarkable } = require('remarkable')
const hljs = require('highlight.js')

program
  .version('repo-to-pdf ' + version)
  .usage('<input> [output] [options]')
  .arguments('<input> [output] [options]')
  .option('--width, -w', 'width in pixels')
  .action(function (input, output) {
    inputFolder = input
    outputFile = output
  })

program.parse(process.argv)

outputFileName = outputFile || inputFolder + '.pdf'

outputFile = path.resolve(process.cwd(), outputFile || getFileName(inputFolder) + '.html')

let opts = {
  cssPath: "./github-min.css",
  highlightCssPath: "node_modules/highlight.js/styles/vs.css"
}

function getFileName(fpath) {
  let fullPath = fpath.split('/').filter(f => f.length > 0)
  return fileName = fullPath[fullPath.length-1]
}

class RepoBook {
  constructor(props) {
    this.langs = {
      'js': 'javascript',
      'py': 'python',
      'go': 'go',
      'ruby': 'ruby',
      'cc': 'cpp',
      'c': 'c',
      'rs': 'rust',
      'md': 'md'
    };
    this.blackList = ['node_modules']
  }

  readDir(dir, allFiles = []) {
    const files = fs.readdirSync(dir).map(f => path.join(dir, f))
    allFiles.push(...files)
    files.forEach(f => {
      fs.statSync(f).isDirectory() && this.blackList[f] == -1 && this.readDir(f, allFiles)
    })
    return allFiles
  }

  renderIndex(files) {
    return files
    .filter(f => {
      let fileName = getFileName(f)
      return fileName[0] != '.'
    })
    .map(f => {
      return `[${f}](#${f})`
    })
    .join('\n')
  }

  render(path) {
    let files = this.readDir(path)
    let index = this.renderIndex(files)
    let contents = [index]

    for (let i = 0; i < files.length; i++) {
      let fileName = getFileName(files[i])
      if (fs.statSync(files[i]).isDirectory()) {
        continue
      }

      let ext = fileName.split('.')
      if (ext.length == 0) {
        continue
      }

      if (fileName[0] == '.') {
        continue
      }

      let fileExt = ext[ext.length-1]
      let lang = this.langs[fileExt]
      if (lang) {
        let data = fs.readFileSync(files[i])
        if (fileExt !== 'md') {
          data = `#### ${files[i]}`
            + "\n``` " + lang  + "\n"
              + data
            + "\n```\n"
        } else {
          data = `#### ${files[i]}`
            + "\n"
              + data
            + "\n"
        }
        contents.push(data)
      }
    }
    return contents.join('\n')
  }
}

let repoBook = new RepoBook()
let mdString = repoBook.render(inputFolder)

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
}).use(function(remarkable) {
  remarkable.renderer.rules.heading_open = function(tokens, idx) {
    return '<h' + tokens[idx].hLevel + ' id=' + tokens[idx + 1].content + ' anchor=true>';
  };
})

let mdHtml = `<article class="markdown-body">` + mdParser.render(mdString) + "</article>"
let html5bpPath = path.resolve(__dirname, '../../', './html5bp')
let isWin = os.name === 'windows'
let protocol = isWin ? 'file:///' : 'file://'
let html = fs.readFileSync(html5bpPath + '/index.html', 'utf-8')
  .replace(/\{\{baseUrl\}\}/g, protocol + html5bpPath)
  .replace('{{content}}', mdHtml)
  .replace('{{cssPath}}', protocol + path.resolve(__dirname, '../../', opts.cssPath))
  .replace('{{highlightPath}}', protocol + path.resolve(__dirname, '../../', opts.highlightCssPath))

fs.writeFileSync(outputFile, html)

let htmlFile = path.resolve(process.cwd(), outputFile)
let pdf = spawn('node', [path.resolve(__dirname, '../../node_modules/relaxedjs/src/index.js'), htmlFile, '--build-once'])

pdf.on('close', function (code) {
  console.log(`${outputFileName} is created.`);
})