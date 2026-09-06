#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { probeVideo, estimateFrames } from "./probe.js";
import { resolveSize, frameName, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_QUALITY } from "./pipeline.js";
import { extractFrames } from "./extract.js";
import { optimizeFrames } from "./optimize.js";
import { scaffoldProject } from "./scaffold.js";
import { detectPackageManager, runScript } from "./exec.js";
import { commandExists, formatBytes, formatDuration } from "./util.js";
import { log } from "./log.js";

export const VERSION = "1.0.0";

export interface Options {
  video: string;
  outDir: string;
  fps: number | null;
  width: number;
  height: number;
  name: string | null;
  upscale: boolean;
  install: boolean;
  build: boolean;
  quality: number;
  pm: string | null;
}

const HELP = `video-to-site v${VERSION} — turn any video into a scroll-driven Next.js portfolio site.

Usage:
  video-to-site <video> [output-dir] [options]

Arguments:
  video                 Input video file (any ffmpeg-readable format)
  output-dir            Where to create the site (default: ./<video-name>-site)

Options:
  --fps <n>             Extract at this frame rate (default: source video fps)
  --width <n>           Target width when upscaling (default: ${DEFAULT_WIDTH})
  --height <n>          Target height when upscaling (default: ${DEFAULT_HEIGHT})
  --name <name>         Project name for package.json (default: output dir name)
  --quality <1-100>     Frame JPEG quality (default: ${DEFAULT_QUALITY})
  --pm <bun|npm>        Package manager for install/build (default: auto-detect)
  --no-upscale          Never upscale; keep the source resolution
  --no-install          Skip dependency installation
  --no-build            Skip the production build
  -h, --help            Show this help
  -V, --version         Show version

Examples:
  video-to-site intro.mp4
  video-to-site intro.mp4 my-site --fps 30
  video-to-site reel.mov portfolio --no-build --quality 90

Requirements: ffmpeg and ffprobe on PATH, plus bun or npm for install/build.
Docs: https://github.com/arjav1181/video-to-site
`;

export function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const opts: Options = {
    video: "",
    outDir: "",
    fps: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    name: null,
    upscale: true,
    install: true,
    build: true,
    quality: DEFAULT_QUALITY,
    pm: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(HELP);
        process.exit(0);
        break;
      case "-V":
      case "--version":
        process.stdout.write(`video-to-site v${VERSION}\n`);
        process.exit(0);
        break;
      case "--fps": {
        const v = Number(next());
        if (!Number.isFinite(v) || v <= 0) throw new Error("--fps must be a positive number");
        opts.fps = v;
        break;
      }
      case "--width":
        opts.width = num(next(), "--width");
        break;
      case "--height":
        opts.height = num(next(), "--height");
        break;
      case "--name":
        opts.name = next();
        break;
      case "--quality": {
        const v = Number(next());
        if (!Number.isInteger(v) || v < 1 || v > 100) throw new Error("--quality must be an integer 1-100");
        opts.quality = v;
        break;
      }
      case "--pm": {
        const v = next();
        if (v !== "bun" && v !== "npm") throw new Error('--pm must be "bun" or "npm"');
        opts.pm = v;
        break;
      }
      case "--no-upscale":
        opts.upscale = false;
        break;
      case "--no-install":
        opts.install = false;
        break;
      case "--no-build":
        opts.build = false;
        break;
      default:
        if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length === 0) throw new Error("Missing <video> argument. Run with --help for usage.");
  if (positional.length > 2) throw new Error("Too many arguments. Run with --help for usage.");
  opts.video = positional[0];
  const base = path.basename(opts.video).replace(/\.[^.]*$/, "") || "site";
  opts.outDir = positional[1] ?? `./${base}-site`;
  return opts;
}

function num(v: string, flag: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} must be a positive number`);
  return Math.round(n);
}

export async function run(opts: Options): Promise<void> {
  if (!existsSync(opts.video)) throw new Error(`Video file not found: ${opts.video}`);
  for (const cmd of ["ffmpeg", "ffprobe"]) {
    if (!(await commandExists(cmd))) throw new Error(`Missing dependency: ${cmd} (install ffmpeg)`);
  }
  const pm = opts.install || opts.build ? await detectPackageManager(opts.pm ?? undefined) : null;

  const outDir = path.resolve(opts.outDir);
  const projectName = opts.name ?? (path.basename(outDir).replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() || "video-portfolio");

  log.blank();
  log.title("  video-to-site v" + VERSION);
  log.dim("────────────────────────────────────────────");
  log.blank();
  log.step(`Video:    ${opts.video}`);
  log.step(`Output:   ${outDir}`);
  log.blank();

  // 1. Analyze
  log.step("Analyzing video...");
  const meta = await probeVideo(opts.video);
  const fps = opts.fps ?? meta.fps;
  const size = resolveSize(meta.width, meta.height, opts.width, opts.height, !opts.upscale);
  const expected = estimateFrames(meta, fps);
  log.ok(`Source: ${meta.width}x${meta.height} @ ${meta.fps}fps, ${formatDuration(meta.duration)} → ${expected} frames @ ${fps}fps`);
  if (size.upscaled) log.step(`Upscaling ${meta.width}x${meta.height} → ${size.width}x${size.height} (lanczos)`);
  else log.step(`Output resolution: ${size.width}x${size.height}`);
  log.blank();

  // 2. Extract
  const framesDir = path.join(outDir, "public", "frames");
  mkdirSync(framesDir, { recursive: true });
  log.step(`Extracting frames at ${fps}fps...`);
  await extractFrames({ video: opts.video, outDir: framesDir, fps, scaleFilter: size.scaleFilter, expectedFrames: expected });
  const extracted = readdirSync(framesDir).filter((f) => f.endsWith(".png")).length;
  log.ok(`Extracted ${extracted} frames`);
  log.blank();

  // 3. Optimize
  log.step(`Optimizing frames (4:4:4 chroma, q${opts.quality})...`);
  const totalBytes = await optimizeFrames({ dir: framesDir, quality: opts.quality });
  const sample = statSync(path.join(framesDir, frameName(0))).size;
  log.ok(`Frames optimized: ${formatBytes(totalBytes)} total, ~${formatBytes(sample)} avg per frame`);
  log.blank();

  // 4. Scaffold
  log.step("Scaffolding Next.js project...");
  await scaffoldProject({ outDir, projectName, frameCount: extracted });
  log.ok("Generated src/app/page.tsx");
  log.blank();

  // 5. Install + build
  if (pm && opts.install) {
    log.step(`Installing dependencies with ${pm}...`);
    await runScript(pm, outDir, ["install"]);
    log.ok("Dependencies installed");
    log.blank();
  }
  if (pm && opts.build) {
    log.step("Building project...");
    await runScript(pm, outDir, ["run", "build"]);
    log.ok("Build complete");
    log.blank();
  }

  log.dim("────────────────────────────────────────────");
  log.blank();
  log.ok(`Done! Your site is ready at: ${outDir}/`);
  log.blank();
  log.dim(`  Frames:   ${extracted} @ ${fps}fps → ${formatBytes(totalBytes)} total`);
  log.dim(`  Run:      cd ${outDir} && ${pm ?? "bun"} run dev`);
  log.dim(`  Edit src/app/page.tsx to add your sections.`);
  log.blank();
}

async function main(): Promise<void> {
  try {
    await run(parseArgs(process.argv.slice(2)));
  } catch (e) {
    log.err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

// Only auto-run when executed as the CLI entry point (not when imported by tests).
const isEntry = process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isEntry) {
  void main();
}
