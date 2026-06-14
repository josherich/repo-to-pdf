const fs = require('fs')

function getPdfOutlineCount(pdfPath) {
  const content = fs.readFileSync(pdfPath).toString('latin1')
  const outlineSection = content.match(/\/Type\s*\/Outlines[\s\S]*?\/Count\s+(-?\d+)/)
  if (!outlineSection) {
    return 0
  }

  return Math.abs(parseInt(outlineSection[1], 10))
}

module.exports = { getPdfOutlineCount }
