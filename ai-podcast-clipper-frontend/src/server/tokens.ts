import { createHash, randomBytes } from "node:crypto";
import { db } from "~/server/db";

// One-time tokens for email links, stored in Auth.js's VerificationToken table as SHA-256 hashes,
// so a leaked database can't be used to verify or reset an account.

const LIFETIME_MS = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
} as const;

export type TokenPurpose = keyof typeof LIFETIME_MS;

function hash(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// Issues a fresh token, replacing any earlier one for the same purpose and user.
export async function issueToken(
  purpose: TokenPurpose,
  userId: string,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const identifier = `${purpose}:${userId}`;
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier } }),
    db.verificationToken.create({
      data: {
        identifier,
        token: hash(raw),
        expires: new Date(Date.now() + LIFETIME_MS[purpose]),
      },
    }),
  ]);
  return raw;
}

// Uses up a token. Returns its user id, or null when it is unknown, expired, already used, or for another purpose.
export async function consumeToken(
  purpose: TokenPurpose,
  raw: string,
): Promise<string | null> {
  const token = hash(raw);
  const row = await db.verificationToken.findUnique({ where: { token } });
  if (!row?.identifier.startsWith(`${purpose}:`)) return null;

  // deleting is the claim: of two concurrent uses, only one deletes the row
  const claimed = await db.verificationToken.deleteMany({ where: { token } });
  if (claimed.count !== 1 || row.expires < new Date()) return null;

  return row.identifier.slice(purpose.length + 1);
}
