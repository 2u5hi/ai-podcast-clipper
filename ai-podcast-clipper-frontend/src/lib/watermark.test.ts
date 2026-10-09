import { describe, expect, it } from "vitest";
import { MAX_WATERMARK_LENGTH, parseWatermarkText } from "./watermark";

describe("parseWatermarkText", () => {
  it("keeps a handle or site, trimmed and with single spaces", () => {
    expect(parseWatermarkText("  @my.podcast  ")).toEqual({
      ok: true,
      text: "@my.podcast",
    });
    expect(parseWatermarkText("The   Daily  Show")).toEqual({
      ok: true,
      text: "The Daily Show",
    });
  });

  it("treats blank as no watermark", () => {
    expect(parseWatermarkText("   ")).toEqual({ ok: true, text: null });
  });

  it("allows the characters ffmpeg would otherwise trip on", () => {
    expect(parseWatermarkText(`it's 100% "real": a\\b`)).toEqual({
      ok: true,
      text: `it's 100% "real": a\\b`,
    });
  });

  it("refuses text that is too long", () => {
    expect(parseWatermarkText("x".repeat(MAX_WATERMARK_LENGTH)).ok).toBe(true);
    expect(parseWatermarkText("x".repeat(MAX_WATERMARK_LENGTH + 1)).ok).toBe(
      false,
    );
  });

  it("refuses emoji and control characters", () => {
    expect(parseWatermarkText("great pod 🎙️").ok).toBe(false);
    expect(parseWatermarkText("a\u0000b").ok).toBe(false);
    expect(parseWatermarkText("tab\there").ok).toBe(true); // whitespace collapses to a space
  });
});
