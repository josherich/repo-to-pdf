# repo-to-pdf

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
