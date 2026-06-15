const fs = require('fs')

function createMockPdf() {
  const parts = ['%PDF-1.4\n']
  const objects = ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>\nendobj\n']

  const offsets = [0]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(parts.join('')))
    parts.push(object)
  }

  const xrefOffset = Buffer.byteLength(parts.join(''))
  parts.push('xref\n')
  parts.push(`0 ${offsets.length}\n`)
  parts.push('0000000000 65535 f \n')
  for (const offset of offsets.slice(1)) {
    parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  }
  parts.push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return parts.join('')
}

function writeMockPdf(outputPath) {
  fs.writeFileSync(outputPath, createMockPdf())
}

function isPdf(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return false
  }

  const pdf = fs.readFileSync(outputPath, 'utf8')
  return pdf.startsWith('%PDF-') && pdf.includes('\nxref\n') && pdf.trimEnd().endsWith('%%EOF')
}

module.exports = { isPdf, writeMockPdf }
