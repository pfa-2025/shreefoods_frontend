import { describe, expect, it } from "vitest";
import { isExternal, safeHref } from "./safe-href";

describe("safeHref", () => {
  it("allows on-site paths and http(s) addresses", () => {
    expect(safeHref("/menu")).toBe("/menu");
    expect(safeHref("/order/abc?x=1#y")).toBe("/order/abc?x=1#y");
    expect(safeHref("https://instagram.com/shreefoods")).toBe("https://instagram.com/shreefoods");
    expect(safeHref(" https://example.com/a ")).toBe("https://example.com/a");
  });
  it("refuses script, data and protocol-relative links", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "vbscript:x", "//evil.example", "/\\evil.example", "ftp://x", "mailto:a@b.co", "", "   ", "not a url", "http:/", "file:///etc/passwd"]) {
      expect(safeHref(bad)).toBeNull();
    }
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
  it("tells external links apart", () => {
    expect(isExternal("https://x.co")).toBe(true);
    expect(isExternal("/menu")).toBe(false);
  });
});
