import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, checkUpload } from "./uploads";

describe("checkUpload", () => {
  it("allows an MP4 within the size limit", () => {
    expect(checkUpload({ contentType: "video/mp4", size: 1024 })).toBeNull();
    expect(
      checkUpload({ contentType: "video/mp4", size: MAX_UPLOAD_BYTES }),
    ).toBeNull();
  });

  it("refuses other content types", () => {
    for (const contentType of [
      "video/webm",
      "text/html",
      "image/svg+xml",
      "",
    ]) {
      expect(checkUpload({ contentType, size: 1024 })).not.toBeNull();
    }
  });

  it("refuses files over the limit", () => {
    expect(
      checkUpload({ contentType: "video/mp4", size: MAX_UPLOAD_BYTES + 1 }),
    ).not.toBeNull();
  });

  it("refuses empty or nonsense sizes", () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(checkUpload({ contentType: "video/mp4", size })).not.toBeNull();
    }
  });
});
