#!/usr/bin/env node

let inputFolder, outputFile, outputFileName, device, title, pdf_size, white_list, renderer, format, calibrePath

const fs = require('fs')

const program = require('commander')

const { getSizeInByte } = require('../utils')
const { generateEbook } = require('../html')

const version = require('../../package.json').version
const PDF_SIZE = getSizeInByte(10) // 10 Mb

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
  .option('-c, --calibre [path]', 'path to calibre')
  .action(function (input, output) {
    inputFolder = input
    outputFile = output
  })

program.parse(process.argv)

title       = program.title || inputFolder
device      = program.device
pdf_size    = program.size ? getSizeInByte(program.size) : PDF_SIZE
white_list  = program.whitelist
renderer    = program.renderer
format      = program.format
calibrePath = program.calibre

if (format !== 'pdf' && renderer === 'node') {
  console.log(`Try to create ${format}, use renderer calibre.`)
  renderer = 'calibre'
}

// check calibre path
calibrePaths = ['/Applications/calibre.app/Contents/MacOS/ebook-convert', '/usr/bin/ebook-convert']
if (calibrePath) {
  calibrePaths.unshift(calibrePath)
}

let i = 0
for (; i < calibrePaths.length; i++) {
  if (fs.existsSync(calibrePaths[i])) {
    calibrePath = calibrePaths[i]
    break
  }
}
if (i === calibrePaths.length) {
  console.log('Calibre ebook-convert not found, make sure you pass it by --calibre /path/to/ebook-convert.')
  return
}

generateEbook(inputFolder, outputFile, title, {
  renderer,
  calibrePath,
  pdf_size,
  white_list,
  format,
  device
})