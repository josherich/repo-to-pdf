// Standard PDF (base-14) font metrics and WinAnsi text encoding.
//
// Using the built-in fonts keeps generated PDFs tiny because the glyph
// programs never have to be embedded. The trade-off is that only characters
// available in WinAnsiEncoding can be rendered; anything outside that range is
// substituted with a placeholder so the byte stream stays valid.

// AFM advance widths (per 1000 em) for the ASCII range 32..126.
// prettier-ignore
const HELVETICA = {
  32:278, 33:278, 34:355, 35:556, 36:556, 37:889, 38:667, 39:191, 40:333, 41:333, 42:389, 43:584, 44:278, 45:333, 46:278, 47:278,
  48:556, 49:556, 50:556, 51:556, 52:556, 53:556, 54:556, 55:556, 56:556, 57:556,
  58:278, 59:278, 60:584, 61:584, 62:584, 63:556, 64:1015,
  65:667, 66:667, 67:722, 68:722, 69:667, 70:611, 71:778, 72:722, 73:278, 74:500, 75:667, 76:556, 77:833, 78:722, 79:778, 80:667, 81:778, 82:722, 83:667, 84:611, 85:722, 86:667, 87:944, 88:667, 89:667, 90:611,
  91:278, 92:278, 93:278, 94:469, 95:556, 96:333,
  97:556, 98:556, 99:500, 100:556, 101:556, 102:278, 103:556, 104:556, 105:222, 106:222, 107:500, 108:222, 109:833, 110:556, 111:556, 112:556, 113:556, 114:333, 115:500, 116:278, 117:556, 118:500, 119:722, 120:500, 121:500, 122:500,
  123:334, 124:260, 125:334, 126:584,
}

// prettier-ignore
const HELVETICA_BOLD = {
  32:278, 33:333, 34:474, 35:556, 36:556, 37:889, 38:722, 39:238, 40:333, 41:333, 42:389, 43:584, 44:278, 45:333, 46:278, 47:278,
  48:556, 49:556, 50:556, 51:556, 52:556, 53:556, 54:556, 55:556, 56:556, 57:556,
  58:333, 59:333, 60:584, 61:584, 62:584, 63:611, 64:975,
  65:722, 66:722, 67:722, 68:722, 69:667, 70:611, 71:778, 72:722, 73:278, 74:556, 75:722, 76:611, 77:833, 78:722, 79:778, 80:667, 81:778, 82:722, 83:667, 84:611, 85:722, 86:667, 87:944, 88:667, 89:667, 90:611,
  91:333, 92:278, 93:333, 94:584, 95:556, 96:333,
  97:556, 98:611, 99:556, 100:611, 101:556, 102:333, 103:611, 104:611, 105:278, 106:278, 107:556, 108:278, 109:889, 110:611, 111:611, 112:611, 113:611, 114:389, 115:556, 116:333, 117:611, 118:556, 119:778, 120:556, 121:556, 122:500,
  123:389, 124:280, 125:389, 126:584,
}

const DEFAULT_LATIN_WIDTH = 556
const DEFAULT_BOLD_LATIN_WIDTH = 611
const COURIER_WIDTH = 600

// PDF standard font resource names. The fourth combination (bold + italic) is
// included so emphasised prose keeps the correct weight.
const FONT_NAMES = {
  body: 'Helvetica',
  bodyBold: 'Helvetica-Bold',
  bodyItalic: 'Helvetica-Oblique',
  bodyBoldItalic: 'Helvetica-BoldOblique',
  mono: 'Courier',
  monoBold: 'Courier-Bold',
  monoItalic: 'Courier-Oblique',
}

// Resource identifiers used inside page /Font dictionaries.
const FONT_KEYS = {
  body: 'F1',
  bodyBold: 'F2',
  bodyItalic: 'F3',
  bodyBoldItalic: 'F4',
  mono: 'F5',
  monoBold: 'F6',
  monoItalic: 'F7',
}

// Map a Unicode code point onto its WinAnsiEncoding byte. Only the printable
// subset is handled; unsupported characters fall back to '?'.
const QUESTION_MARK = 0x3f

// A handful of common Windows-1252 punctuation glyphs that live in 0x80..0x9F.
const CP1252_EXTRAS = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85, // …
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c, // Œ
  0x017d: 0x8e,
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98,
  0x2122: 0x99, // ™
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c, // œ
  0x017e: 0x9e,
  0x0178: 0x9f,
}

function toWinAnsiByte(codePoint) {
  if (codePoint === 0x09) {
    return 0x20 // tabs are expanded before encoding, treat stragglers as space
  }
  if (codePoint >= 0x20 && codePoint <= 0x7e) {
    return codePoint
  }
  if (codePoint >= 0xa0 && codePoint <= 0xff) {
    return codePoint
  }
  if (Object.prototype.hasOwnProperty.call(CP1252_EXTRAS, codePoint)) {
    return CP1252_EXTRAS[codePoint]
  }
  return QUESTION_MARK
}

// Encode a JS string into a WinAnsi byte buffer, escaping PDF string syntax.
function encodePdfString(str) {
  const bytes = []
  for (const ch of str) {
    const byte = toWinAnsiByte(ch.codePointAt(0))
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      bytes.push(0x5c) // backslash escape for ( ) \
    }
    bytes.push(byte)
  }
  return Buffer.from(bytes)
}

function widthTableFor(fontKey) {
  switch (fontKey) {
    case 'bodyBold':
    case 'bodyBoldItalic':
      return { table: HELVETICA_BOLD, fallback: DEFAULT_BOLD_LATIN_WIDTH, mono: false }
    case 'body':
    case 'bodyItalic':
      return { table: HELVETICA, fallback: DEFAULT_LATIN_WIDTH, mono: false }
    default:
      return { table: null, fallback: COURIER_WIDTH, mono: true }
  }
}

// Width of a single character (in points) for the given font key and size.
function charWidth(ch, fontKey, fontSize) {
  const { table, fallback, mono } = widthTableFor(fontKey)
  if (mono) {
    return (COURIER_WIDTH / 1000) * fontSize
  }
  const code = toWinAnsiByte(ch.codePointAt(0))
  const units = (table && table[code]) || fallback
  return (units / 1000) * fontSize
}

// Width of a string (in points) for the given font key and size.
function measureText(str, fontKey, fontSize) {
  let total = 0
  for (const ch of str) {
    total += charWidth(ch, fontKey, fontSize)
  }
  return total
}

module.exports = {
  FONT_NAMES,
  FONT_KEYS,
  toWinAnsiByte,
  encodePdfString,
  charWidth,
  measureText,
}
