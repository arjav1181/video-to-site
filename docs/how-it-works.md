# How it works

## The core trick

A `<video>` element can't be scrubbed smoothly by scroll position — seeking is
janky and mobile browsers gate playback. So instead of a video, the site ships
**one JPEG per frame** and draws the current frame onto a full-viewport
`<canvas>` with `drawImage` in cover-fit mode.

Scroll position → target frame → a `requestAnimationFrame` loop lerps toward it
(`ease ≈ 0.18`, tuned for 30fps footage), redrawing only when the rounded frame
index changes. The result feels like the video is glued to your scrollbar.

## Why the frames look clean

Most video-to-frames pipelines inherit **4:2:0 chroma subsampling** (color at
quarter resolution) from the source video — visible as blocky gradients on
paint, skies, and skin. This CLI forces `format=yuv444p` during extraction and
writes JPEGs with `chromaSubsampling: "4:4:4"`, keeping full-resolution color
from source pixels to screen pixels.

## Performance design (mobile-first)

- **Adaptive DPR**: `getOptimalDPR()` caps device-pixel-ratio by RAM, CPU
  cores, and Data Saver — a 3GB Android phone renders at DPR 1, a desktop at
  up to 1.5.
- **Prioritized preloading**: 8 concurrent loads, first 20 frames
  `fetchPriority: high`, `decoding: async` everywhere. First paint happens as
  soon as frame 0 lands.
- **Fallback rendering**: if the exact frame isn't decoded yet, the loop draws
  the nearest decoded frame below it — never a black flash.
- **Throttled UI**: progress bar + frame counter update at most every ~48ms,
  outside the draw path.

## Generated project map

- `src/app/page.tsx` — canvas engine + sections. Frame count is baked in as
  `FRAME_COUNT`; `getFrameSrc` expects `public/frames/frame-%04d.jpg`.
- `src/app/layout.tsx` — Space Grotesk + JetBrains Mono via `next/font`.
- `src/app/globals.css` — reveal-on-scroll system, buttons, cards.
- `next.config.js` / `tailwind.config.js` / `postcss.config.js` — plain
  CommonJS configs for maximum host compatibility (Vercel included).
