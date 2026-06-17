const fs = require('fs')
const os = require('os')
const path = require('path')

const { openFontFile, glyphForCodePoint, advanceWidth, collectGlyphs, subsetFont } = require('./ttf')
const { toWinAnsiByte, charWidth: winAnsiCharWidth } = require('./fonts')

const BUNDLED_CJK_FONT = path.join(__dirname, '../../assets/fonts/CJKFallback.ttf')

function buildSubset(font, codePoints) {
  const glyphs = collectGlyphs(font, codePoints)
  const subset = subsetFont(font, glyphs)
  const widthsByCodePoint = new Map()
  for (const cp of codePoints) {
    const gid = glyphForCodePoint(font, cp)
    const idx = subset.glyphMap.get(gid)
    widthsByCodePoint.set(cp, subset.widths[idx] || 0)
  }
  subset.widthsByCodePoint = widthsByCodePoint
  return subset
}

// Unicode resource keys used alongside the base-14 fonts.
const UNICODE_FONT_KEYS = {
  body: 'UF1',
  bodyBold: 'UF2',
  bodyItalic: 'UF3',
  bodyBoldItalic: 'UF4',
  mono: 'UF5',
  monoBold: 'UF6',
  cjk: 'UF7',
}

const FONT_ROLE_PATHS = {
  body: ['sans', 'sansRegular', 'regular'],
  bodyBold: ['sansBold', 'bold'],
  bodyItalic: ['sansItalic', 'italic'],
  bodyBoldItalic: ['sansBoldItalic', 'boldItalic'],
  mono: ['mono', 'monoRegular'],
  monoBold: ['monoBold'],
}

const SYSTEM_FONT_CANDIDATES = {
  linux: {
    sans: [
      '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ],
    sansBold: [
      '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ],
    sansItalic: [
      '/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
    ],
    sansBoldItalic: [
      '/usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
    ],
    mono: [
      '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
      '/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    ],
    monoBold: [
      '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
    ],
    cjk: [
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    ],
  },
  darwin: {
    sans: [
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
    ],
    sansBold: [
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      '/Library/Fonts/Arial Bold.ttf',
    ],
    sansItalic: [
      '/System/Library/Fonts/Supplemental/Arial Italic.ttf',
      '/Library/Fonts/Arial Italic.ttf',
    ],
    sansBoldItalic: [
      '/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf',
      '/Library/Fonts/Arial Bold Italic.ttf',
    ],
    mono: [
      '/System/Library/Fonts/Menlo.ttc',
      '/System/Library/Fonts/Supplemental/Courier New.ttf',
    ],
    monoBold: ['/System/Library/Fonts/Menlo.ttc'],
    cjk: [
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
      '/System/Library/Fonts/STHeiti Medium.ttc',
      '/System/Library/Fonts/Supplemental/Songti.ttc',
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/Library/Fonts/Arial Unicode.ttf',
      '/System/Library/Fonts/PingFang.ttc',
    ],
  },
  win32: {
    sans: ['C:\\Windows\\Fonts\\arial.ttf'],
    sansBold: ['C:\\Windows\\Fonts\\arialbd.ttf'],
    sansItalic: ['C:\\Windows\\Fonts\\ariali.ttf'],
    sansBoldItalic: ['C:\\Windows\\Fonts\\arialbi.ttf'],
    mono: ['C:\\Windows\\Fonts\\consola.ttf', 'C:\\Windows\\Fonts\\cour.ttf'],
    monoBold: ['C:\\Windows\\Fonts\\consolab.ttf', 'C:\\Windows\\Fonts\\courbd.ttf'],
    cjk: ['C:\\Windows\\Fonts\\msyh.ttc', 'C:\\Windows\\Fonts\\simsun.ttc', 'C:\\Windows\\Fonts\\mingliu.ttc'],
  },
}

function firstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function discoverMacAssetFonts() {
  if (os.platform() !== 'darwin') {
    return []
  }
  const found = []
  const roots = [
    '/System/Library/AssetsV2/com_apple_MobileAsset_Font7',
    '/System/Library/AssetsV2/com_apple_MobileAsset_Font8',
  ]
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue
    }
    const stack = [root]
    while (stack.length > 0) {
      const dir = stack.pop()
      let entries = []
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch (err) {
        continue
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(full)
          continue
        }
        const lower = entry.name.toLowerCase()
        if (
          (lower.endsWith('.ttc') || lower.endsWith('.ttf') || lower.endsWith('.otf')) &&
          /pingfang|heiti|songti|hiragino|cjk|han|gothic|noto/i.test(entry.name)
        ) {
          found.push(full)
        }
      }
    }
  }
  return found
}

function resolveFontPaths(options = {}) {
  const platform = os.platform()
  const defaults = SYSTEM_FONT_CANDIDATES[platform] || SYSTEM_FONT_CANDIDATES.linux
  const userFonts = options.fonts || {}
  const resolved = {}

  for (const [role, keys] of Object.entries(FONT_ROLE_PATHS)) {
    const userPath = keys.map((k) => userFonts[k]).find(Boolean)
    resolved[role] = userPath || firstExisting(keys.flatMap((k) => defaults[k] || []))
  }

  const cjkCandidates = [
    userFonts.cjk,
    ...(defaults.cjk || []),
    ...discoverMacAssetFonts(),
    fs.existsSync(BUNDLED_CJK_FONT) ? BUNDLED_CJK_FONT : null,
  ].filter(Boolean)

  resolved.cjk = firstUsableCjkFont(cjkCandidates)
  return resolved
}

function firstUsableCjkFont(paths) {
  for (const candidate of paths) {
    try {
      const font = openFontFile(candidate)
      if (font.cmap.has(0x4f60)) {
        return candidate
      }
    } catch (err) {
      // try next candidate
    }
  }
  return null
}

function isCjkCodePoint(cp) {
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0xac00 && cp <= 0xd7af)
  )
}

function needsUnicodeFont(cp) {
  return toWinAnsiByte(cp) === 0x3f && cp !== 0x3f
}

function encodePdfHex(str) {
  const bytes = []
  for (const ch of str) {
    const cp = ch.codePointAt(0)
    if (cp <= 0xffff) {
      bytes.push((cp >> 8) & 0xff, cp & 0xff)
    } else {
      const high = Math.floor((cp - 0x10000) / 0x400) + 0xd800
      const low = ((cp - 0x10000) % 0x400) + 0xdc00
      bytes.push((high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff)
    }
  }
  return Buffer.from(bytes).toString('hex').toUpperCase()
}

class FontManager {
  constructor(options = {}) {
    this.paths = resolveFontPaths(options)
    this.fonts = new Map()
    this.usedCodePoints = new Map() // role -> Set
    this.enabled = false
    this.subsets = null
    this.cjkFont = null

    if (this.paths.cjk) {
      try {
        this.cjkFont = openFontFile(this.paths.cjk)
        this.enabled = true
      } catch (err) {
        this.cjkFont = null
      }
    }

    for (const role of Object.keys(FONT_ROLE_PATHS)) {
      const fontPath = this.paths[role]
      if (!fontPath) {
        continue
      }
      try {
        this.fonts.set(role, openFontFile(fontPath))
        this.enabled = true
      } catch (err) {
        // ignore missing role fonts
      }
    }
  }

  noteText(text, fontKey) {
    if (!this.enabled) {
      return
    }
    const role = this._roleFor(fontKey)
    if (!this.usedCodePoints.has(role)) {
      this.usedCodePoints.set(role, new Set())
    }
    const used = this.usedCodePoints.get(role)
    for (const ch of text) {
      const cp = ch.codePointAt(0)
      if (needsUnicodeFont(cp) || (this.cjkFont && isCjkCodePoint(cp))) {
        used.add(cp)
      }
    }
  }

  _roleFor(fontKey) {
    if (fontKey === 'mono' || fontKey === 'monoBold' || fontKey === 'monoItalic') {
      return fontKey === 'monoBold' ? 'monoBold' : 'mono'
    }
    return fontKey
  }

  _pickFont(role, cp) {
    if (this.cjkFont && isCjkCodePoint(cp)) {
      const gid = glyphForCodePoint(this.cjkFont, cp)
      if (gid !== 0) {
        return { role: 'cjk', font: this.cjkFont }
      }
    }
    const font = this.fonts.get(role)
    if (font) {
      const gid = glyphForCodePoint(font, cp)
      if (gid !== 0) {
        return { role, font }
      }
    }
  if (this.cjkFont) {
      return { role: 'cjk', font: this.cjkFont }
    }
    return null
  }

  measureText(str, fontKey, fontSize) {
    let total = 0
    for (const ch of str) {
      total += this.charWidth(ch, fontKey, fontSize)
    }
    return total
  }

  charWidth(ch, fontKey, fontSize) {
    const cp = ch.codePointAt(0)
    if (!needsUnicodeFont(cp) && !(this.cjkFont && isCjkCodePoint(cp))) {
      return winAnsiCharWidth(ch, fontKey, fontSize)
    }
    if (!this.enabled) {
      return winAnsiCharWidth('?', fontKey, fontSize)
    }
    const role = this._roleFor(fontKey)
    const picked = this._pickFont(role, cp)
    if (!picked) {
      return winAnsiCharWidth('?', fontKey, fontSize)
    }
    return advanceWidth(picked.font, glyphForCodePoint(picked.font, cp), fontSize)
  }

  usesUnicodeFont(text) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)
      if (needsUnicodeFont(cp) || (this.cjkFont && isCjkCodePoint(cp))) {
        return true
      }
    }
    return false
  }

  encodeText(text, fontKey) {
    if (!this.usesUnicodeFont(text)) {
      return { mode: 'winansi', value: null }
    }
    return { mode: 'unicode', fontKey: this._roleFor(fontKey), value: encodePdfHex(text) }
  }

  pdfFontKey(fontKey, text) {
    if (!this.usesUnicodeFont(text)) {
      return null
    }
    for (const ch of text) {
      const cp = ch.codePointAt(0)
      if (this.cjkFont && isCjkCodePoint(cp)) {
        return UNICODE_FONT_KEYS.cjk
      }
    }
    return UNICODE_FONT_KEYS[this._roleFor(fontKey)] || UNICODE_FONT_KEYS.body
  }

  finalize(doc) {
    if (!this.enabled) {
      return
    }

    this.subsets = new Map()
    const cjkPoints = new Set()
    for (const used of this.usedCodePoints.values()) {
      for (const cp of used) {
        if (isCjkCodePoint(cp)) {
          cjkPoints.add(cp)
        }
      }
    }

    if (this.cjkFont && cjkPoints.size > 0) {
      const subset = buildSubset(this.cjkFont, cjkPoints)
      doc.registerType0Font('cjk', subset, UNICODE_FONT_KEYS.cjk, [...cjkPoints])
      this.subsets.set('cjk', subset)
    }

    for (const [role, used] of this.usedCodePoints) {
      if (role === 'cjk' || used.size === 0) {
        continue
      }
      const font = this.fonts.get(role)
      if (!font) {
        continue
      }
      const latinOnly = new Set([...used].filter((cp) => !isCjkCodePoint(cp)))
      if (latinOnly.size === 0) {
        continue
      }
      const subset = buildSubset(font, latinOnly)
      const key = UNICODE_FONT_KEYS[role]
      doc.registerType0Font(role, subset, key, [...latinOnly])
      this.subsets.set(role, subset)
    }
  }
}

let sharedManager = null

function getFontManager(options) {
  if (!sharedManager) {
    sharedManager = new FontManager(options)
  }
  return sharedManager
}

function resetFontManager() {
  sharedManager = null
}

module.exports = {
  UNICODE_FONT_KEYS,
  FontManager,
  getFontManager,
  resetFontManager,
  isCjkCodePoint,
  needsUnicodeFont,
  encodePdfHex,
  resolveFontPaths,
  BUNDLED_CJK_FONT,
}
