import { describe, expect, it } from "vitest";
import { formatBps, formatDollars, parseDollars, parsePercentToBps } from "./money";

describe("parseDollars", () => {
  it("converts typical inputs exactly", () => {
    expect(parseDollars("12")).toBe(1200);
    expect(parseDollars("12.5")).toBe(1250);
    expect(parseDollars("12.50")).toBe(1250);
    expect(parseDollars("$7.00")).toBe(700);
    expect(parseDollars(" 0.05 ")).toBe(5);
    expect(parseDollars("19.99")).toBe(1999);
  });
  it("has no floating-point drift on tricky values", () => {
    expect(parseDollars("0.29")).toBe(29); // 0.29 * 100 === 28.999999999999996 in floating point
    expect(parseDollars("1.15")).toBe(115);
    expect(parseDollars("8.20")).toBe(820);
  });
  it("rejects everything that isn't a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1,000", "12.", ".5", "1e3", "$$5", "12 dollars", "9999999"]) {
      expect(parseDollars(bad)).toBeNull();
    }
  });
});

describe("formatDollars", () => {
  it("round-trips with parseDollars", () => {
    for (const cents of [1, 5, 99, 100, 1250, 1999, 100000]) expect(parseDollars(formatDollars(cents))).toBe(cents);
    expect(formatDollars(700)).toBe("7.00");
    expect(formatDollars(5)).toBe("0.05");
  });
});

describe("percent <-> basis points", () => {
  it("parses tax rates exactly", () => {
    expect(parsePercentToBps("8.25")).toBe(825);
    expect(parsePercentToBps("8.25%")).toBe(825);
    expect(parsePercentToBps("0")).toBe(0);
    expect(parsePercentToBps("10")).toBe(1000);
    expect(parsePercentToBps("7.5")).toBe(750);
  });
  it("rejects invalid rates", () => {
    for (const bad of ["", "-1", "8.255", "abc", "100", "8,25"]) expect(parsePercentToBps(bad)).toBeNull();
  });
  it("formats back", () => expect(formatBps(825)).toBe("8.25"));
});
