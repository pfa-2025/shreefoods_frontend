import { describe, expect, it } from "vitest";
import { ASPECTS, PURPOSES, aspectValue, formatBytes, outputSize, rotatedSize } from "./crop-image";

describe("rotatedSize", () => {
  it("swaps width and height for quarter turns, exactly", () => {
    expect(rotatedSize(800, 600, 90)).toEqual({ width: 600, height: 800 });
    expect(rotatedSize(800, 600, 270)).toEqual({ width: 600, height: 800 });
    expect(rotatedSize(800, 600, -90)).toEqual({ width: 600, height: 800 });
    expect(rotatedSize(800, 600, 450)).toEqual({ width: 600, height: 800 });
  });
  it("leaves half turns and no turn alone", () => {
    expect(rotatedSize(800, 600, 0)).toEqual({ width: 800, height: 600 });
    expect(rotatedSize(800, 600, 180)).toEqual({ width: 800, height: 600 });
    expect(rotatedSize(800, 600, 360)).toEqual({ width: 800, height: 600 });
  });
  it("fits an angled picture in its bounding box", () => {
    const r = rotatedSize(100, 100, 45);
    expect(r.width).toBeCloseTo(141.42, 1);
    expect(r.height).toBeCloseTo(141.42, 1);
  });
});

describe("outputSize", () => {
  it("never enlarges a small crop", () => {
    expect(outputSize(300, 200, 2000)).toEqual({ width: 300, height: 200 });
  });
  it("shrinks big crops to the longest-side limit, keeping the shape", () => {
    expect(outputSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(outputSize(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
  it("always returns at least one pixel", () => {
    expect(outputSize(1, 5000, 100)).toEqual({ width: 1, height: 100 });
  });
});

describe("aspectValue", () => {
  const natural = { width: 800, height: 600 };
  it("uses the fixed ratio when one is chosen", () => {
    expect(aspectValue("1:1", natural, 0)).toBe(1);
    expect(aspectValue("4:3", natural, 90)).toBeCloseTo(4 / 3);
  });
  it('"original" follows the picture, and flips after a quarter turn', () => {
    expect(aspectValue("original", natural, 0)).toBeCloseTo(800 / 600);
    expect(aspectValue("original", natural, 90)).toBeCloseTo(600 / 800);
  });
  it("has a safe fallback before the picture has loaded", () => {
    expect(aspectValue("original", null, 0)).toBeCloseTo(4 / 3);
  });
});

describe("presets", () => {
  it("every purpose starts on a real aspect option", () => {
    for (const p of Object.values(PURPOSES)) expect(ASPECTS.some((a) => a.id === p.aspect)).toBe(true);
  });
  it("QR codes are cropped square and saved lossless; photos are saved as JPEG", () => {
    expect(PURPOSES.qr).toMatchObject({ aspect: "1:1", type: "image/png" });
    for (const k of ["dish", "announcement", "share", "library"] as const) expect(PURPOSES[k].type).toBe("image/jpeg");
  });
  it("the saved size limit stays well inside what the server accepts", () => {
    for (const p of Object.values(PURPOSES)) expect(p.maxEdge).toBeLessThanOrEqual(2000);
  });
});

describe("formatBytes", () => {
  it("is human readable", () => {
    expect(formatBytes(900)).toBe("1 KB");
    expect(formatBytes(420 * 1024)).toBe("420 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
