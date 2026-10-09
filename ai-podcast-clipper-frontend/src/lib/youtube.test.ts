import { describe, expect, it } from "vitest";
import { canonicalYouTubeUrl, parseYouTubeVideoId } from "./youtube";

describe("parseYouTubeVideoId", () => {
  it("reads the id from a watch link", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=YRvf00NooN8"),
    ).toBe("YRvf00NooN8");
  });

  it("reads the id from a short link", () => {
    expect(parseYouTubeVideoId("https://youtu.be/YRvf00NooN8")).toBe(
      "YRvf00NooN8",
    );
  });

  it("ignores other query parameters", () => {
    expect(
      parseYouTubeVideoId(
        "https://www.youtube.com/watch?list=PL123&v=YRvf00NooN8&t=42s",
      ),
    ).toBe("YRvf00NooN8");
  });

  it("returns null when there is no id", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(parseYouTubeVideoId("not a url")).toBeNull();
  });

  it("returns null for an id that is too short", () => {
    expect(parseYouTubeVideoId("https://youtu.be/abc")).toBeNull();
  });

  it("refuses other hosts that merely contain v=", () => {
    expect(
      parseYouTubeVideoId("https://evil.com/watch?v=YRvf00NooN8"),
    ).toBeNull();
    expect(
      parseYouTubeVideoId("https://youtube.com.evil.com/watch?v=YRvf00NooN8"),
    ).toBeNull();
  });

  it("refuses ids with anything appended", () => {
    expect(
      parseYouTubeVideoId(
        "https://www.youtube.com/watch?v=YRvf00NooN8;touch%20/tmp/x",
      ),
    ).toBeNull();
    expect(
      parseYouTubeVideoId("https://youtu.be/YRvf00NooN8/extra"),
    ).toBeNull();
  });

  it("refuses non-web schemes", () => {
    expect(
      parseYouTubeVideoId("javascript://www.youtube.com/watch?v=YRvf00NooN8"),
    ).toBeNull();
  });
});

describe("canonicalYouTubeUrl", () => {
  it("rebuilds the watch URL from the id", () => {
    expect(canonicalYouTubeUrl("YRvf00NooN8")).toBe(
      "https://www.youtube.com/watch?v=YRvf00NooN8",
    );
  });
});
