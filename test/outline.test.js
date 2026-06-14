const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const { getPdfOutlineCount } = require('./utils/pdf-outline')

jest.setTimeout(3 * 60 * 1000)

describe('PDF outline/bookmarks', () => {
  const fixtureWithOutline = path.resolve(__dirname, 'fixtures/with-outline.pdf')
  const fixtureWithoutOutline = path.resolve(__dirname, 'fixtures/without-outline.pdf')

  it('detects outline count from PDF bytes', () => {
    expect(getPdfOutlineCount(fixtureWithOutline)).toBeGreaterThan(0)
    expect(getPdfOutlineCount(fixtureWithoutOutline)).toBe(0)
  })

  it('generates PDF bookmarks end-to-end', () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, 'scripts/check-outline.js')], {
      encoding: 'utf8',
    })

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'outline check failed')
    }

    expect(result.stdout).toMatch(/outline enabled:/)
    expect(result.stdout).toMatch(/outline disabled:/)
  })
})
