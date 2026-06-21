# Changelog

## v0.2.0(2026-06-17) - unreleased

- add `native` renderer: a dependency-free, highly efficient PDF generator that reads source code and writes PDF directly (no puppeteer/headless browser)
  - imitates the HTML/GitHub styling with `highlight.js` syntax highlighting
  - embeds a PDF outline (table of contents) and uses only built-in fonts to keep files small
  - available via `-r native`
- add `--footer-chapter-title` option to show chapter titles in the footer
- add `--footer-page-number` option to show page numbers in the footer

## v0.1.12(2026-06-16)

- fix markdown image display
- add Node.js version requirement

## v0.1.11(2026-06-15)

- enable local file access for calibre renderer
- fix source inclusion for highlight.js languages without aliases (#33)

## v0.1.10(2026-06-14)

- add integration tests for PDF outline/bookmarks (#27)
- enable wkhtmltopdf outline generation

## v0.1.9(2026-02-22)

- upgrade puppeteer to get outline; add concurrency to puppeteer (#28)
- enable local file for wkhtmltopdf (#22)
- bump ci deps

## v0.1.8(2023-08-01)

- fix whitelist filtering
- replace relaxedjs with raw puppeteer
- add a pdf renderer wkhtmltopdf, faster but has split lines issue
