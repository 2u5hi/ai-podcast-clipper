import { db } from "~/server/db";

// Fixed-window counters in Postgres (ADR 0015): one upsert per check, no extra service to run.

export const LIMITS = {
  signInPerEmail: { limit: 10, windowSeconds: 60 },
  signInPerIp: { limit: 30, windowSeconds: 60 },
  signUpPerIp: { limit: 10, windowSeconds: 3600 },
  verificationEmailPerUser: { limit: 3, windowSeconds: 3600 },
  passwordResetPerEmail: { limit: 3, windowSeconds: 3600 },
  passwordResetPerIp: { limit: 10, windowSeconds: 3600 },
  jobsPerUser: { limit: 20, windowSeconds: 3600 },
} as const;

// Counts this attempt and says whether it is within the limit.
export async function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;

  // old windows are never read again; clear them out now and then
  if (Math.random() < 0.01) {
    await db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < ${new Date(Date.now() - 86_400_000)}`;
  }

  return (rows[0]?.count ?? 0) <= limit;
}

// the caller's address as Vercel reports it; "unknown" locally
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ?? headers.get("x-real-ip") ?? "unknown";
}
