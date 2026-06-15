const fs = require('fs')
const path = require('path')
const os = require('os')

jest.mock('../src/puppeteer', () => ({
  pdf: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
}))

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process')
  return {
    ...actual,
    spawnSync: jest.fn(() => ({ error: null })),
  }
})

const { spawnSync } = require('child_process')
const { sequenceRenderEbook } = require('../src/render')

describe('sequenceRenderEbook calibre options', () => {
  let tempDir
  let htmlFile
  let calibrePath

  beforeEach(() => {
    jest.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-calibre-'))
    htmlFile = path.join(tempDir, 'output.html')
    fs.writeFileSync(htmlFile, '<html><body>test</body></html>')
    calibrePath = path.join(tempDir, 'ebook-convert')
    fs.writeFileSync(calibrePath, '')
    fs.chmodSync(calibrePath, 0o755)
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(path.resolve(__dirname, '..'))
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('passes --allow-local-files-outside-root to calibre', () => {
    sequenceRenderEbook([htmlFile], {
      outputFileName: 'output.pdf',
      renderer: 'calibre',
      calibrePath,
      format: 'pdf',
    })

    expect(spawnSync).toHaveBeenCalledTimes(1)
    const args = spawnSync.mock.calls[0][1]
    expect(args).toContain('--allow-local-files-outside-root')
  })
})
