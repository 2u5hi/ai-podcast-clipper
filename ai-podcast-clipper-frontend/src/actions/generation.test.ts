import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  send: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  env: { YOUTUBE_INGESTION_ENABLED: false },
}));

vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/inngest/client", () => ({ inngest: { send: mocks.send } }));
vi.mock("~/server/db", () => ({
  db: {
    uploadedFile: {
      updateMany: mocks.updateMany,
      update: mocks.update,
      create: mocks.create,
    },
  },
}));
vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { processVideo, processYouTubeUrl } = await import("./generation");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.YOUTUBE_INGESTION_ENABLED = false;
  mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
});

describe("processVideo", () => {
  it("refuses a caller who isn't signed in", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(processVideo("file-1")).rejects.toThrow("Unauthorized");
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("only claims files owned by the caller that weren't already submitted", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    await processVideo("file-1");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "file-1", userId: "user-a", uploaded: false },
      data: { uploaded: true },
    });
    expect(mocks.send).toHaveBeenCalledWith({
      name: "process-video-events",
      data: { uploadedFileId: "file-1", userId: "user-a" },
    });
  });

  it("queues nothing for someone else's file or a second submit", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await processVideo("someone-elses-file");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("releases the claim if the event can't be sent", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.send.mockRejectedValue(new Error("inngest down"));
    await expect(processVideo("file-1")).rejects.toThrow("inngest down");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: { uploaded: false },
    });
  });
});

describe("processYouTubeUrl", () => {
  const url = "https://youtu.be/YRvf00NooN8";

  it("is refused while YouTube ingestion is disabled", async () => {
    await expect(processYouTubeUrl(url)).rejects.toThrow(/YouTube/);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses a fresh storage prefix per job and sends only the canonical URL", async () => {
    mocks.env.YOUTUBE_INGESTION_ENABLED = true;
    mocks.create.mockResolvedValue({ id: "file-9" });

    await processYouTubeUrl(url);
    await processYouTubeUrl(url);

    const keys = mocks.create.mock.calls.map(
      (call) => (call[0] as { data: { s3Key: string } }).data.s3Key,
    );
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}\/original\.mp4$/);
    expect(keys[0]).not.toBe(keys[1]);

    const sentUrls = mocks.send.mock.calls.map(
      (call) => (call[0] as { data: { youtubeUrl: string } }).data.youtubeUrl,
    );
    expect(sentUrls).toEqual([
      "https://www.youtube.com/watch?v=YRvf00NooN8",
      "https://www.youtube.com/watch?v=YRvf00NooN8",
    ]);
  });

  it("rejects links that aren't YouTube", async () => {
    mocks.env.YOUTUBE_INGESTION_ENABLED = true;
    await expect(
      processYouTubeUrl("https://evil.com/watch?v=YRvf00NooN8"),
    ).rejects.toThrow("Invalid YouTube URL");
  });
});
