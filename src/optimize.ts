import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { progress } from "./log.js";

export interface OptimizeOptions {
  dir: string;
  quality: number;
}

/**
 * Convert extracted PNGs to high-quality JPEGs with full 4:4:4 chroma
 * (no color subsampling artifacts), then delete the PNGs.
 * Returns the total size of the resulting JPEGs in bytes.
 */
export async function optimizeFrames(opts: OptimizeOptions): Promise<number> {
  const files = (await readdir(opts.dir)).filter((f) => f.endsWith(".png")).sort();
  const bar = progress(files.length, "frames");
  let totalBytes = 0;
  for (const file of files) {
    const src = path.join(opts.dir, file);
    const dst = path.join(opts.dir, file.replace(/\.png$/, ".jpg"));
    const info = await sharp(src)
      .jpeg({ quality: opts.quality, chromaSubsampling: "4:4:4" })
      .toFile(dst);
    totalBytes += info.size;
    await unlink(src);
    bar.tick();
  }
  bar.done();
  return totalBytes;
}
