#!/usr/bin/env node
const program = require('commander')

const { getSizeInByte } = require('../utils')
const { generateEbook } = require('../html')

const version = require('../../package.json').version

let inputFolder, outputFile
program
  .version('repo-to-pdf ' + version)
  .usage('<input> [output] [options]')
  .arguments('<input> [output] [options]')
  .option('-d, --device <platform>', 'device [desktop(default)|mobile|tablet]', 'desktop')
  .option('-t, --title [name]', 'title')
  .option('-w, --whitelist [wlist]', 'file format white list, split by ,')
  .option('-s, --size [size]', 'pdf file size limit, in Mb')
  .option('-r, --renderer <engine>', '[node|wkhtmltopdf|calibre] use node(puppeteer), wkhtmltopdf or calibre to render pdf', 'node')
  .option('-f, --format <ext>', 'output format, pdf|mobi|epub', 'pdf')
  .option('--no-outline', 'disable PDF outlines/bookmarks (default enabled)')
  .option('-p, --concurrency <num>', 'number of parallel Puppeteer PDF render jobs')
  .option('-c, --calibre [path]', 'path to calibre')
  .option('-b, --baseUrl [url]', 'base url of html folder. By default file:// is used.')
  .action(function(input, output) {
    inputFolder = input
    outputFile = output
  })

program.parse(process.argv)

const PDF_SIZE    = getSizeInByte(10) // 10 Mb
const title       = program.title || inputFolder
const device      = program.device
const pdf_size    = program.size ? getSizeInByte(program.size) : PDF_SIZE
const format      = program.format
const white_list  = program.whitelist
const renderer    = program.renderer
const calibrePath = program.calibre
const baseUrl     = program.baseUrl
const outline     = program.outline
const concurrency = program.concurrency

generateEbook(inputFolder, outputFile, title, {
  renderer,
  calibrePath,
  pdf_size,
  white_list,
  format,
  device,
  baseUrl,
  outline,
  concurrency,
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
