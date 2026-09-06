export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;
export const DEFAULT_QUALITY = 95;

/** Zero-padded frame file name: frame-0001.jpg */
export function frameName(index: number, ext = "jpg"): string {
  return `frame-${String(index + 1).padStart(4, "0")}.${ext}`;
}

export interface TargetSize {
  width: number;
  height: number;
  /** ffmpeg scale filter, or null when no scaling is needed */
  scaleFilter: string | null;
  upscaled: boolean;
}

/**
 * Decide output resolution. Upscales to the target when the source is smaller
 * and aspect ratios roughly match; otherwise keeps source resolution.
 */
export function resolveSize(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  noUpscale: boolean,
): TargetSize {
  if (noUpscale || (srcW >= targetW && srcH >= targetH)) {
    return { width: srcW, height: srcH, scaleFilter: null, upscaled: false };
  }
  const srcRatio = srcW / srcH;
  const tgtRatio = targetW / targetH;
  if (Math.abs(srcRatio - tgtRatio) > 0.25) {
    return { width: srcW, height: srcH, scaleFilter: null, upscaled: false };
  }
  return {
    width: targetW,
    height: targetH,
    scaleFilter: `scale=${targetW}:${targetH}:flags=lanczos`,
    upscaled: true,
  };
}

/** Build the ffmpeg -vf chain: fps → optional scale → full-chroma pixel format. */
export function buildFilterChain(fps: number, scaleFilter: string | null): string {
  const parts = [`fps=${fps}`];
  if (scaleFilter) parts.push(scaleFilter);
  parts.push("format=yuv444p");
  return parts.join(",");
}
