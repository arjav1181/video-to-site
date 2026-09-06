import { describe, it, expect } from "vitest";
import { parseFps, parseProbe, estimateFrames } from "../src/probe.js";

const FIXTURE = JSON.stringify({
  streams: [
    { codec_type: "audio", codec_name: "aac" },
    {
      codec_type: "video",
      width: 1280,
      height: 720,
      r_frame_rate: "24/1",
      avg_frame_rate: "24/1",
      nb_frames: "240",
    },
  ],
  format: { duration: "10.005" },
});

describe("parseFps", () => {
  it("parses rational rates", () => {
    expect(parseFps("24/1")).toBe(24);
    expect(parseFps("30000/1001")).toBe(30);
    expect(parseFps("60000/1001")).toBe(60);
  });
  it("falls back on garbage", () => {
    expect(parseFps(undefined)).toBe(30);
    expect(parseFps("0/0")).toBe(30);
    expect(parseFps("")).toBe(30);
  });
});

describe("parseProbe", () => {
  it("extracts video metadata, skipping audio streams", () => {
    expect(parseProbe(FIXTURE)).toEqual({
      width: 1280,
      height: 720,
      fps: 24,
      duration: 10.005,
      nbFrames: 240,
    });
  });
  it("throws when no video stream exists", () => {
    expect(() => parseProbe(JSON.stringify({ streams: [], format: {} }))).toThrow();
  });
  it("handles N/A frame counts", () => {
    const meta = parseProbe(
      JSON.stringify({
        streams: [{ codec_type: "video", width: 640, height: 480, r_frame_rate: "30/1", nb_frames: "N/A" }],
        format: { duration: "5" },
      }),
    );
    expect(meta.nbFrames).toBeNull();
  });
});

describe("estimateFrames", () => {
  it("uses duration × fps", () => {
    expect(estimateFrames({ width: 1, height: 1, fps: 24, duration: 10, nbFrames: null }, 24)).toBe(240);
  });
});
