# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] — 2026-09-06

First stable release — full Node.js rewrite of the original bash script.

### Added
- Node.js CLI: analyze → extract → optimize → scaffold → install → build
- Auto frame-rate detection (uses source fps unless `--fps` is passed)
- Lanczos upscaling with aspect-ratio guard + `--no-upscale`
- 4:4:4 chroma pipeline (no subsampling artifacts)
- Live ffmpeg progress bars, colored step output
- `--quality`, `--pm`, `--name`, `--no-install`, `--no-build` flags
- `install.sh` one-line curl installer
- Agent skills: `video-to-site` and `customize-site`
- Docs: usage, how-it-works, customizing
- Vitest suite (unit + end-to-end on synthetic video) and GitHub Actions CI
