import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));
const files = walk(__dirname).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));

describe("source review (XSS and secrets)", () => {
  it("never renders raw HTML or evaluates strings", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect({ f: path.relative(__dirname, f), bad: /dangerouslySetInnerHTML|\binnerHTML\b|\beval\(|new Function\(|document\.write\(/.test(text) }).toEqual({ f: path.relative(__dirname, f), bad: false });
    }
  });
  it("keeps server-only secrets out of client code and out of NEXT_PUBLIC_ variables", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(/NEXT_PUBLIC_[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)/.test(text)).toBe(false);
      if (text.startsWith('"use client"')) expect(text).not.toMatch(/REVALIDATE_SECRET|SESSION_SECRET|API_SECRET/);
    }
  });
  it("opens external links safely (noopener) wherever target=_blank is used", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const tag of text.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) expect({ f: path.relative(__dirname, f), tag, ok: tag.includes("noopener") }).toMatchObject({ ok: true });
    }
  });
});
