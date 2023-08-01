const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const { getFileNameExt } = require('./utils')
const html2PDF = require('./puppeteer');
const wkhtml2PDF = require('./wkhtmltopdf');

let startTs

function removeRelaxedjsTempFiles(outputFileName) {
  const prefix = outputFileName.split('.').reverse().slice(1).reverse().join('.')
  const html = spawnSync('rm', [`${prefix}.html`])
  const htm = spawnSync('rm', [`${prefix}_temp.htm`])
}

function reportPerformance(outputFileName, startTs) {
  const ts = (Date.now() - startTs) / 1000
  console.log(`${outputFileName} created in ${ts} seconds.`)
}

async function sequenceRenderPDF(docFiles) {
  for (let i = 0; i < docFiles.length; i++) {
    const file = docFiles[i];
    await html2PDF.pdf(file, file.replace('.html', '.pdf'));
  }
  // close chrome so that cli can terminate
  html2PDF.close()
}

function renderPDF(docFiles) {
  const parallel = 1;
  const total = docFiles.length;
  for (let i = 0; i < total;) {
    let j = 0;
    for (; j < parallel && (i + j) < total; j++) {
      wkhtml2PDF(docFiles[i + j], docFiles[i + j].replace('.html', '.pdf'));
    }
    i += j;
  }
}

function sequenceRenderEbook(docFiles, options, i = 0) {
  const { outputFileName, renderer, calibrePath, format } = options

  if (i === 0) {
    startTs = Date.now()
  }
  if (i >= docFiles.length) {
    if (renderer === 'node') {
      removeRelaxedjsTempFiles(outputFileName)
    }
    reportPerformance(outputFileName, startTs)
    return
  }
  const docFile = path.resolve(process.cwd(), docFiles[i])
  const formatFile = getFileNameExt(docFile, format)

  const formatArgs = {
    pdf: [
      '--pdf-add-toc',
      '--paper-size',
      'a4',
      '--pdf-default-font-size',
      '12',
      '--pdf-mono-font-size',
      '12',
      '--pdf-page-margin-left',
      '2',
      '--pdf-page-margin-right',
      '2',
      '--pdf-page-margin-top',
      '2',
      '--pdf-page-margin-bottom',
      '2',
      '--page-breaks-before',
      '/',
    ],
    mobi: ['--mobi-toc-at-start', '--output-profile', 'kindle_dx'],
    epub: ['--epub-inline-toc', '--output-profile', 'ipad3', '--flow-size', '1000'],
  }

  const args = {
    calibre: [calibrePath, [docFile, formatFile].concat(formatArgs[format])]
  }

  if (renderer === 'calibre') {
    if (!fs.existsSync(calibrePath)) {
      console.log(`Calibre is not available.`)
    }
  }

  const cmd = args[renderer]
  const res = spawnSync(cmd[0], cmd[1])
  if (res.error) {
    console.log(`Some error happened when creating ${formatFile}.`)
    console.error(res.error);
    return
  }

  if (!fs.existsSync(formatFile)) {
    console.log(`${docFiles[i]} was not rendered. ${formatFile}`)
  }

  sequenceRenderEbook(docFiles, options, i + 1)
}

module.exports = { sequenceRenderEbook, sequenceRenderPDF, renderPDF }
