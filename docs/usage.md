# Usage

## Quick start

```bash
video-to-site intro.mp4
cd intro-site && npm run dev
```

## Full reference

```
video-to-site <video> [output-dir] [options]
```

| Option | Default | What it does |
|---|---|---|
| `--fps <n>` | source fps | Frame extraction rate. Higher = smoother scrub, more files. |
| `--width <n>` | 1920 | Upscale target width (only if source is smaller). |
| `--height <n>` | 1080 | Upscale target height. |
| `--name <name>` | output dir name | `name` field in the generated `package.json`. |
| `--quality <1-100>` | 95 | Frame JPEG quality. 90–95 is the sweet spot. |
| `--pm <bun\|npm>` | auto (bun first) | Package manager for install/build. |
| `--no-upscale` | off | Keep source resolution even when it's small. |
| `--no-install` | off | Skip `install` (scaffold + frames only). |
| `--no-build` | off | Skip the production build. |
| `-h, --help` | | Show help. |
| `-V, --version` | | Show version. |

## Examples

```bash
# Cinematic 30fps site from any clip
video-to-site reel.mp4 my-site --fps 30

# Lightweight draft while iterating on content
video-to-site reel.mp4 draft --fps 12 --quality 80 --no-build

# Portrait phone footage (keeps source res + aspect)
video-to-site clip.mov phone-site --no-upscale

# CI / scripting (no network needed for frames+scaffold)
video-to-site clip.mp4 out --no-install --no-build
```

## Pipeline stages

1. **Analyze** — resolution, fps, duration via `ffprobe`.
2. **Extract** — `ffmpeg` pulls frames at the target fps, upscaling with
   lanczos when the source is smaller, always in full-chroma `yuv444p`.
3. **Optimize** — PNGs become JPEGs (`quality` + 4:4:4 subsampling), PNGs deleted.
4. **Scaffold** — a complete Next.js 14 + Tailwind project with the
   scroll-driven canvas engine wired to your frame count.
5. **Install + build** — via bun or npm (skippable).

## Exit codes

`0` success, `1` any failure (missing file, missing dependency, ffmpeg error,
failed install/build). Errors print to stderr.
