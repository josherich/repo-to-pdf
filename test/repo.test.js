const fs = require('fs')
const os = require('os')
const path = require('path')

const RepoBook = require('../src/repo')

describe('RepoBook', () => {
  it('includes sources for languages without aliases in highlight.js', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-'))
    const swiftFile = path.join(tmpDir, 'example.swift')
    fs.writeFileSync(swiftFile, 'print("hello")\n')

    const repoBook = new RepoBook(tmpDir, 'test', Number.MAX_SAFE_INTEGER, null)
    const output = repoBook.render()

    expect(output).toContain('example.swift')
    expect(output).toContain('``` swift')
    expect(output).toContain('print("hello")')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
