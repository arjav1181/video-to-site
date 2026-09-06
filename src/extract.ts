import { spawn } from "node:child_process";
import path from "node:path";
import { buildFilterChain } from "./pipeline.js";
import { progress } from "./log.js";

export interface ExtractOptions {
  video: string;
  outDir: string;
  fps: number;
  scaleFilter: string | null;
  expectedFrames: number;
}

/** Extract PNG frames with ffmpeg, showing live progress parsed from stderr. */
export function extractFrames(opts: ExtractOptions): Promise<number> {
  const bar = progress(opts.expectedFrames, "frames");
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", opts.video,
      "-vf", buildFilterChain(opts.fps, opts.scaleFilter),
      "-q:v", "1",
      path.join(opts.outDir, "frame-%04d.png"),
    ];
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let buffer = "";
    child.stderr.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\r");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const m = /frame=\s*(\d+)/.exec(part);
        if (m) bar.set(Number(m[1]));
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        bar.done();
        resolve(opts.expectedFrames);
      } else {
        process.stdout.write("\n");
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}
