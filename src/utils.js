const path = require('path')

function getSizeInByte(mb) {
  return mb * 0.8 * 1000 * 1000
}

function getFileName(fpath) {
  let base = path.basename(fpath)
  return base[0] === '.' ? 'untitled' : base
}

function getCleanFilename(filename, folder) {
  return filename.replace(folder, '')
}

function getFileNameExt(fileName, ext = 'pdf') {
  return fileName.replace(/\.[0-9a-zA-Z]+$/, `.${ext}`)
}

module.exports = { getSizeInByte, getFileName, getCleanFilename, getFileNameExt }