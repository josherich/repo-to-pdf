# Changelog

## v0.1.10(2026-06-14)
- add integration tests for PDF outline/bookmarks (#27)
- enable wkhtmltopdf outline generation
- regenerate sample.pdf with bookmarks

## v0.1.9(2026-02-22)
- upgrade puppeteer to get outline; add concurrency to puppeteer (#28)
- enable local file for wkhtmltopdf (#22)
- bump ci deps

## v0.1.8(2023-08-01)
- fix whitelist filtering
- replace relaxedjs with raw puppeteer
- add a pdf renderer wkhtmltopdf, faster but has split lines issue