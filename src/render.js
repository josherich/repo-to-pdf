const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const { getFileName, getFileNameExt } = require('./utils')

let startTs

function sequenceRenderEbook(htmlFiles, i, options) {
  let { renderer, calibrePath, pdf_size, white_list, format, device } = options

  if (i == 0) {
    startTs = Date.now()
  }
  if (i >= htmlFiles.length) {
    let ts = (Date.now() - startTs) / 1000
    console.log(`${outputFileName} created in ${ts} seconds.`)
    return
  }
  let htmlFile = path.resolve(process.cwd(), htmlFiles[i])
  let formatFile = getFileNameExt(htmlFile, format)

  let formatArgs = {
    'pdf': [
      '--pdf-add-toc',
      '--paper-size', 'a4',
      '--pdf-default-font-size', '12',
      '--pdf-mono-font-size', '12',
      '--pdf-page-margin-left', '2',
      '--pdf-page-margin-right', '2',
      '--pdf-page-margin-top', '2',
      '--pdf-page-margin-bottom', '2',
      '--page-breaks-before', "/"
    ],
    'mobi': ['--mobi-toc-at-start', '--output-profile', 'kindle_dx'],
    'epub': ['--epub-inline-toc', '--output-profile', 'ipad3', '--flow-size', '1000']
  }
  let args = {
    'node': ['node',
      [
        path.resolve(__dirname, require.resolve('relaxedjs')),
        htmlFile,
        '--build-once',
        '--no-sandbox'
      ]
    ],
    'calibre': [calibrePath,
      [
        htmlFile,
        formatFile
      ].concat(formatArgs[format])
    ]
  }
  let cmd = args[renderer], startTS = Date.now()

  let res = spawnSync(cmd[0], cmd[1])
  if (res.error) {
    console.log(`Some error happened when creating ${formatFile}.`)
    return
  }

  if (!fs.existsSync(formatFile)) {
    console.log(`${htmlFiles[i]} was not rendered.`)
  }

  sequenceRenderEbook(htmlFiles, i+1, options)
}

module.exports = { sequenceRenderEbook }