const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

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

  it('only renders text files with languages supported by highlight.js', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-'))
    const srcDir = path.join(tmpDir, 'src')
    const assetsDir = path.join(tmpDir, 'assets')
    fs.mkdirSync(srcDir)
    fs.mkdirSync(assetsDir)

    fs.writeFileSync(path.join(srcDir, 'app.js'), 'console.log("hello")\n')
    fs.writeFileSync(path.join(srcDir, 'notes.txt'), 'plain project notes\n')
    fs.writeFileSync(path.join(srcDir, 'Dockerfile'), 'FROM node:22\n')
    fs.writeFileSync(path.join(srcDir, 'data.csv'), 'name,value\nrepo,1\n')
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]))

    const repoBook = new RepoBook(tmpDir, 'test', Number.MAX_SAFE_INTEGER, null)
    const output = repoBook.render()

    expect(output).toContain('app.js')
    expect(output).toContain('``` javascript')
    expect(output).toContain('notes.txt')
    expect(output).toContain('``` plaintext')
    expect(output).toContain('Dockerfile')
    expect(output).toContain('``` dockerfile')
    expect(output).not.toContain('data.csv')
    expect(output).not.toContain('icon.png')
    expect(output).not.toContain('/assets')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('renders example sources with broad language, markdown, long line, and unicode coverage', () => {
    const examplesDir = path.join(__dirname, 'examples')

    const repoBook = new RepoBook(examplesDir, 'examples', Number.MAX_SAFE_INTEGER, null)
    const output = repoBook.render()
    const tinySvgUrl = pathToFileURL(path.join(examplesDir, 'assets/tiny.svg')).href

    expect(output).toContain('README.md')
    expect(output).toContain(`![Tiny fixture image](${tinySvgUrl})`)
    expect(output).toContain('Special characters: <>&"\'` \\ / | { } [ ]() \\* \\_ ~ ^ % \\$ # @ ! ?')
    expect(output).toContain('CJK text: 你好，世界。日本語の文章。한국어 문장.')

    expect(output).toContain('``` javascript')
    expect(output).toContain('``` typescript')
    expect(output).toContain('``` python')
    expect(output).toContain('``` go')
    expect(output).toContain('``` rust')
    expect(output).toContain('``` java')
    expect(output).toContain('``` css')
    expect(output).toContain('``` sql')

    expect(output).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('resolves local markdown image paths relative to their markdown file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-'))
    const docsDir = path.join(tmpDir, 'docs')
    const assetsDir = path.join(docsDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })
    fs.writeFileSync(path.join(assetsDir, 'tiny.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n')
    fs.writeFileSync(
      path.join(docsDir, 'README.md'),
      ['![Relative image](./assets/tiny.svg)', '<img src="./assets/tiny.svg" alt="HTML image">', '![Remote image](https://example.com/image.png)', '![Data image](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)'].join('\n')
    )

    const repoBook = new RepoBook(tmpDir, 'test', Number.MAX_SAFE_INTEGER, null)
    const output = repoBook.render()
    const tinySvgUrl = pathToFileURL(path.join(assetsDir, 'tiny.svg')).href

    expect(output).toContain(`![Relative image](${tinySvgUrl})`)
    expect(output).toContain(`<img src="${tinySvgUrl}" alt="HTML image">`)
    expect(output).toContain('![Remote image](https://example.com/image.png)')
    expect(output).toContain('![Data image](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('excludes files matching exclude_list glob patterns', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-to-pdf-'))
    const srcDir = path.join(tmpDir, 'src')
    const generatedDir = path.join(srcDir, 'generated')
    fs.mkdirSync(generatedDir, { recursive: true })

    fs.writeFileSync(path.join(srcDir, 'app.js'), 'console.log("app")\n')
    fs.writeFileSync(path.join(srcDir, 'app.test.js'), 'test("app")\n')
    fs.writeFileSync(path.join(generatedDir, 'bundle.js'), 'console.log("generated")\n')
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Project\n')

    const repoBook = new RepoBook(tmpDir, 'test', Number.MAX_SAFE_INTEGER, null, '**/*.test.js,src/generated/**')
    const output = repoBook.render()

    expect(output).toContain('app.js')
    expect(output).toContain('README.md')
    expect(output).not.toContain('app.test.js')
    expect(output).not.toContain('generated')
    expect(output).not.toContain('bundle.js')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
