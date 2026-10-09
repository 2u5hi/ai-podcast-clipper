import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Runs against a real Postgres built from the migrations (vitest.db-setup.ts); skipped without one.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const mocks = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  ip: "203.0.113.7",
  sent: [] as { to: string; subject: string; text: string }[],
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    BASE_URL: "http://localhost:3000",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
  },
}));
vi.mock("~/server/auth", () => ({
  auth: () =>
    Promise.resolve(
      mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null,
    ),
}));
vi.mock("~/server/mailer", () => ({
  sendEmail: (message: { to: string; subject: string; text: string }) => {
    mocks.sent.push(message);
    return Promise.resolve();
  },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": mocks.ip })),
}));

const { db } = await import("~/server/db");
const { rateLimit } = await import("~/server/rate-limit");
const { consumeToken, issueToken } = await import("~/server/tokens");
const {
  requireVerifiedUserId,
  UnverifiedEmailError,
  verifyEmail,
  SIGNUP_CREDITS,
} = await import("~/server/accounts");
const actions = await import("~/actions/auth");
const { authConfig } = await import("~/server/auth/config");
const { comparePasswords } = await import("~/lib/auth");

function linkToken(text: string) {
  const token = /token=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  if (!token) throw new Error(`no token link in: ${text}`);
  return token;
}

function uniqueEmail() {
  return `person-${crypto.randomUUID()}@example.com`;
}

function newIp() {
  mocks.ip = `198.51.100.${Math.floor(Math.random() * 250)}-${crypto.randomUUID()}`;
}

describe.skipIf(!url)("accounts against Postgres", () => {
  beforeEach(() => {
    mocks.sent = [];
    mocks.sessionUserId = null;
    newIp();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("rateLimit", () => {
    it("allows the limit within a window and refuses the next attempt", async () => {
      const key = `test:${crypto.randomUUID()}`;
      const rule = { limit: 10, windowSeconds: 60 };
      for (let i = 0; i < 10; i++)
        expect(await rateLimit(key, rule)).toBe(true);
      expect(await rateLimit(key, rule)).toBe(false);
      expect(await rateLimit(`test:${crypto.randomUUID()}`, rule)).toBe(true);
    });
  });

  describe("tokens", () => {
    it("work once, for their own purpose only", async () => {
      const user = await db.user.create({
        data: { email: uniqueEmail(), password: "x" },
      });
      const token = await issueToken("reset", user.id);
      expect(await consumeToken("verify", token)).toBeNull();
      expect(await consumeToken("reset", token)).toBe(user.id);
      expect(await consumeToken("reset", token)).toBeNull();
    });

    it("stop working when a newer one is issued or they expire", async () => {
      const user = await db.user.create({
        data: { email: uniqueEmail(), password: "x" },
      });
      const first = await issueToken("verify", user.id);
      const second = await issueToken("verify", user.id);
      expect(await consumeToken("verify", first)).toBeNull();

      await db.verificationToken.updateMany({
        where: { identifier: `verify:${user.id}` },
        data: { expires: new Date(Date.now() - 1000) },
      });
      expect(await consumeToken("verify", second)).toBeNull();
    });

    it("are stored hashed, never as sent", async () => {
      const user = await db.user.create({
        data: { email: uniqueEmail(), password: "x" },
      });
      const token = await issueToken("verify", user.id);
      expect(await db.verificationToken.count({ where: { token } })).toBe(0);
    });
  });

  describe("sign-up and verification", () => {
    it("stores the email lowercase, starts at 0 credits, and sends a confirmation link", async () => {
      const result = await actions.signUp({
        email: "  New.Person@Example.COM ",
        password: "a-good-password",
      });
      expect(result).toEqual({ success: true });

      const user = await db.user.findUniqueOrThrow({
        where: { email: "new.person@example.com" },
      });
      expect(user.credits).toBe(0);
      expect(user.emailVerified).toBeNull();
      expect(mocks.sent).toHaveLength(1);
      expect(mocks.sent[0]!.to).toBe("new.person@example.com");
      expect(mocks.sent[0]!.text).toContain(
        "http://localhost:3000/verify-email?token=",
      );
    });

    it("treats differently-cased emails as the same account", async () => {
      const email = uniqueEmail();
      await actions.signUp({ email, password: "a-good-password" });
      const again = await actions.signUp({
        email: email.toUpperCase(),
        password: "a-good-password",
      });
      expect(again).toEqual({ success: false, error: "Email already in use" });
    });

    it("can't store an uppercase email even by going around the app", async () => {
      await expect(
        db.user.create({
          data: { email: "Shouty@Example.com", password: "x" },
        }),
      ).rejects.toThrow();
    });

    it("grants the sign-up credits once, on the first confirmation", async () => {
      const email = uniqueEmail();
      await actions.signUp({ email, password: "a-good-password" });
      const user = await db.user.findUniqueOrThrow({ where: { email } });

      expect(await verifyEmail(linkToken(mocks.sent[0]!.text))).toBe(
        "verified",
      );
      // a second link, e.g. from "Resend email", confirms again but grants nothing more
      mocks.sessionUserId = user.id;
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: null },
      });
      const resent = await actions.resendVerificationEmail();
      expect(resent.success).toBe(true);
      expect(await verifyEmail(linkToken(mocks.sent[1]!.text))).toBe(
        "verified",
      );

      const after = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { credits: true, emailVerified: true, creditEntries: true },
      });
      expect(after.credits).toBe(SIGNUP_CREDITS);
      expect(after.emailVerified).not.toBeNull();
      expect(after.creditEntries.map((e) => e.reason)).toEqual([
        "SIGNUP_GRANT",
      ]);
    });

    it("refuses a used or made-up confirmation link", async () => {
      expect(await verifyEmail("not-a-real-token")).toBe("invalid");
    });

    it("limits sign-ups from one address", async () => {
      for (let i = 0; i < 10; i++) {
        await actions.signUp({
          email: uniqueEmail(),
          password: "a-good-password",
        });
      }
      const eleventh = await actions.signUp({
        email: uniqueEmail(),
        password: "a-good-password",
      });
      expect(eleventh.success).toBe(false);
      expect(eleventh.error).toMatch(/Too many attempts/);
    });
  });

  describe("requireVerifiedUserId", () => {
    it("refuses unverified accounts and allows verified ones", async () => {
      const user = await db.user.create({
        data: { email: uniqueEmail(), password: "x" },
      });
      mocks.sessionUserId = user.id;
      await expect(requireVerifiedUserId()).rejects.toBeInstanceOf(
        UnverifiedEmailError,
      );

      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      expect(await requireVerifiedUserId()).toBe(user.id);
    });

    it("refuses anonymous callers", async () => {
      await expect(requireVerifiedUserId()).rejects.toThrow("Unauthorized");
    });
  });

  describe("password reset", () => {
    it("sends a link only for real accounts, and answers the same either way", async () => {
      const email = uniqueEmail();
      await db.user.create({ data: { email, password: "x" } });

      expect(
        await actions.requestPasswordReset({ email: "nobody@example.com" }),
      ).toEqual({
        success: true,
      });
      expect(mocks.sent).toHaveLength(0);
      expect(
        await actions.requestPasswordReset({ email: email.toUpperCase() }),
      ).toEqual({
        success: true,
      });
      expect(mocks.sent.map((m) => m.to)).toEqual([email]);
    });

    it("sets the new password once per link", async () => {
      const email = uniqueEmail();
      await db.user.create({ data: { email, password: "old-hash" } });
      await actions.requestPasswordReset({ email });
      const token = linkToken(mocks.sent[0]!.text);

      expect(
        await actions.resetPassword({ token, password: "brand-new-password" }),
      ).toEqual({
        success: true,
      });
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      expect(await comparePasswords("brand-new-password", user.password)).toBe(
        true,
      );

      const reused = await actions.resetPassword({
        token,
        password: "another-password",
      });
      expect(reused.success).toBe(false);
    });
  });

  describe("sign-in", () => {
    type Authorize = (
      credentials: Record<string, unknown>,
      request: Request,
    ) => Promise<unknown>;
    const provider = authConfig.providers[0] as unknown as {
      options: { authorize: Authorize };
    };
    const signIn = (email: string, password: string) =>
      provider.options.authorize(
        { email, password },
        new Request("http://localhost/api/auth/callback/credentials", {
          headers: { "x-forwarded-for": mocks.ip },
        }),
      );

    it("accepts any casing of the email", async () => {
      const email = uniqueEmail();
      await actions.signUp({ email, password: "a-good-password" });
      const user = (await signIn(email.toUpperCase(), "a-good-password")) as {
        email: string;
      };
      expect(user.email).toBe(email);
    });

    it("refuses the 11th attempt in a minute for one email", async () => {
      const email = uniqueEmail();
      for (let i = 0; i < 10; i++) {
        newIp();
        expect(await signIn(email, "wrong-password")).toBeNull();
      }
      newIp();
      await expect(signIn(email, "wrong-password")).rejects.toMatchObject({
        code: "rate_limited",
      });
    });
  });
});
