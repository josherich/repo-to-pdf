const zlib = require('zlib')

const { FONT_NAMES, FONT_KEYS, encodePdfString } = require('./fonts')

// Minimal PDF writer. Produces a single-file PDF with the base-14 fonts,
// FlateDecode-compressed content streams and an optional document outline
// (bookmarks). No external dependencies are used.
class PDFDocument {
  constructor({ width = 612, height = 792 } = {}) {
    this.width = width
    this.height = height
    this.objects = [] // index 0 => object id 1
    this.pages = [] // { pageId, contentId }

    this.fontIds = {}
    this._createFonts()
    this._resourcesId = this._alloc()
  }

  _alloc() {
    this.objects.push(null)
    return this.objects.length
  }

  _set(id, body) {
    this.objects[id - 1] = Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1')
  }

  _createFonts() {
    for (const key of Object.keys(FONT_NAMES)) {
      const id = this._alloc()
      this.fontIds[key] = id
      this._set(id, `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[key]} /Encoding /WinAnsiEncoding >>`)
    }
  }

  _resourcesBody() {
    const fontEntries = Object.keys(FONT_KEYS)
      .map((key) => `/${FONT_KEYS[key]} ${this.fontIds[key]} 0 R`)
      .join(' ')
    return `<< /Font << ${fontEntries} >> >>`
  }

  // Add a page whose content stream is the given (uncompressed) string.
  addPage(content) {
    const pageId = this._alloc()
    const contentId = this._alloc()

    const raw = Buffer.from(content, 'latin1')
    const compressed = zlib.deflateSync(raw, { level: 9 })
    const stream = Buffer.concat([Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), compressed, Buffer.from('\nendstream', 'latin1')])
    this._set(contentId, stream)

    this.pages.push({ pageId, contentId })
    return pageId
  }

  // outline: tree of { title, pageIndex, y, children }
  build(outline) {
    const pagesId = this._alloc()

    this.pages.forEach(({ pageId, contentId }) => {
      this._set(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` + `/Resources ${this._resourcesId} 0 R /Contents ${contentId} 0 R >>`)
    })

    this._set(this._resourcesId, this._resourcesBody())

    const kids = this.pages.map(({ pageId }) => `${pageId} 0 R`).join(' ')
    this._set(pagesId, `<< /Type /Pages /Count ${this.pages.length} /Kids [${kids}] >>`)

    let outlineId = null
    if (outline && outline.length > 0) {
      outlineId = this._buildOutline(outline)
    }

    const catalogId = this._alloc()
    let catalog = `<< /Type /Catalog /Pages ${pagesId} 0 R`
    if (outlineId) {
      catalog += ` /Outlines ${outlineId} 0 R /PageMode /UseOutlines`
    }
    catalog += ' >>'
    this._set(catalogId, catalog)

    return this._serialize(catalogId)
  }

  _buildOutline(tree) {
    const outlineId = this._alloc()

    // Pre-allocate an id for every node so siblings/parents can reference it.
    const assignIds = (nodes) => {
      nodes.forEach((node) => {
        node._id = this._alloc()
        if (node.children && node.children.length) {
          assignIds(node.children)
        }
      })
    }
    assignIds(tree)

    let totalVisible = 0

    const writeNodes = (nodes, parentId) => {
      let descendants = 0
      nodes.forEach((node, index) => {
        const pageId = this.pages[node.pageIndex] ? this.pages[node.pageIndex].pageId : this.pages[0].pageId
        const prev = index > 0 ? `${nodes[index - 1]._id} 0 R` : null
        const next = index < nodes.length - 1 ? `${nodes[index + 1]._id} 0 R` : null

        let dict = `<< /Title (${encodePdfString(node.title).toString('latin1')}) /Parent ${parentId} 0 R`
        if (prev) {
          dict += ` /Prev ${prev}`
        }
        if (next) {
          dict += ` /Next ${next}`
        }

        let childCount = 0
        if (node.children && node.children.length) {
          childCount = writeNodes(node.children, node._id)
          dict += ` /First ${node.children[0]._id} 0 R /Last ${node.children[node.children.length - 1]._id} 0 R /Count ${childCount}`
        }

        const y = Math.round(node.y * 100) / 100
        dict += ` /Dest [${pageId} 0 R /XYZ 0 ${y} null] >>`
        this._set(node._id, dict)

        descendants += 1 + childCount
      })
      return descendants
    }

    totalVisible = writeNodes(tree, outlineId)

    this._set(outlineId, `<< /Type /Outlines /First ${tree[0]._id} 0 R /Last ${tree[tree.length - 1]._id} 0 R /Count ${totalVisible} >>`)

    return outlineId
  }

  _serialize(catalogId) {
    const header = Buffer.from('%PDF-1.4\n%\xff\xff\xff\xff\n', 'latin1')
    const chunks = [header]
    const offsets = new Array(this.objects.length + 1).fill(0)
    let position = header.length

    for (let i = 0; i < this.objects.length; i++) {
      const id = i + 1
      const body = this.objects[i] || Buffer.from('<< >>', 'latin1')
      offsets[id] = position
      const prefix = Buffer.from(`${id} 0 obj\n`, 'latin1')
      const suffix = Buffer.from('\nendobj\n', 'latin1')
      const objBuf = Buffer.concat([prefix, body, suffix])
      chunks.push(objBuf)
      position += objBuf.length
    }

    const xrefOffset = position
    const count = this.objects.length + 1
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`
    for (let id = 1; id < count; id++) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
    }
    xref += `trailer\n<< /Size ${count} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    chunks.push(Buffer.from(xref, 'latin1'))

    return Buffer.concat(chunks)
  }
}

module.exports = PDFDocument
