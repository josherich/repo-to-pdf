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
  highlightCssPath: require.resolve('highlight.js') + "/../../styles/vs.css"
}

function getFileName(fpath) {
  let base = path.basename(fpath)
  return base[0] === '.' ? 'untitled' : base
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

  readDir(dir, allFiles = [], level = 0) {
    let files = fs.readdirSync(dir).map(f => path.join(dir, f))
    files = files.map(f => [f, level])
    allFiles.push(...files)
    files.forEach(pair => {
      let f = pair[0]
      fs.statSync(f).isDirectory() && path.basename(f)[0] != '.' && this.blackList.indexOf(f) == -1 && this.readDir(f, allFiles, level+1)
    })
    return allFiles
  }

  renderIndex(files) {
    return files
    .filter(f => {
      let fileName = getFileName(f[0])
      let ext = path.extname(fileName).slice(1)
      return fileName[0] != '.' && (ext in this.langs)
    })
    .map(f => {
      let left_pad = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(f[1])
      return `${left_pad}[${f[0]}](#${f[0]})`
    })
    .join('\n')
  }

  render(dir) {
    let files = this.readDir(dir)
    let index = this.renderIndex(files)
    let contents = [index]

    for (let i = 0; i < files.length; i++) {
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

      let lang = this.langs[ext]
      if (lang) {
        let data = fs.readFileSync(file)
        if (ext === 'md') {
          data = `#### ${file}`
            + "\n"
              + data
            + "\n"
        } else {
          data = `#### ${file}`
            + "\n``` " + lang  + "\n"
              + data
            + "\n```\n"
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
  .replace('{{highlightPath}}', protocol + opts.highlightCssPath)

fs.writeFileSync(outputFile, html)

let htmlFile = path.resolve(process.cwd(), outputFile)
let pdf = spawn('node', [path.resolve(__dirname, require.resolve('relaxedjs')), htmlFile, '--build-once'])

pdf.on('close', function (code) {
  console.log(`${outputFileName} is created.`);
})