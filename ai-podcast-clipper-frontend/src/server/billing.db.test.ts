import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs against a real Postgres built from the migrations (vitest.db-setup.ts); skipped without one.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const mocks = vi.hoisted(() => ({
  s3Keys: [] as string[],
  checkoutPriceId: "price_small",
  sessionUserId: null as string | null,
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    PROCESS_VIDEO_ENDPOINT: "https://modal.test/process",
    PROCESS_VIDEO_ENDPOINT_AUTH: "token",
    AWS_REGION: "us-east-2",
    AWS_ACCESS_KEY_ID: "test",
    AWS_SECRET_ACCESS_KEY: "test",
    S3_BUCKET_NAME: "bucket",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_SMALL_CREDIT_PACK: "price_small",
    STRIPE_MEDIUM_CREDIT_PACK: "price_medium",
    STRIPE_LARGE_CREDIT_PACK: "price_large",
  },
}));

vi.mock("~/server/auth", () => ({
  auth: () =>
    Promise.resolve(
      mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null,
    ),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send() {
      return Promise.resolve({
        Contents: mocks.s3Keys.map((Key) => ({ Key })),
      });
    }
  },
  ListObjectsV2Command: class {},
}));

// signature checking and the line-item lookup are Stripe's; the test supplies their results
vi.mock("stripe", () => ({
  default: class {
    webhooks = {
      constructEvent: (body: string) => JSON.parse(body) as unknown,
    };
    checkout = {
      sessions: {
        retrieve: () =>
          Promise.resolve({
            line_items: { data: [{ price: { id: mocks.checkoutPriceId } }] },
          }),
      },
    };
  },
}));

const { db } = await import("~/server/db");
const { grantCredits, reserveCredits } = await import("~/server/credits");
const { runProcessVideo } = await import("~/inngest/functions");
const { POST: stripeWebhook } = await import("~/app/api/webhooks/stripe/route");
const { updateWatermark } = await import("~/actions/watermark");
const { BRAND } = await import("~/config/brand");

async function makeUser(credits: number) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `user-${crypto.randomUUID()}@example.com`,
        password: "x",
        emailVerified: new Date(),
        stripeCustomerId: `cus_${crypto.randomUUID()}`,
      },
    });
    if (credits > 0) {
      await grantCredits(tx, {
        userId: user.id,
        amount: credits,
        reason: "ADMIN_ADJUSTMENT",
      });
    }
    return user;
  });
}

async function makeFile(userId: string) {
  const prefix = crypto.randomUUID();
  const file = await db.uploadedFile.create({
    data: { userId, s3Key: `${prefix}/original.mp4`, uploaded: true },
  });
  return { file, prefix };
}

async function balance(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return user.credits;
}

// the steps run inline; fetch stands in for Modal
function steps(modal: () => Response) {
  const fetch = vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(modal()),
  );
  return {
    fetch,
    step: { run: <T>(_id: string, fn: () => Promise<T>) => fn(), fetch },
  };
}

function sentBody(fetch: ReturnType<typeof steps>["fetch"]) {
  const init = fetch.mock.calls[0]?.[1];
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

function sentMaxClips(fetch: ReturnType<typeof steps>["fetch"]) {
  const init = fetch.mock.calls[0]?.[1];
  return (JSON.parse(init?.body as string) as { max_clips: number }).max_clips;
}

function event(uploadedFileId: string, userId: string) {
  return { data: { uploadedFileId, userId } };
}

describe.skipIf(!url)("billing against Postgres", () => {
  beforeEach(() => {
    mocks.s3Keys = [];
    mocks.checkoutPriceId = "price_small";
  });

  afterAll(async () => {
    // every balance equals the sum of its ledger, across everything the tests did
    const users = await db.user.findMany({
      select: { credits: true, creditEntries: { select: { delta: true } } },
    });
    for (const user of users) {
      expect(user.creditEntries.reduce((sum, e) => sum + e.delta, 0)).toBe(
        user.credits,
      );
    }
    await db.$disconnect();
  });

  describe("the database", () => {
    it("refuses a negative balance", async () => {
      const user = await makeUser(1);
      await expect(
        db.user.update({
          where: { id: user.id },
          data: { credits: { decrement: 2 } },
        }),
      ).rejects.toThrow();
      expect(await balance(user.id)).toBe(1);
    });
  });

  describe("reserveCredits", () => {
    it("takes up to the maximum, then whatever is left, never below zero", async () => {
      const user = await makeUser(7);
      const { file } = await makeFile(user.id);
      const reserve = () =>
        db.$transaction((tx) =>
          reserveCredits(tx, {
            userId: user.id,
            uploadedFileId: file.id,
            max: 5,
          }),
        );
      expect(await reserve()).toBe(5);
      expect(await reserve()).toBe(2);
      expect(await reserve()).toBe(0);
      expect(await balance(user.id)).toBe(0);
    });
  });

  describe("a processing job", () => {
    it("charges one credit per delivered clip and refunds the rest", async () => {
      const user = await makeUser(10);
      const { file, prefix } = await makeFile(user.id);
      mocks.s3Keys = [
        `${prefix}/original.mp4`,
        `${prefix}/clip_0.mp4`,
        `${prefix}/clip_1.mp4`,
      ];
      const { step, fetch } = steps(() => new Response("null"));

      await runProcessVideo({ event: event(file.id, user.id), step });

      expect(sentMaxClips(fetch)).toBe(5);
      expect(await balance(user.id)).toBe(8);
      expect(await db.clip.count({ where: { uploadedFileId: file.id } })).toBe(
        2,
      );
      expect(
        (await db.uploadedFile.findUniqueOrThrow({ where: { id: file.id } }))
          .status,
      ).toBe("PROCESSED");
    });

    it("asks Modal for no more clips than the user can pay for", async () => {
      const user = await makeUser(1);
      const { file, prefix } = await makeFile(user.id);
      mocks.s3Keys = [
        `${prefix}/clip_0.mp4`,
        `${prefix}/clip_1.mp4`,
        `${prefix}/clip_2.mp4`,
      ];
      const { step, fetch } = steps(() => new Response("null"));

      await runProcessVideo({ event: event(file.id, user.id), step });

      expect(sentMaxClips(fetch)).toBe(1);
      expect(await balance(user.id)).toBe(0);
      expect(await db.clip.count({ where: { uploadedFileId: file.id } })).toBe(
        1,
      );
    });

    it("costs nothing when no moments are found", async () => {
      const user = await makeUser(4);
      const { file } = await makeFile(user.id);
      const { step } = steps(() => new Response("null"));

      await runProcessVideo({ event: event(file.id, user.id), step });

      expect(await balance(user.id)).toBe(4);
    });

    it("refunds everything when the pipeline fails", async () => {
      const user = await makeUser(6);
      const { file } = await makeFile(user.id);
      const { step } = steps(() => new Response("boom", { status: 500 }));

      await expect(
        runProcessVideo({ event: event(file.id, user.id), step }),
      ).rejects.toThrow(/Modal backend failed \(500\)/);

      expect(await balance(user.id)).toBe(6);
      const failed = await db.uploadedFile.findUniqueOrThrow({
        where: { id: file.id },
      });
      expect(failed.status).toBe("FAILED");
      expect(failed.failureReason).toMatch(/try again/);
      expect(failed.failureReason).not.toContain("boom");
      const reasons = await db.creditLedgerEntry.findMany({
        where: { uploadedFileId: file.id },
        orderBy: { createdAt: "asc" },
        select: { reason: true, delta: true },
      });
      expect(reasons).toEqual([
        { reason: "JOB_RESERVE", delta: -5 },
        { reason: "JOB_REFUND", delta: 5 },
      ]);
    });

    it("charges for clips that reached S3 even when the request failed", async () => {
      const user = await makeUser(5);
      const { file, prefix } = await makeFile(user.id);
      mocks.s3Keys = [
        `${prefix}/clip_0.mp4`,
        `${prefix}/clip_1.mp4`,
        `${prefix}/clip_2.mp4`,
      ];
      const { step } = steps(() => new Response("timeout", { status: 504 }));

      await runProcessVideo({ event: event(file.id, user.id), step });

      expect(await balance(user.id)).toBe(2);
      expect(
        (await db.uploadedFile.findUniqueOrThrow({ where: { id: file.id } }))
          .status,
      ).toBe("PROCESSED");
    });

    it("doesn't start without credits", async () => {
      const user = await makeUser(0);
      const { file } = await makeFile(user.id);
      const { step, fetch } = steps(() => new Response("null"));

      await runProcessVideo({ event: event(file.id, user.id), step });

      expect(fetch).not.toHaveBeenCalled();
      expect(
        (await db.uploadedFile.findUniqueOrThrow({ where: { id: file.id } }))
          .status,
      ).toBe("NO_CREDITS");
    });
  });

  describe("the Stripe webhook", () => {
    function checkout(eventId: string, customerId: string) {
      return new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=test" },
        body: JSON.stringify({
          id: eventId,
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test",
              customer: customerId,
              payment_status: "paid",
            },
          },
        }),
      });
    }

    it("adds a pack's credits once, however many times the event is delivered", async () => {
      const user = await makeUser(0);
      const eventId = `evt_${crypto.randomUUID()}`;

      for (let i = 0; i < 3; i++) {
        const response = await stripeWebhook(
          checkout(eventId, user.stripeCustomerId!),
        );
        expect(response.status).toBe(200);
      }

      expect(await balance(user.id)).toBe(50);
    });

    it("adds nothing for a price that isn't a credit pack", async () => {
      const user = await makeUser(0);
      mocks.checkoutPriceId = "price_unknown";

      const response = await stripeWebhook(
        checkout(`evt_${crypto.randomUUID()}`, user.stripeCustomerId!),
      );

      expect(response.status).toBe(200);
      expect(await balance(user.id)).toBe(0);
    });
  });
  describe("watermarks (ADR 0016)", () => {
    async function purchase(userId: string) {
      await db.$transaction((tx) =>
        grantCredits(tx, {
          userId,
          amount: 50,
          reason: "PURCHASE",
          stripeEventId: `evt_${crypto.randomUUID()}`,
        }),
      );
    }

    async function runJob(userId: string) {
      const { file } = await makeFile(userId);
      const { step, fetch } = steps(() => new Response("null"));
      await runProcessVideo({ event: event(file.id, userId), step });
      return sentBody(fetch);
    }

    it("puts the house watermark on jobs from accounts that haven't bought credits", async () => {
      const user = await makeUser(10);
      expect((await runJob(user.id)).watermark_text).toBe(BRAND.houseWatermark);
    });

    it("puts no watermark on a paying account's jobs until they choose one", async () => {
      const user = await makeUser(0);
      await purchase(user.id);
      expect((await runJob(user.id)).watermark_text).toBeNull();
    });

    it("uses the paying creator's own text", async () => {
      const user = await makeUser(0);
      await purchase(user.id);
      mocks.sessionUserId = user.id;

      expect(await updateWatermark("  @my.podcast ")).toEqual({
        success: true,
      });
      expect((await runJob(user.id)).watermark_text).toBe("@my.podcast");

      expect(await updateWatermark("")).toEqual({ success: true });
      expect((await runJob(user.id)).watermark_text).toBeNull();
    });

    it("refuses a custom watermark before any purchase, and invalid text after", async () => {
      const user = await makeUser(10);
      mocks.sessionUserId = user.id;
      expect((await updateWatermark("@mine")).success).toBe(false);

      await purchase(user.id);
      expect((await updateWatermark("x".repeat(41))).success).toBe(false);
      expect((await updateWatermark("🎙️ pod")).success).toBe(false);
      const stored = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.watermarkText).toBeNull();
    });

    it("can't store an over-long watermark even by going around the app", async () => {
      const user = await makeUser(0);
      await expect(
        db.user.update({
          where: { id: user.id },
          data: { watermarkText: "x".repeat(41) },
        }),
      ).rejects.toThrow();
    });
  });
});
