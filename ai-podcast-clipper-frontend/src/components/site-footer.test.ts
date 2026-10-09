import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_LINKS } from "./site-footer";

const appDir = path.resolve(import.meta.dirname, "../app");
const pageFile = (href: string) => path.join(appDir, href, "page.tsx");

describe("footer links", () => {
  it("cover pricing and every policy", () => {
    expect(FOOTER_LINKS.map((l) => l.href)).toEqual([
      "/pricing",
      "/terms",
      "/privacy",
      "/refunds",
    ]);
  });

  it.each(FOOTER_LINKS.map((l) => l.href))(
    "%s is a real page that doesn't require signing in",
    (href) => {
      expect(existsSync(pageFile(href))).toBe(true);
      const source = readFileSync(pageFile(href), "utf8");
      expect(source).not.toMatch(/\bauth\(|redirect\(/);
    },
  );
});
