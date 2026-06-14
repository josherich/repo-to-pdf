const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const { getPdfOutlineCount } = require('../utils/pdf-outline')

const outputDir = path.resolve(__dirname, '../tmp')
const withOutline = path.join(outputDir, 'outline-enabled.pdf')
const withoutOutline = path.join(outputDir, 'outline-disabled.pdf')

function generatePdf(outputFile, outline) {
  const script = `
    const path = require('path')
    const { generateEbook } = require(${JSON.stringify(path.resolve(__dirname, '../../src/html'))})

    generateEbook('./src', ${JSON.stringify(outputFile)}, 'repo-to-pdf', {
      renderer: 'node',
      pdf_size: 5 * 1000 * 1000,
      white_list: 'js',
      format: 'pdf',
      device: 'desktop',
      baseUrl: ${JSON.stringify(path.resolve(__dirname, '../../html5bp'))},
      outline: ${outline},
    }).then(() => process.exit(0)).catch((error) => {
      console.error(error)
      process.exit(1)
    })
  `

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'PDF generation failed')
  }
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true })

  generatePdf(withOutline, true)
  generatePdf(withoutOutline, false)

  const enabledCount = getPdfOutlineCount(withOutline)
  const disabledCount = getPdfOutlineCount(withoutOutline)

  if (enabledCount <= 0) {
    console.error(`Expected bookmarks in ${withOutline}, found ${enabledCount}`)
    process.exit(1)
  }

  if (disabledCount !== 0) {
    console.error(`Expected no bookmarks in ${withoutOutline}, found ${disabledCount}`)
    process.exit(1)
  }

  console.log(`outline enabled: ${enabledCount} bookmarks`)
  console.log('outline disabled: no bookmarks')
}

main()
