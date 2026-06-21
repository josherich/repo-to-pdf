const path = require('path')

function parsePathList(value) {
  if (!value) {
    return []
  }

  const entries = Array.isArray(value) ? value : String(value).split(',')
  return entries.map((entry) => String(entry).trim()).filter(Boolean)
}

function globPatternToRegex(glob) {
  let regex = ''
  let i = 0

  while (i < glob.length) {
    const char = glob[i]

    if (char === '*') {
      if (glob[i + 1] === '*') {
        regex += '.*'
        i += 2
        if (glob[i] === '/') {
          i++
        }
      } else {
        regex += '[^/]*'
        i++
      }
      continue
    }

    if (char === '?') {
      regex += '[^/]'
      i++
      continue
    }

    if (char === '[') {
      const end = glob.indexOf(']', i)
      if (end === -1) {
        regex += '\\['
        i++
        continue
      }

      regex += glob.slice(i, end + 1)
      i = end + 1
      continue
    }

    if ('\\^$+.|(){}'.includes(char)) {
      regex += '\\' + char
    } else {
      regex += char
    }
    i++
  }

  return regex
}

function globPatternToRegExp(glob) {
  if (glob.endsWith('/**')) {
    const prefix = glob.slice(0, -3)
    return new RegExp('^' + globPatternToRegex(prefix) + '(/.*)?$')
  }

  return new RegExp('^' + globPatternToRegex(glob) + '$')
}

function matchesGlobPattern(target, pattern) {
  return globPatternToRegExp(pattern).test(target)
}

function isPathExcluded(absolutePath, rootDir, patterns) {
  if (patterns.length === 0) {
    return false
  }

  const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/')
  const basename = path.basename(absolutePath)

  return patterns.some((pattern) => {
    if (matchesGlobPattern(relativePath, pattern) || matchesGlobPattern(basename, pattern)) {
      return true
    }

    if (pattern.startsWith('**/')) {
      const nestedPattern = pattern.slice(3)
      if (matchesGlobPattern(relativePath, nestedPattern) || matchesGlobPattern(basename, nestedPattern)) {
        return true
      }
    }

    if (!pattern.includes('/')) {
      return relativePath.split('/').some((segment) => matchesGlobPattern(segment, pattern))
    }

    return false
  })
}

function getSizeInByte(mb) {
  return mb * 0.8 * 1000 * 1000
}

// '../' => 'untitled'
// './'  => 'untitled'
// './path'  => 'path'
function getFileName(fpath) {
  const base = path.basename(fpath)
  return base[0] === '.' ? 'untitled' : base
}

function getCleanFilename(filename, folder, depth = 0) {
  filename = filename.replace(folder, '')
  if (folder === './') {
    depth -= 1
  }
  if (depth > 0) {
    return filename.split('/').slice(depth).join('/')
  } else {
    return filename
  }
}

// 'file.random_extension' => 'file.ext'
function getFileNameExt(fileName, ext = 'pdf') {
  return fileName.replace(/\.[0-9a-zA-Z]+$/, `.${ext}`)
}

module.exports = {
  getSizeInByte,
  getFileName,
  getCleanFilename,
  getFileNameExt,
  parsePathList,
  matchesGlobPattern,
  isPathExcluded,
}
