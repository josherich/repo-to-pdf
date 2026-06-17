// Minimal TrueType / TrueType Collection parser and subsetter.
// Enough to read cmap + metrics and emit a glyph subset for PDF embedding.

function readU16(buf, off) {
  return buf.readUInt16BE(off)
}

function readU32(buf, off) {
  return buf.readUInt32BE(off)
}

function readI16(buf, off) {
  return buf.readInt16BE(off)
}

function tag(buf, off) {
  return buf.toString('ascii', off, off + 4)
}

function parseTableDirectory(buf, base) {
  const numTables = readU16(buf, base + 4)
  const tables = new Map()
  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16
    const name = tag(buf, rec)
    const offset = readU32(buf, rec + 8)
    const length = readU32(buf, rec + 12)
    tables.set(name, { offset, length })
  }
  return tables
}

function parseCmap(buf, tables) {
  const { offset } = tables.get('cmap')
  const numSubtables = readU16(buf, offset + 2)
  let best = null
  let bestScore = -1

  for (let i = 0; i < numSubtables; i++) {
    const sub = offset + 4 + i * 8
    const platform = readU16(buf, sub)
    const encoding = readU16(buf, sub + 2)
    const subOffset = offset + readU32(buf, sub + 4)
    let score = 0
    if (platform === 3 && encoding === 10) {
      score = 100 // Windows full Unicode
    } else if (platform === 0 && encoding === 4) {
      score = 90 // Unicode full
    } else if (platform === 3 && encoding === 1) {
      score = 80 // Windows BMP
    } else if (platform === 0 && encoding === 3) {
      score = 70 // Unicode BMP
    } else if (platform === 1 && encoding === 0) {
      score = 10 // Mac Roman
    }
    if (score > bestScore) {
      bestScore = score
      best = subOffset
    }
  }

  if (!best) {
    return new Map()
  }

  const format = readU16(buf, best)
  if (format === 4) {
    return parseCmapFormat4(buf, best)
  }
  if (format === 12) {
    return parseCmapFormat12(buf, best)
  }
  return new Map()
}

function parseCmapFormat4(buf, off) {
  const segCount = readU16(buf, off + 6) / 2
  const endCodes = off + 14
  const startCodes = endCodes + segCount * 2 + 2
  const idDelta = startCodes + segCount * 2
  const idRangeOffset = idDelta + segCount * 2
  const glyphIndexArray = idRangeOffset + segCount * 2
  const map = new Map()

  for (let i = 0; i < segCount; i++) {
    const start = readU16(buf, startCodes + i * 2)
    const end = readU16(buf, endCodes + i * 2)
    const delta = readI16(buf, idDelta + i * 2)
    const rangeOffset = readU16(buf, idRangeOffset + i * 2)
    for (let cp = start; cp <= end; cp++) {
      let glyph
      if (rangeOffset === 0) {
        glyph = (cp + delta) & 0xffff
      } else {
        const idx = rangeOffset / 2 + (cp - start) + i - segCount
        glyph = readU16(buf, idRangeOffset + i * 2 + idx * 2)
        if (glyph !== 0) {
          glyph += delta
        }
      }
      map.set(cp, glyph & 0xffff)
    }
  }
  return map
}

function parseCmapFormat12(buf, off) {
  const numGroups = readU32(buf, off + 12)
  const map = new Map()
  for (let i = 0; i < numGroups; i++) {
    const base = off + 16 + i * 12
    const start = readU32(buf, base)
    const end = readU32(buf, base + 4)
    const startGlyph = readU32(buf, base + 8)
    for (let cp = start; cp <= end; cp++) {
      map.set(cp, startGlyph + (cp - start))
    }
  }
  return map
}

function parseHmtx(buf, tables, numGlyphs) {
  const { offset } = tables.get('hmtx')
  const hhea = tables.get('hhea')
  const numOfLongMetrics = readU16(buf, hhea.offset + 34)
  const widths = new Array(numGlyphs).fill(0)
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numOfLongMetrics) {
      widths[i] = readU16(buf, offset + i * 4)
    } else {
      widths[i] = readU16(buf, offset + (numOfLongMetrics - 1) * 4)
    }
  }
  return widths
}

function parseLoca(buf, tables, numGlyphs, indexToLocFormat) {
  const { offset } = tables.get('loca')
  const loca = []
  if (indexToLocFormat === 0) {
    for (let i = 0; i < numGlyphs; i++) {
      loca.push(readU16(buf, offset + i * 2) * 2)
    }
    loca.push(readU16(buf, offset + numGlyphs * 2) * 2)
  } else {
    for (let i = 0; i < numGlyphs; i++) {
      loca.push(readU32(buf, offset + i * 4))
    }
    loca.push(readU32(buf, offset + numGlyphs * 4))
  }
  return loca
}

function readFont(buf, base = 0) {
  const tables = parseTableDirectory(buf, base)
  const head = tables.get('head')
  const maxp = tables.get('maxp')
  const numGlyphs = readU16(buf, maxp.offset + 4)
  const unitsPerEm = readU16(buf, head.offset + 18)
  const indexToLocFormat = readI16(buf, head.offset + 50)
  const cmap = parseCmap(buf, tables)
  const widths = parseHmtx(buf, tables, numGlyphs)
  const loca = parseLoca(buf, tables, numGlyphs, indexToLocFormat)
  const post = tables.get('post')
  const italicAngle = post ? readI16(buf, post.offset + 4) / 16384 : 0
  const name = tables.get('name')
  let family = 'EmbeddedFont'
  if (name) {
    family = readNameRecord(buf, name.offset, 1) || readNameRecord(buf, name.offset, 4) || family
  }

  return {
    buffer: buf,
    base,
    tables,
    numGlyphs,
    unitsPerEm,
    indexToLocFormat,
    cmap,
    widths,
    loca,
    italicAngle,
    family,
  }
}

function readNameRecord(buf, offset, nameId) {
  const count = readU16(buf, offset + 2)
  const stringOffset = offset + readU16(buf, offset + 4)
  for (let i = 0; i < count; i++) {
    const rec = offset + 6 + i * 12
    if (readU16(buf, rec + 6) !== nameId) {
      continue
    }
    const length = readU16(buf, rec + 8)
    const off = stringOffset + readU16(buf, rec + 10)
    const encoding = readU16(buf, rec + 1)
    if (encoding === 1 || encoding === 0) {
      return buf.toString('utf16le', off, off + length).replace(/\0/g, '')
    }
    return buf.toString('ascii', off, off + length).replace(/\0/g, '')
  }
  return null
}

function openFontFile(filePath) {
  const buf = require('fs').readFileSync(filePath)
  if (tag(buf, 0) === 'ttcf') {
    const count = readU32(buf, 8)
    const offsets = []
    for (let i = 0; i < count; i++) {
      offsets.push(readU32(buf, 12 + i * 4))
    }
    return readFont(buf, offsets[0])
  }
  return readFont(buf, 0)
}

function glyphForCodePoint(font, cp) {
  if (font.cmap.has(cp)) {
    return font.cmap.get(cp)
  }
  return 0
}

function advanceWidth(font, glyphId, fontSize) {
  const units = font.widths[glyphId] || font.widths[0] || 0
  return (units / font.unitsPerEm) * fontSize
}

function collectGlyphs(font, codePoints) {
  const glyphs = new Set([0])
  for (const cp of codePoints) {
    glyphs.add(glyphForCodePoint(font, cp))
  }
  return [...glyphs].sort((a, b) => a - b)
}

function writeU16(arr, value) {
  arr.push((value >> 8) & 0xff, value & 0xff)
}

function writeU32(arr, value) {
  arr.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff)
}

function writeI16(arr, value) {
  writeU16(arr, value & 0xffff)
}

function pad4(len) {
  return (4 - (len % 4)) % 4
}

// Build a subset TTF containing only the requested glyph indices.
function subsetFont(font, glyphIds) {
  const sorted = [...new Set(glyphIds)].sort((a, b) => a - b)
  const map = new Map(sorted.map((gid, idx) => [gid, idx]))
  const numGlyphs = sorted.length
  const { buffer, tables, unitsPerEm, indexToLocFormat } = font

  const glyf = tables.get('glyf')
  const glyphData = []
  const newLoca = [0]
  let cursor = 0
  for (let i = 0; i < sorted.length; i++) {
    const gid = sorted[i]
    const start = font.loca[gid]
    const end = font.loca[gid + 1]
    const slice = buffer.slice(glyf.offset + start, glyf.offset + end)
    glyphData.push(slice)
    cursor += slice.length
    newLoca.push(cursor)
  }

  const glyfBytes = Buffer.concat(glyphData)
  const locaBytes = []
  if (indexToLocFormat === 0) {
    for (const off of newLoca) {
      writeU16(locaBytes, Math.floor(off / 2))
    }
  } else {
    for (const off of newLoca) {
      writeU32(locaBytes, off)
    }
  }

  const hhea = tables.get('hhea')
  const numOfLongMetrics = readU16(buffer, hhea.offset + 34)
  const hmtxBytes = []
  for (let i = 0; i < sorted.length; i++) {
    const gid = sorted[i]
    const src = gid < numOfLongMetrics ? gid : numOfLongMetrics - 1
    writeU16(hmtxBytes, font.widths[gid] || 0)
    writeI16(hmtxBytes, 0) // lsb placeholder
  }

  const cmapBytes = buildSubsetCmap(sorted, font.cmap, map)
  const maxpBytes = []
  writeU32(maxpBytes, 0x00010000)
  writeU16(maxpBytes, numGlyphs)

  const headBytes = Buffer.from(buffer.slice(tables.get('head').offset, tables.get('head').offset + 54))
  headBytes.writeUInt16BE(indexToLocFormat, 50)
  headBytes.writeUInt32BE(0, 8) // checksum reset
  headBytes.writeUInt32BE(0, 12) // created
  headBytes.writeUInt32BE(0, 16) // modified

  const hheaBytes = Buffer.from(buffer.slice(hhea.offset, hhea.offset + 36))
  hheaBytes.writeUInt16BE(numGlyphs, 34)

  const os2 = tables.get('OS/2')
  const os2Bytes = os2 ? Buffer.from(buffer.slice(os2.offset, os2.offset + os2.length)) : null
  const postBytes = []
  writeU32(postBytes, 0x00030000)
  writeI16(postBytes, Math.round(font.italicAngle * 16384))
  while (postBytes.length < 32) {
    postBytes.push(0)
  }

  const nameBytes = buildMinimalName(font.family)
  const tablePayloads = new Map([
    ['cmap', Buffer.from(cmapBytes)],
    ['glyf', glyfBytes],
    ['head', headBytes],
    ['hhea', hheaBytes],
    ['hmtx', Buffer.from(hmtxBytes)],
    ['loca', Buffer.from(locaBytes)],
    ['maxp', Buffer.from(maxpBytes)],
    ['name', Buffer.from(nameBytes)],
    ['post', postBytes],
  ])
  if (os2Bytes) {
    tablePayloads.set('OS/2', os2Bytes)
  }

  const tableOrder = ['cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post', 'OS/2'].filter((t) => tablePayloads.has(t))
  const numTables = tableOrder.length
  const headerSize = 12 + numTables * 16
  let tableOffset = headerSize
  const records = []
  for (const t of tableOrder) {
    const data = tablePayloads.get(t)
    const padded = data.length + pad4(data.length)
    records.push({ tag: t, offset: tableOffset, data, padded })
    tableOffset += padded
  }

  const out = []
  writeU32(out, 0x00010000)
  writeU16(out, numTables)
  writeU16(out, 128)
  writeU16(out, (Math.log2(numTables) | 0) + 1)
  writeU16(out, numTables * 16 - (1 << ((Math.log2(numTables) | 0) + 1)))
  writeU16(out, 0)

  let headTableOffset = 0
  for (const rec of records) {
    const tagStr = rec.tag.padEnd(4, ' ')
    for (let i = 0; i < 4; i++) {
      out.push(tagStr.charCodeAt(i))
    }
    writeU32(out, checksum(rec.data))
    writeU32(out, rec.offset)
    writeU32(out, rec.data.length)
    if (rec.tag === 'head') {
      headTableOffset = rec.offset
    }
  }

  for (const rec of records) {
    for (const b of rec.data) {
      out.push(b)
    }
    for (let i = 0; i < pad4(rec.data.length); i++) {
      out.push(0)
    }
  }

  const result = Buffer.from(out)
  const checksumAdjustment = (0xb1b0afba - fontChecksum(result)) >>> 0
  result.writeUInt32BE(checksumAdjustment, headTableOffset + 8)
  return { buffer: result, glyphMap: map, unitsPerEm, widths: sorted.map((gid) => font.widths[gid] || 0), family: font.family }
}

function readU32Safe(buf, off) {
  let value = 0
  for (let i = 0; i < 4; i++) {
    value = (value << 8) | (off + i < buf.length ? buf[off + i] : 0)
  }
  return value >>> 0
}

function checksum(buf) {
  let sum = 0
  const padded = buf.length + pad4(buf.length)
  for (let i = 0; i < padded; i += 4) {
    sum = (sum + readU32Safe(buf, i)) >>> 0
  }
  return sum >>> 0
}

function fontChecksum(buf) {
  let sum = 0
  const padded = buf.length + pad4(buf.length)
  for (let i = 0; i < padded; i += 4) {
    sum = (sum + readU32Safe(buf, i)) >>> 0
  }
  return sum >>> 0
}

function buildSubsetCmap(glyphIds, cmap, glyphMap) {
  const entries = []
  for (const [cp, gid] of cmap) {
    if (glyphMap.has(gid)) {
      entries.push([cp, glyphMap.get(gid)])
    }
  }
  entries.sort((a, b) => a[0] - b[0])

  const bytes = []
  writeU16(bytes, 0)
  writeU16(bytes, 1)
  writeU16(bytes, 3)
  writeU16(bytes, 10)
  writeU32(bytes, 20)

  if (entries.length === 0) {
    writeU16(bytes, 4)
    writeU16(bytes, 28)
    writeU16(bytes, 0)
    writeU16(bytes, 2)
    writeU16(bytes, 2)
    writeU16(bytes, 0)
    writeU16(bytes, 0xffff)
    writeI16(bytes, 1)
    writeU16(bytes, 0)
    writeU16(bytes, 0xffff)
    writeU16(bytes, 0)
    return bytes
  }

  // Use cmap format 12 for full Unicode coverage.
  const groups = []
  let groupStart = entries[0][0]
  let groupGlyph = entries[0][1]
  let groupEnd = entries[0][0]
  for (let i = 1; i < entries.length; i++) {
    const [cp, gid] = entries[i]
    if (cp === groupEnd + 1 && gid === groupGlyph + (cp - groupStart)) {
      groupEnd = cp
      continue
    }
    groups.push([groupStart, groupEnd, groupGlyph])
    groupStart = cp
    groupEnd = cp
    groupGlyph = gid
  }
  groups.push([groupStart, groupEnd, groupGlyph])

  const length = 16 + groups.length * 12
  writeU16(bytes, 12)
  writeU16(bytes, 0)
  writeU32(bytes, length)
  writeU32(bytes, 0)
  writeU32(bytes, groups.length)
  for (const [start, end, startGlyph] of groups) {
    writeU32(bytes, start)
    writeU32(bytes, end)
    writeU32(bytes, startGlyph)
  }
  return bytes
}

function toUtf16Be(text) {
  const bytes = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    bytes.push((cp >> 8) & 0xff, cp & 0xff)
  }
  return Buffer.from(bytes)
}

function buildMinimalName(family) {
  const strings = [
    { id: 1, text: family },
    { id: 4, text: family },
    { id: 6, text: family.replace(/\s+/g, '') },
  ]
  const stringData = []
  const records = []
  let strOff = 0
  for (const { id, text } of strings) {
    const bytes = toUtf16Be(text)
    records.push({ id, off: strOff, len: bytes.length })
    for (const b of bytes) {
      stringData.push(b)
    }
    strOff += bytes.length
  }
  const headerLen = 6 + records.length * 12
  const out = []
  writeU16(out, 0)
  writeU16(out, records.length)
  writeU16(out, headerLen)
  for (const rec of records) {
    writeU16(out, 3)
    writeU16(out, 1)
    writeU16(out, rec.id)
    writeU16(out, rec.len)
    writeU16(out, rec.off)
  }
  out.push(...stringData)
  return out
}

module.exports = {
  openFontFile,
  glyphForCodePoint,
  advanceWidth,
  collectGlyphs,
  subsetFont,
}
