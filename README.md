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

### All options

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

-r, --renderer [node|calibre]
use either node(relaxedjs) or calibre to render ebook, node outputs pdf, calibre outputs pdf, mobi, epub
# npx repo-to-pdf ../repo -r calibre

-f, --format [pdf|mobi|epub]
output format, either pdf, mobi, epub. mobi and epub are generated using calibre ebook-convert
# npx repo-to-pdf ../repo -f mobi

-c, --calibre [path]
path to ebook-convert, for MacOS, try /Applications/calibre.app/Contents/MacOS/ebook-convert; for linux, try /usr/bin/ebook-convert
```

##### For tablet, mobile

```bash
npx repo-to-pdf [src/folder] --device tablet
npx repo-to-pdf [src/folder] --device mobile
```
