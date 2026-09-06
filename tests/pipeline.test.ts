import { describe, it, expect } from "vitest";
import { frameName, resolveSize, buildFilterChain } from "../src/pipeline.js";

describe("frameName", () => {
  it("zero-pads to 4 digits with .jpg default", () => {
    expect(frameName(0)).toBe("frame-0001.jpg");
    expect(frameName(299)).toBe("frame-0300.jpg");
  });
  it("supports other extensions", () => {
    expect(frameName(0, "png")).toBe("frame-0001.png");
  });
});

describe("resolveSize", () => {
  it("upscales smaller sources with matching aspect", () => {
    expect(resolveSize(1280, 720, 1920, 1080, false)).toEqual({
      width: 1920,
      height: 1080,
      scaleFilter: "scale=1920:1080:flags=lanczos",
      upscaled: true,
    });
  });
  it("keeps source resolution when already large enough", () => {
    const r = resolveSize(3840, 2160, 1920, 1080, false);
    expect(r).toEqual({ width: 3840, height: 2160, scaleFilter: null, upscaled: false });
  });
  it("respects --no-upscale", () => {
    const r = resolveSize(640, 480, 1920, 1080, true);
    expect(r.upscaled).toBe(false);
    expect(r.scaleFilter).toBeNull();
  });
  it("skips upscale on aspect mismatch", () => {
    const r = resolveSize(720, 1280, 1920, 1080, false);
    expect(r).toEqual({ width: 720, height: 1280, scaleFilter: null, upscaled: false });
  });
});

describe("buildFilterChain", () => {
  it("chains fps, scale, and full-chroma format", () => {
    expect(buildFilterChain(24, "scale=1920:1080:flags=lanczos")).toBe(
      "fps=24,scale=1920:1080:flags=lanczos,format=yuv444p",
    );
  });
  it("omits scale when not needed", () => {
    expect(buildFilterChain(30, null)).toBe("fps=30,format=yuv444p");
  });
});
