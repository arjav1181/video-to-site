> **Moved into [SiteForge](https://github.com/arjav1181/siteforge) — this repo is archived.**
>
> `video-to-site` lives on as `siteforge video`, alongside sections, FX, 3D
> scenes, a demo recorder, site audit, and more. Install the toolkit:
>
> ```bash
> npm i -g @aj1181/site-forge
> ```
>
> Then run `siteforge video intro.mp4 my-site`. The old standalone `video-to-site`
> package was never published to npm, so there is nothing to install from here —
> use SiteForge instead.

# video-to-site

[![CI](https://github.com/arjav1181/video-to-site/actions/workflows/ci.yml/badge.svg)](https://github.com/arjav1181/video-to-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Archived](https://img.shields.io/badge/status-archived-lightgrey)](https://github.com/arjav1181/siteforge)

Turn **any video** into a **scroll-driven Next.js portfolio site** — the video
plays frame-by-frame as you scroll. One command does everything: analyze,
upscale, extract frames, optimize, scaffold, install, build.

<video src="assets/demo.mp4" width="100%" autoplay muted loop playsinline></video>

## Contents

- [Install](#install)
- [Usage](#usage)
- [What you get](#what-you-get)
- [Why it looks clean](#why-it-looks-clean)
- [For AI agents](#for-ai-agents)
- [Contributing](#contributing)
- [License](#license)

## Install

Install the toolkit that contains this command:

```bash
npm i -g @aj1181/site-forge
siteforge video intro.mp4 my-site
```

To run this repository's own CLI from source instead:

```bash
git clone https://github.com/arjav1181/video-to-site.git
cd video-to-site
npm install && npm run build
node dist/cli.js intro.mp4
```

Requirements: **Node.js 18+**, **ffmpeg + ffprobe**, and **bun or npm**.

## Usage

```bash
video-to-site intro.mp4
cd intro-site && npm run dev
```

```bash
video-to-site reel.mp4 my-site --fps 30        # cinematic 30fps
video-to-site clip.mp4 draft --no-build        # scaffold only, iterate fast
video-to-site clip.mov phone --no-upscale      # keep source resolution
```

Full flag reference: [`docs/usage.md`](docs/usage.md).

## What you get

```
my-site/
├── public/frames/frame-0001.jpg …   # extracted + optimized frames
├── src/app/page.tsx                 # scroll-driven canvas engine + sections
├── src/app/layout.tsx               # fonts + metadata
└── package.json / next.config.js / tailwind.config.js / …
```

Open `src/app/page.tsx`, replace the placeholder content, deploy to Vercel.
Customization guide: [`docs/customizing.md`](docs/customizing.md).
How the engine works: [`docs/how-it-works.md`](docs/how-it-works.md).

## Why it looks clean

Most frame-extraction pipelines inherit **4:2:0 chroma subsampling** (color at
quarter resolution) — blocky gradients everywhere. This CLI extracts in
**4:4:4 full-chroma** end to end, upscales small sources with lanczos, and the
generated site adapts canvas resolution to the visitor's device (DPR capped by
RAM/CPU/Data Saver) with prioritized preloading. Clean on a 3GB Android phone,
crisp on desktop.

## For AI agents

Drop-in skills live in [`skills/`](skills/):

- **`video-to-site`** — when to reach for the CLI, flags, output map, troubleshooting
- **`customize-site`** — editing generated sites without breaking the engine

Compatible with Claude Code, Cursor, OpenCode, and Copilot.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Quick version: `npm install`,
`npm run dev`, `npm test`. Keep runtime deps near zero, cover helpers with
tests, update the changelog.

## License

MIT © 2026 Arjav — see [LICENSE](LICENSE).
