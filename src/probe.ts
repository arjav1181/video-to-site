import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface VideoMeta {
  width: number;
  height: number;
  fps: number;
  duration: number;
  nbFrames: number | null;
}

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  nb_frames?: string;
  duration?: string;
}

interface ProbeData {
  streams?: ProbeStream[];
  format?: { duration?: string; nb_streams?: number };
}

/** Parse an ffmpeg rational frame rate like "24/1" or "30000/1001". */
export function parseFps(rate: string | undefined, fallback = 30): number {
  if (!rate) return fallback;
  const parts = rate.split("/").map(Number);
  if (parts.length === 2 && parts[1] !== 0 && Number.isFinite(parts[0] / parts[1])) {
    return Math.round(parts[0] / parts[1]);
  }
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export function parseProbe(json: string): VideoMeta {
  const data = JSON.parse(json) as ProbeData;
  const video = (data.streams ?? []).find((s) => s.codec_type === "video") ?? {};
  const width = Number(video.width ?? 0);
  const height = Number(video.height ?? 0);
  if (!width || !height) throw new Error("No video stream found");
  const fps = parseFps(video.r_frame_rate && video.r_frame_rate !== "0/0" ? video.r_frame_rate : video.avg_frame_rate);
  const duration = Number(data.format?.duration ?? video.duration ?? 0);
  const nbRaw = video.nb_frames;
  const nbFrames = nbRaw && nbRaw !== "N/A" ? Number(nbRaw) : null;
  return { width, height, fps, duration, nbFrames: Number.isFinite(nbFrames) ? nbFrames : null };
}

/** Estimated output frame count for progress reporting. */
export function estimateFrames(meta: VideoMeta, fps: number): number {
  if (meta.nbFrames && meta.nbFrames > 0 && Math.abs(meta.fps - fps) < 1) return meta.nbFrames;
  return Math.max(1, Math.round(meta.duration * fps));
}

export async function probeVideo(file: string): Promise<VideoMeta> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    file,
  ]);
  return parseProbe(stdout);
}
