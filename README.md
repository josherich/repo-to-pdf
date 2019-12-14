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

-t, --title [name]
pdf filename

-w, --whitelist [wlist]
file format white list, split by ","

-s, --size [size]
pdf file size limit, in MB
```

For tablet, mobile

```bash
npx repo-to-pdf [src/folder] --device tablet
npx repo-to-pdf [src/folder] --device mobile
```

### Generate using Calibra

#### mobi
```bash
ebook-convert html_out/index.html my-project.mobi \
    --output-profile kindle_dx --no-inline-toc \
    --title "Your Book Title" --publisher 'Your Name' \
    --language en --authors 'Your Author Name'
```

#### epub
```bash
ebook-convert demo.html demo.epub \
    --output-profile ipad3 \
    --no-default-epub-cover \
    --title "Awesome Demo" --publisher 'Your Name' \
    --language en --authors 'Your Author Name'
```

#### pdf
```bash
ebook-convert demo.html demo.pdf \
  --pdf-page-numbers \
  --pdf-add-toc \
  --paper-size a4 \
  --pdf-default-font-size 12 \
  --pdf-mono-font-size 12 \
  --pdf-page-margin-left 2 --pdf-page-margin-right 2 \
  --pdf-page-margin-top 2 --pdf-page-margin-bottom 2 \
  --page-breaks-before='/'
```