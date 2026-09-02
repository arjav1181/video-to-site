#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════════════════════
# video-to-site.sh — Turn any video into a scroll-driven portfolio site
#
# Usage:
#   ./video-to-site.sh <video-file> [output-dir] [--fps 30] [--width 1920] [--height 1080]
#
# Dependencies: ffmpeg, ffprobe, node/bun
# ══════════════════════════════════════════════════════════════════════════════

VERSION="1.0.0"
TARGET_FPS=30
TARGET_W=1920
TARGET_H=1080
FRAMES_DIR="public/frames"
PROJECT_NAME="portfolio"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}▸${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
hr()   { echo -e "${DIM}────────────────────────────────────────────${NC}"; }

# ─── Parse args ───────────────────────────────────────────────────────────────
VIDEO=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fps)      TARGET_FPS="$2"; shift 2 ;;
    --width)    TARGET_W="$2"; shift 2 ;;
    --height)   TARGET_H="$2"; shift 2 ;;
    --name)     PROJECT_NAME="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 <video-file> [output-dir] [--fps 30] [--width 1920] [--height 1080] [--name project-name]"
      exit 0
      ;;
    *)
      if [[ -z "$VIDEO" ]]; then
        VIDEO="$1"
      elif [[ -z "$OUTPUT_DIR" ]]; then
        OUTPUT_DIR="$1"
      fi
      shift
      ;;
  esac
done

[[ -z "$VIDEO" ]] && err "No video file provided. Usage: $0 <video-file> [output-dir]"
[[ ! -f "$VIDEO" ]] && err "Video file not found: $VIDEO"

# Auto-name output dir if not provided
if [[ -z "$OUTPUT_DIR" ]]; then
  BASENAME=$(basename "$VIDEO" | sed 's/\.[^.]*$//')
  OUTPUT_DIR="./${BASENAME}-site"
fi

# ─── Check dependencies ───────────────────────────────────────────────────────
for cmd in ffmpeg ffprobe; do
  command -v "$cmd" &>/dev/null || err "Missing dependency: $cmd"
done
if command -v bun &>/dev/null; then
  PKG_MGR="bun"
elif command -v npm &>/dev/null; then
  PKG_MGR="npm"
else
  err "Need bun or npm for project setup"
fi

hr
echo -e "${BOLD}  video-to-site v${VERSION}${NC}"
hr
echo ""
log "Video:    ${BOLD}$VIDEO${NC}"
log "Output:   ${BOLD}$OUTPUT_DIR${NC}"
log "FPS:      $TARGET_FPS"
log "Target:   ${TARGET_W}x${TARGET_H}"
log "Pkg mgr:  $PKG_MGR"
echo ""

# ─── Step 1: Analyze video ────────────────────────────────────────────────────
log "Analyzing video..."

PROBE=$(ffprobe -v quiet -print_format json -show_streams -show_format "$VIDEO")

SRC_W=$(echo "$PROBE" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const v = d.streams.find(s => s.codec_type === 'video');
  console.log(v?.width || 0);
")
SRC_H=$(echo "$PROBE" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const v = d.streams.find(s => s.codec_type === 'video');
  console.log(v?.height || 0);
")
SRC_FPS=$(echo "$PROBE" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const v = d.streams.find(s => s.codec_type === 'video');
  const r = v?.r_frame_rate || '30/1';
  const [n, de] = r.split('/').map(Number);
  console.log(Math.round(n / de));
")
DURATION=$(echo "$PROBE" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log(parseFloat(d.format?.duration || 0));
")
TOTAL_FRAMES=$(echo "$PROBE" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const v = d.streams.find(s => s.codec_type === 'video');
  const nb = v?.nb_frames;
  if (nb && nb !== 'N/A') { console.log(nb); } else {
    const dur = parseFloat(d.format?.duration || 0);
    const fps = ${TARGET_FPS};
    console.log(Math.round(dur * fps));
  }
")

ok "Source: ${SRC_W}x${SRC_H} @ ${SRC_FPS}fps, ${DURATION}s, ~${TOTAL_FRAMES} frames"
echo ""

# ─── Step 2: Decide on upscaling ──────────────────────────────────────────────
NEED_UPSCALE=false
SCALE_FILTER=""

if [[ "$SRC_W" -lt "$TARGET_W" || "$SRC_H" -lt "$TARGET_H" ]]; then
  # Check if source is close to target aspect ratio
  SRC_RATIO=$(echo "scale=4; $SRC_W / $SRC_H" | bc 2>/dev/null || echo "1.7778")
  TGT_RATIO=$(echo "scale=4; $TARGET_W / $TARGET_H" | bc 2>/dev/null || echo "1.7778")
  RATIO_DIFF=$(echo "scale=4; ($SRC_RATIO - $TGT_RATIO)" | bc 2>/dev/null || echo "0")

  # Only upscale if aspect ratio is similar (within 15%)
  ABS_DIFF=$(echo "$RATIO_DIFF" | tr -d '-')
  IS_SIMILAR=$(echo "$ABS_DIFF < 0.25" | bc 2>/dev/null || echo "0")

  if [[ "$IS_SIMILAR" -eq 1 ]]; then
    NEED_UPSCALE=true
    log "Upscaling ${SRC_W}x${SRC_H} → ${TARGET_W}x${TARGET_H} (lanczos)"
    SCALE_FILTER="scale=${TARGET_W}:${TARGET_H}:flags=lanczos"
  else
    warn "Aspect ratio mismatch (${SRC_RATIO} vs ${TGT_RATIO}). Extracting at original resolution."
    TARGET_W=$SRC_W
    TARGET_H=$SRC_H
  fi
else
  log "Source is ${SRC_W}x${SRC_H} — extracting at original resolution (no downscale needed)"
  TARGET_W=$SRC_W
  TARGET_H=$SRC_H
fi
echo ""

# ─── Step 3: Create output directory ──────────────────────────────────────────
mkdir -p "$OUTPUT_DIR/$FRAMES_DIR"

# ─── Step 4: Extract frames ──────────────────────────────────────────────────
log "Extracting frames at ${TARGET_FPS}fps..."

# Build ffmpeg filter chain
VF_PARTS=()
VF_PARTS+=("fps=${TARGET_FPS}")
if [[ -n "$SCALE_FILTER" ]]; then
  VF_PARTS+=("$SCALE_FILTER")
fi
VF_PARTS+=("format=yuv444p")

VF_CHAIN=$(IFS=,; echo "${VF_PARTS[*]}")

ffmpeg -y -i "$VIDEO" \
  -vf "$VF_CHAIN" \
  -q:v 1 \
  "$OUTPUT_DIR/$FRAMES_DIR/frame-%04d.png" \
  -loglevel warning -stats 2>&1 | tail -1

EXTRACTED=$(ls "$OUTPUT_DIR/$FRAMES_DIR/"frame-*.png 2>/dev/null | wc -l)
ok "Extracted $EXTRACTED frames"
echo ""

# ─── Step 5: Optimize frames to high-quality JPG ─────────────────────────────
log "Optimizing frames (4:4:4 chroma, q95)..."

node -e "
const sharp = require('sharp');
const { readdir, unlink, stat } = require('fs/promises');
const { join } = require('path');
const DIR = join('${OUTPUT_DIR}', '${FRAMES_DIR}');
async function optimize() {
  const pngs = (await readdir(DIR)).filter(f => f.endsWith('.png')).sort();
  let done = 0;
  for (const file of pngs) {
    const src = join(DIR, file);
    const dst = src.replace('.png', '.jpg');
    await sharp(src).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(dst);
    await unlink(src);
    done++;
    if (done % 50 === 0 || done === pngs.length) process.stdout.write('  ' + done + '/' + pngs.length + '\r');
  }
  console.log('');
}
optimize().catch(e => { console.error(e); process.exit(1); });
" 2>&1

# Get final file sizes
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR/$FRAMES_DIR/" | cut -f1)
AVG_SIZE=$(node -e "
const { readdir, stat } = require('fs/promises');
const { join } = require('path');
async function avg() {
  const files = (await readdir('${OUTPUT_DIR}/${FRAMES_DIR}')).filter(f => f.endsWith('.jpg'));
  const sizes = await Promise.all(files.map(f => stat(join('${OUTPUT_DIR}/${FRAMES_DIR}', f)).then(s => s.size)));
  const avg = sizes.reduce((a,b) => a+b, 0) / sizes.length;
  console.log(Math.round(avg / 1024));
}
avg();
" 2>&1)

ok "Frames optimized: ${TOTAL_SIZE} total, ~${AVG_SIZE}KB avg per frame"
echo ""

# ─── Step 6: Generate Next.js project ─────────────────────────────────────────
log "Scaffolding Next.js project..."

FINAL_FRAME_COUNT=$EXTRACTED

# package.json
cat > "$OUTPUT_DIR/package.json" << 'PKGJSON'
{
  "name": "video-portfolio",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.35",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
PKGJSON

# tsconfig.json
cat > "$OUTPUT_DIR/tsconfig.json" << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSCONFIG

# next.config.js
cat > "$OUTPUT_DIR/next.config.js" << 'NEXTCFG'
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
NEXTCFG

# tailwind.config.ts
cat > "$OUTPUT_DIR/tailwind.config.ts" << 'TAILWIND'
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
TAILWIND

# postcss.config.js
cat > "$OUTPUT_DIR/postcss.config.js" << 'POSTCSS'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
POSTCSS

# Create directory structure
mkdir -p "$OUTPUT_DIR/src/app"

# src/app/layout.tsx
cat > "$OUTPUT_DIR/src/app/layout.tsx" << 'LAYOUT'
import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Video Portfolio",
  description: "Scroll-driven video frame animation portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
LAYOUT

# src/app/globals.css
cat > "$OUTPUT_DIR/src/app/globals.css" << 'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html {
  scroll-behavior: auto;
  scrollbar-width: thin;
  scrollbar-color: #222 #000;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #000; }
::-webkit-scrollbar-thumb { background: #222; border-radius: 999px; }

body {
  background: #000;
  color: #fff;
  overflow-x: hidden;
  font-family: var(--font-display), sans-serif;
}

canvas {
  display: block;
}

/* Scroll-triggered reveal */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger children */
.stagger > .reveal:nth-child(1) { transition-delay: 0ms; }
.stagger > .reveal:nth-child(2) { transition-delay: 80ms; }
.stagger > .reveal:nth-child(3) { transition-delay: 160ms; }
.stagger > .reveal:nth-child(4) { transition-delay: 240ms; }
.stagger > .reveal:nth-child(5) { transition-delay: 320ms; }
.stagger > .reveal:nth-child(6) { transition-delay: 400ms; }
.stagger > .reveal:nth-child(7) { transition-delay: 480ms; }
.stagger > .reveal:nth-child(8) { transition-delay: 560ms; }

/* Magnetic button */
.magnetic-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 28px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fff;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  max-width: 100%;
}
.magnetic-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.magnetic-btn:hover::before {
  transform: translateY(0);
}
.magnetic-btn:hover {
  color: #000;
  border-color: #fff;
}
.magnetic-btn span {
  position: relative;
  z-index: 1;
}
CSS

# ─── Step 7: Generate page.tsx ────────────────────────────────────────────────
log "Generating page component..."

node -e "
const fs = require('fs');
const FRAME_COUNT = ${FINAL_FRAME_COUNT};

const page = \`\"use client\";

import { useEffect, useRef, useState, useCallback } from \"react\";

const FRAME_COUNT = \${FRAME_COUNT};

function getOptimalDPR(): number {
  const raw = typeof window !== \"undefined\" ? window.devicePixelRatio || 1 : 1;
  const nav = typeof navigator !== \"undefined\" ? (navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number; connection?: { saveData?: boolean } }) : undefined;
  const mem = nav?.deviceMemory;
  const cores = nav?.hardwareConcurrency;
  const saveData = nav?.connection?.saveData;
  const isMobile = typeof window !== \"undefined\" ? window.innerWidth < 768 : false;
  if (saveData) return 1;
  if (mem && mem <= 4) return Math.min(raw, 1);
  if (cores && cores <= 4 && isMobile) return Math.min(raw, 1);
  if (isMobile) return Math.min(raw, 1.25);
  return Math.min(raw, 1.5);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(-1);
  const [showHint, setShowHint] = useState(true);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const getFrameSrc = useCallback(
    (index: number) => \\\`/frames/frame-\\\${String(index + 1).padStart(4, \"0\")}.jpg\\\`,
    []
  );

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext(\"2d\", { alpha: false, desynchronized: true, willReadFrequently: false } as unknown as CanvasRenderingContext2DSettings);
    }
    const ctx = ctxRef.current;
    const img = imagesRef.current[index];
    if (!ctx || !img || !img.complete || img.naturalWidth === 0) return;

    const dpr = getOptimalDPR();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const needW = Math.round(vw * dpr);
    const needH = Math.round(vh * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW; canvas.height = needH;
      canvas.style.width = \\\`\\\${vw}px\\\`; canvas.style.height = \\\`\\\${vh}px\\\`;
    }

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let dw: number, dh: number, dx: number, dy: number;
    if (canvasRatio > imgRatio) {
      dw = canvas.width; dh = canvas.width / imgRatio; dx = 0; dy = (canvas.height - dh) / 2;
    } else {
      dw = canvas.height * imgRatio; dh = canvas.height; dx = (canvas.width - dw) / 2; dy = 0;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = \"high\";
    try {
      if (dx !== 0 || dy !== 0) { ctx.fillStyle = \"#000\"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {}
  }, []);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = getOptimalDPR();
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = \\\`\\\${window.innerWidth}px\\\`;
    canvas.style.height = \\\`\\\${window.innerHeight}px\\\`;
    ctxRef.current = null;
    drawFrame(Math.round(currentFrameRef.current));
  }, [drawFrame]);

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = new Array(FRAME_COUNT);
    imagesRef.current = images;
    let loadedFirst = false;
    const onFirstLoad = () => { if (loadedFirst || cancelled) return; loadedFirst = true; requestAnimationFrame(() => drawFrame(0)); };

    const concurrency = 8;
    const queue: number[] = Array.from({ length: FRAME_COUNT }, (_, i) => i);
    let active = 0, idxPtr = 0;
    const loadNext = () => {
      if (cancelled) return;
      while (active < concurrency && idxPtr < queue.length) {
        const idx = queue[idxPtr++]; active++;
        const img = new window.Image();
        // @ts-ignore
        img.decoding = \"async\";
        if (idx < 20) (img as unknown as { fetchPriority?: string }).fetchPriority = \"high\";
        else (img as unknown as { fetchPriority?: string }).fetchPriority = \"low\";
        const done = () => { active--; if (idx === 0) onFirstLoad(); if (!cancelled && idxPtr < queue.length) loadNext(); };
        img.onload = done; img.onerror = done;
        img.src = getFrameSrc(idx); images[idx] = img;
      }
    };
    loadNext();

    const first = () => images[0];
    if (first()?.complete && first()?.naturalWidth !== 0) onFirstLoad();
    else {
      const check = setInterval(() => { if (first()?.complete && first()?.naturalWidth !== 0) { clearInterval(check); onFirstLoad(); } }, 30);
      setTimeout(() => clearInterval(check), 4000);
    }
    return () => { cancelled = true; };
  }, [drawFrame, getFrameSrc]);

  useEffect(() => {
    const onScroll = () => {
      if (showHint && window.scrollY > 40) setShowHint(false);
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      targetFrameRef.current = progress * (FRAME_COUNT - 1);
    };

    const ease = 0.18;
    let lastUiUpdate = 0;

    const animate = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;
      if (Math.abs(diff) > 0.0005) currentFrameRef.current = current + diff * ease;
      else currentFrameRef.current = target;

      const rounded = Math.round(currentFrameRef.current);
      if (rounded !== lastFrameRef.current) {
        lastFrameRef.current = rounded;
        if (imagesRef.current[rounded]?.complete && imagesRef.current[rounded]?.naturalWidth !== 0) drawFrame(rounded);
        else { let fb = rounded; while (fb > 0 && (!imagesRef.current[fb]?.complete || imagesRef.current[fb]?.naturalWidth === 0)) fb--; if (fb >= 0 && imagesRef.current[fb]?.complete) drawFrame(fb); }
      }

      const now = performance.now();
      if (now - lastUiUpdate > 48) {
        lastUiUpdate = now;
        const pct = ((rounded + 1) / FRAME_COUNT) * 100;
        if (progressRef.current) progressRef.current.style.width = \\\`\\\${pct}%\\\`;
        if (counterRef.current) counterRef.current.textContent = \\\`\\\${String(rounded + 1).padStart(3, \"0\")} / \\\${String(FRAME_COUNT).padStart(3, \"0\")}\\\`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener(\"scroll\", onScroll, { passive: true });
    window.addEventListener(\"resize\", handleResize, { passive: true });
    handleResize(); onScroll();
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener(\"scroll\", onScroll);
      window.removeEventListener(\"resize\", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame, handleResize, showHint]);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(\".reveal\");
    const obs = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add(\"visible\"); }); }, { threshold: 0.15, rootMargin: \"0px 0px -60px 0px\" });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className=\"relative\">
      <canvas
        ref={canvasRef}
        className=\"fixed inset-0 z-0\"
        style={{ width: \"100vw\", height: \"100vh\" }}
        aria-label=\"Scroll-driven frame animation\"
      />

      {/* Frame counter */}
      <div className=\"pointer-events-none fixed right-6 top-6 z-50 mix-blend-difference\">
        <span ref={counterRef} className=\"text-[11px] tracking-[0.15em] text-white/60\">001 / \${String(FRAME_COUNT).padStart(3, \"0\")}</span>
      </div>

      {/* Bottom progress */}
      <div className=\"fixed bottom-0 left-0 right-0 z-50 h-[2px] bg-white/10\">
        <div ref={progressRef} className=\"h-full bg-white\" style={{ width: \"0.33%\", willChange: \"width\" }} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ HERO */}
      <section className=\"relative z-10 flex h-screen flex-col items-center justify-center px-6\">
        <div className=\"relative text-center w-full max-w-4xl mx-auto\">
          <h1 className=\"font-extrabold leading-[0.88] tracking-[-0.04em] text-white\"
              style={{ fontSize: \"clamp(2.5rem, 10vw, 14rem)\" }}>
            YOUR NAME
          </h1>
          <p className=\"mt-6 text-[clamp(13px,1.5vw,18px)] text-white/50 max-w-md mx-auto leading-relaxed\">
            Your tagline goes here.
          </p>
          <a href=\"#work\" className=\"magnetic-btn mt-8\">
            <span>VIEW WORK</span>
            <span className=\"relative z-10\">
              <svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" className=\"transition-transform group-hover:translate-x-1\">
                <path d=\"M1 13L13 1M13 1H3M13 1V11\" stroke=\"currentColor\" strokeWidth=\"1.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>
              </svg>
            </span>
          </a>
        </div>

        {/* Scroll hint */}
        <div className={\\\`pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-700 \\\${showHint ? \"translate-y-0 opacity-100\" : \"translate-y-2 opacity-0\"}\\\`}>
          <div className=\"flex h-10 w-[1px] justify-center overflow-hidden bg-white/15\">
            <div className=\"h-6 w-full animate-[scrollHint_1.6s_ease-in-out_infinite] bg-white/60\" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ PLACEHOLDER SECTIONS */}
      {/*
        Add your sections here. The canvas plays underneath everything.
        Use className=\"relative z-10\" on each section.
        Use className=\"reveal\" on elements you want to animate in on scroll.
      */}
      <section className=\"relative z-10 h-screen flex items-center justify-center\">
        <p className=\"text-white/30 text-sm tracking-widest uppercase\">Add your sections here</p>
      </section>

      <noscript>
        <div className=\"fixed inset-0 z-[100] flex items-center justify-center bg-black p-8 text-center\">
          <p className=\"text-sm text-white/70\">Please enable JavaScript to view this site.</p>
        </div>
      </noscript>

      <style>{\\\`
        @keyframes scrollHint {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(250%); }
        }
      \\\`}</style>
    </div>
  );
}
\`;

fs.writeFileSync('${OUTPUT_DIR}/src/app/page.tsx', page);
console.log('Generated src/app/page.tsx');
" 2>&1
ok "Generated page.tsx"

echo ""

# ─── Step 8: Install dependencies ─────────────────────────────────────────────
log "Installing dependencies with $PKG_MGR..."
(cd "$OUTPUT_DIR" && $PKG_MGR install --no-frozen-lockfile 2>&1 | tail -3)
ok "Dependencies installed"
echo ""

# ─── Step 9: Build ────────────────────────────────────────────────────────────
log "Building project..."
(cd "$OUTPUT_DIR" && $PKG_MGR run build 2>&1 | grep -E "✓|○" | head -5)
ok "Build complete"
echo ""

# ─── Done ─────────────────────────────────────────────────────────────────────
hr
echo ""
echo -e "${GREEN}${BOLD}  Done! Your site is ready at: ${OUTPUT_DIR}/${NC}"
echo ""
echo -e "  ${DIM}Frames:${NC}   ${EXTRACTED} @ ${TARGET_FPS}fps → ${TOTAL_SIZE} total"
echo -e "  ${DIM}Resolution:${NC} ${TARGET_W}x${TARGET_H}"
echo -e "  ${DIM}Run:${NC}      cd ${OUTPUT_DIR} && ${PKG_MGR} run dev"
echo ""
echo -e "  ${DIM}Edit src/app/page.tsx to add your sections.${NC}"
echo -e "  ${DIM}The canvas animation works out of the box.${NC}"
echo ""
hr
