const { matchesGlobPattern, isPathExcluded } = require('../src/utils')

describe('glob pattern helpers', () => {
  it('matches standard Unix glob patterns', () => {
    expect(matchesGlobPattern('app.js', '*.js')).toBe(true)
    expect(matchesGlobPattern('src/app.js', '*.js')).toBe(false)
    expect(matchesGlobPattern('src/app.ts', '*.js')).toBe(false)
    expect(matchesGlobPattern('src/foo.test.js', '**/*.test.js')).toBe(true)
    expect(matchesGlobPattern('foo.test.js', '*.test.js')).toBe(true)
    expect(matchesGlobPattern('src/generated/output.js', 'src/generated/**')).toBe(true)
    expect(matchesGlobPattern('src/generated', 'src/generated/**')).toBe(true)
    expect(matchesGlobPattern('src/app.js', 'src/?pp.js')).toBe(true)
    expect(matchesGlobPattern('src/app.js', 'src/[ab]pp.js')).toBe(true)
  })

  it('excludes paths relative to the repo root', () => {
    const rootDir = '/repo'

    expect(isPathExcluded('/repo/src/app.test.js', rootDir, ['**/*.test.js'])).toBe(true)
    expect(isPathExcluded('/repo/app.test.js', rootDir, ['**/*.test.js'])).toBe(true)
    expect(isPathExcluded('/repo/src/app.js', rootDir, ['**/*.test.js'])).toBe(false)
    expect(isPathExcluded('/repo/docs/README.md', rootDir, ['docs/**'])).toBe(true)
    expect(isPathExcluded('/repo/src/app.js', rootDir, ['*.min.js'])).toBe(false)
    expect(isPathExcluded('/repo/dist/app.min.js', rootDir, ['*.min.js'])).toBe(true)
    expect(isPathExcluded('/repo/src/app.js', rootDir, ['*.js'])).toBe(true)
  })
})
