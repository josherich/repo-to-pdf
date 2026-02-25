const path = require('path')
const fs = require('fs')
const hljs = require('highlight.js')
const { getFileName, getCleanFilename } = require('./utils')

class RepoBook {
  constructor(dir, title, pdf_size, white_list) {
    this.title = title
    this.pdf_size = pdf_size

    this.blackList = ['node_modules', 'vendor']
    this.whiteList = white_list ? white_list.split(',') : null

    this.aliases = {}
    this.byteOffset = 0
    this.fileOffset = 0
    this.partOffset = 0
    this.done = false
    this.dir = dir

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
    const lang = language(hljs)
    if (lang && lang.aliases) {
      name = name.split('.')[0]
      if (this.whiteList) {
        if (this.whiteList.indexOf(name) > -1) {
          this.aliases[name] = name
        }
      } else {
        this.aliases[name] = name
      }

      lang.aliases.map(alias => {
        if (this.whiteList) {
          if (this.whiteList.indexOf(alias) > -1) {
            this.aliases[alias] = name.split('.')[0]
          }
        } else {
          this.aliases[alias] = name.split('.')[0]
        }
        return null
      })
    }
  }

  registerLanguages() {
    const listPath = path.join(path.dirname(require.resolve('highlight.js')), 'languages')
    fs.readdirSync(listPath).map(f => {
      this.registerLanguage(f, require(path.join(listPath, f)))
      return null
    })
  }

  readDir(dir, allFiles = [], level = 0) {
    const files = fs
      .readdirSync(dir)
      .map(f => path.join(dir, f))
      .filter(f => fs.lstatSync(f).size / 1000 < 2000) // smaller than 2m
      .map(f => [f, level])

    level > 0 ? allFiles.push([dir, level, true]) : null // push folder name

    files.map(pair => {
      const f = pair[0]
      const blackListHit = this.blackList.filter(e => !!f.match(e)).length > 0
      if (!fs.lstatSync(f).isDirectory()) {
        allFiles.push([f, level + 1, false])
      } else {
        path.basename(f)[0] !== '.' && // ignore hidden folders
          blackListHit === false &&
          this.readDir(f, allFiles, level + 1)
      }
      return null
    })
    return allFiles
  }

  renderIndex(files) {
    return files
      .filter(f => {
        const fileName = getFileName(f[0])
        const ext = path.extname(fileName).slice(1)
        const isFolder = fs.lstatSync(f[0]).isDirectory()
        return fileName[0] !== '.' && (ext in this.aliases || isFolder)
      })
      .map(f => {
        const indexName = getCleanFilename(f[0], this.dir, f[1]),
          anchorName = getCleanFilename(f[0], this.dir),
          left_pad = f[2] ? '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(f[1]) : '',
          h_level = '####',
          list_style = f[2] ? '' : '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(f[1]) + '|-'
        return f[2] ? `${h_level} ${left_pad} ${list_style} /${indexName}` : `${h_level} ${left_pad}[${list_style} ${indexName}](#${anchorName})`
      })
      .join('\n')
  }

  render() {
    const files = this.files
    const contents = []
    let i = this.fileOffset

    for (; i < files.length; i++) {
      const file = files[i][0]

      const fileName = getFileName(file)
      if (fs.statSync(file).isDirectory()) {
        continue
      }

      const ext = path.extname(fileName).slice(1)

      if (ext.length === 0) {
        continue
      }

      if (fileName[0] === '.') {
        continue
      }

      const lang = this.aliases[ext]
      if (lang) {
        let data = fs.readFileSync(file)
        const fileId = getCleanFilename(file, this.dir)
        // Use raw HTML so we can attach CSS classes for visual styling and
        // page-break control without touching the device-specific CSS files.
        const fileHeader = `<h4 class="file-header" id="${fileId}">${fileId}</h4>\n` +
          `<a class="to-top" href="#Contents">&#x2191; to top</a>\n`
        if (ext === 'md') {
          data = fileHeader + data + '\n'
        } else {
          data = fileHeader + '``` ' + lang + '\n' + data + '\n```\n'
        }
        contents.push(data)

        this.byteOffset += data.length * 2
        if (this.byteOffset > this.pdf_size) {
          // if more than one part
          const title = `# ${this.title} (${++this.partOffset})\n\n\n\n`

          let toc = '## Contents\n'
          const index = this.renderIndex(files.slice(this.fileOffset, i + 1))
          toc += index
          contents.unshift(title, toc)

          if (i === this.fileOffset) {
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
      this.done = true
      return null
    }

    // if one part
    const title = this.partOffset
      ? `# ${this.title} (${++this.partOffset})\n\n\n\n` // the last part
      : `# ${this.title} \n\n\n\n` // single pdf

    let toc = '## Contents\n'
    const index = this.renderIndex(files.slice(this.fileOffset, i + 1))
    toc += index
    contents.unshift(title, toc)

    this.fileOffset = files.length // should return null next round
    this.done = true

    return contents.join('\n')
  }
}

module.exports = RepoBook
