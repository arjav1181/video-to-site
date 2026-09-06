import { describe, it, expect, beforeAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../src/cli.js";

const execFileAsync = promisify(execFile);

async function hasFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

describe("end-to-end pipeline", () => {
  let video = "";
  let outDir = "";

  beforeAll(async () => {
    if (!(await hasFfmpeg())) return;
    const dir = mkdtempSync(path.join(tmpdir(), "vts-e2e-"));
    video = path.join(dir, "sample.mp4");
    // 2s synthetic video, no network or fixtures needed
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=2",
      "-pix_fmt", "yuv420p", video,
    ]);
    outDir = path.join(dir, "site");
  });

  it("turns a video into a site without install/build", async () => {
    if (!video) return; // ffmpeg missing — CI always has it
    await run({
      video,
      outDir,
      fps: 10,
      width: 640,
      height: 480,
      name: "e2e-site",
      upscale: false,
      install: false,
      build: false,
      quality: 90,
      pm: null,
    });

    const frames = readdirSync(path.join(outDir, "public", "frames"));
    expect(frames.length).toBe(20);
    expect(frames[0]).toBe("frame-0001.jpg");

    const pkg = JSON.parse(readFileSync(path.join(outDir, "package.json"), "utf8"));
    expect(pkg.name).toBe("e2e-site");

    const page = readFileSync(path.join(outDir, "src", "app", "page.tsx"), "utf8");
    expect(page).toContain("const FRAME_COUNT = 20");
    expect(existsSync(path.join(outDir, "src", "app", "layout.tsx"))).toBe(true);
    expect(existsSync(path.join(outDir, "src", "app", "globals.css"))).toBe(true);
  });
});
