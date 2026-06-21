const fs = require('fs')
const path = require('path')

const { renderMarkdownToPdf } = require('./pdf/layout')
const { getFileName, getFileNameExt } = require('./utils')

// Resolve the output PDF path for the current RepoBook part, mirroring the
// naming scheme used by the HTML pipeline (book.pdf, book-1.pdf, ...).
function getNativeOutputFile(repoBook, options) {
  const { outputFileName, inputFolder } = options
  const pdfName = getFileNameExt(outputFileName, 'pdf') || getFileName(inputFolder) + '.pdf'
  let outputFile = path.resolve(process.cwd(), pdfName)

  if (!repoBook.hasSingleFile()) {
    outputFile = outputFile.replace('.pdf', '-' + repoBook.currentPart() + '.pdf')
  }
  return outputFile
}

// Render one RepoBook part (a markdown string) straight to a PDF file using the
// dependency-free generator.
function renderNativePart(mdString, repoBook, options) {
  const outputFile = getNativeOutputFile(repoBook, options)
  const buffer = renderMarkdownToPdf(mdString, {
    outline: options.outline !== false,
    footerPageNumber: options.footerPageNumber,
    footerChapterTitle: options.footerChapterTitle,
  })
  fs.writeFileSync(outputFile, buffer)
  return outputFile
}

module.exports = { renderNativePart }
