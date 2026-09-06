---
name: video-to-site
description: Turn any video into a scroll-driven Next.js portfolio site with the video-to-site CLI. Use when the user wants a video background that scrubs with scroll, a scroll-driven frame animation site, or asks to scaffold a site from a video file.
---

# video-to-site

Scaffold a complete Next.js + Tailwind site whose background is a video that plays
through frame-by-frame as the visitor scrolls. The CLI handles everything:
video analysis, optional upscaling, frame extraction, 4:4:4 chroma optimization,
project scaffolding, dependency install, and production build.

## Prerequisites

- `video-to-site` installed (`npm i -g video-to-site`, or `curl -fsSL
  https://raw.githubusercontent.com/arjav1181/video-to-site/main/install.sh | bash`)
- `ffmpeg` + `ffprobe` on PATH
- `bun` or `npm` for the generated project's install/build steps

If the CLI is missing, install it first — do not reimplement the pipeline by hand.

## Usage

```bash
# Basic: output goes to ./<video-name>-site
video-to-site intro.mp4

# Explicit output dir + frame rate
video-to-site intro.mp4 my-site --fps 30

# Skip slow steps while iterating
video-to-site intro.mp4 my-site --no-install --no-build
```

Key flags: `--fps <n>` (default: source fps), `--width/--height` (upscale
target, default 1920x1080), `--no-upscale`, `--quality <1-100>` (default 95),
`--pm <bun|npm>`, `--name <pkg-name>`, `--no-install`, `--no-build`.

## What you get

```
my-site/
  public/frames/frame-0001.jpg …   # extracted + optimized frames
  src/app/page.tsx                 # canvas engine + hero + placeholder section
  src/app/layout.tsx               # fonts (Space Grotesk + JetBrains Mono)
  src/app/globals.css              # reveal animations, buttons
  package.json / next.config.js / tailwind.config.js / …
```

## After scaffolding

- Run it: `cd my-site && <pm> run dev`
- Add content by editing `src/app/page.tsx` — see the `customize-site` skill.
- Frames are the heavy asset (~80MB for 300 frames at 1080p). Keep them in
  `public/frames/` with the `frame-%04d.jpg` naming the component expects.
- If quality looks off, the cause is almost always chroma subsampling in the
  source pipeline — the CLI already extracts at 4:4:4, so don't downscale
  frames with tools that default to 4:2:0.

## Troubleshooting

- `ffmpeg exited with code N` — check the input plays (`ffprobe <file>`) and
  disk space (frames need ~100-300KB each).
- Aspect mismatch warning — source isn't 16:9; the CLI keeps source
  resolution instead of stretching. Pass explicit `--width/--height` only for
  16:9-ish sources.
- `Neither bun nor npm found` — install one; or pass `--no-install --no-build`
  and handle deps manually.
