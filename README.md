# repo-to-pdf

[![npm](https://img.shields.io/npm/v/repo-to-pdf.svg?label=&logo=npm)](https://www.npmjs.com/package/repo-to-pdf)
[![npm](https://img.shields.io/npm/dm/repo-to-pdf.svg?label=dl)](https://www.npmjs.com/package/repo-to-pdf)

Make pdf from source code

Here is a [sample](https://github.com/josherich/repo-to-pdf/blob/master/sample.pdf)

## Install

```bash
npm install repo-to-pdf
```

## Usage

### Basic

```bash
npx repo-to-pdf [src/folder]
```

```js
const {generateEbook} =  require('repo-to-pdf')

/**
 * @typedef Options
 * @type {object}
 * @property {string} renderer - [node|calibre|wkhtmltopdf] can be either node, calibre and wkhtmltopdf
 * @property {string} calibrePath - path of calibre's ebook-convert
 * @property {string} pdf_size - pdf size limit, in bytes
 * @property {string} white_list - list of file extensions to be included, separate by ','
 * @property {string} format - [mobi|epub|pdf] can be either mobi, epub, pdf
 * @property {string} device - [desktop|tablet|mobile] style can be opt for desktop, tablet and mobile
 * @property {string} baseUrl - base url of CSS style files
 * @property {boolean} outline - include PDF outline/bookmarks (default true)
 * @property {number} concurrency - max number of parallel Puppeteer PDF jobs (default auto)
 */

/**
 * Generate ebook from content folder with the given file format
 * @param {string} inputFolder - content folder
 * @param {string} outputFile - output file name
 * @param {string} title - title in ebook file
 * @param {Options} options
 */
generateEbook(
  './',
  'test.pdf',
  'repo-test',
  {renderer:'node', pdf_size: 3*0.8*1000*1000, format: 'pdf', device: 'desktop', outline: true}
)
```

### Command Line Options

```bash
-d, --device [platform]
device [desktop(default)|mobile|tablet]
# npx repo-to-pdf ../repo -d mobile

-t, --title [name]
pdf filename
# npx repo-to-pdf ../repo -t MeinKampf.pdf

-w, --whitelist [wlist]
file format white list, split by ","
# npx repo-to-pdf ../repo -w js,md

-s, --size [size]
pdf file size limit, in MB, default 10 MB
# npx repo-to-pdf ../repo -s 10

-r, --renderer [node|calibre|wkhtmltopdf]
use either node(relaxedjs) or calibre to render ebook, node outputs pdf, calibre outputs pdf, mobi, epub
# npx repo-to-pdf ../repo -r calibre

-f, --format [pdf|mobi|epub]
output format, either pdf, mobi, epub. mobi and epub are generated using calibre ebook-convert
# npx repo-to-pdf ../repo -f mobi

--no-outline
disable PDF outline/bookmarks generation (enabled by default)
# npx repo-to-pdf ../repo --no-outline

-p, --concurrency [num]
set max parallel Puppeteer PDF render jobs (auto uses up to 4 cores)
# npx repo-to-pdf ../repo -p 2

-c, --calibre [path]
path to ebook-convert, for MacOS, try /Applications/calibre.app/Contents/MacOS/ebook-convert; for linux, try /usr/bin/ebook-convert
```

##### For tablet, mobile
only supported by the renderer node
```bash
npx repo-to-pdf [src/folder] --device tablet
npx repo-to-pdf [src/folder] --device mobile
```

### Testing

```bash
npm run test
```

### Performance

```bash
cd test/data && wget https://github.com/redis/redis/archive/refs/tags/7.0.0.zip && unzip 7.0.0.zip
```

on M1 Macbook Air
```bash
time npx repo-to-pdf ./test/data/redis-7.0.0/src -s 3
2.09s user 0.36s system 2% cpu 1:42.14 total

time npx repo-to-pdf ./test/data/redis-7.0.0/src -s 3 -r wkhtmltopdf
43.78s user 0.84s system 93% cpu 47.787 total
```

### Known issues
- The renderer `wkhtmltopdf` can split lines. It's a known unsolved issue of `wkhtmltopdf`: https://github.com/wkhtmltopdf/wkhtmltopdf/issues/2141, https://github.com/wkhtmltopdf/wkhtmltopdf/issues/1524
- To properly install puppeteer on Debian, you might need to install required libs: https://github.com/puppeteer/puppeteer/issues/290#issuecomment-322921352 and `libgbm-dev`
