import { BRAND } from "~/config/brand";
import { db } from "~/server/db";

// The watermark rule is per account (ADR 0016): once an account has bought credits, every job uses
// the creator's own text, or none; until then, the house watermark.

export async function hasPurchasedCredits(userId: string): Promise<boolean> {
  const purchase = await db.creditLedgerEntry.findFirst({
    where: { userId, reason: "PURCHASE" },
    select: { id: true },
  });
  return purchase !== null;
}

// the text to burn into a job's clips, or null for no watermark
export async function watermarkForJob(userId: string): Promise<string | null> {
  if (!(await hasPurchasedCredits(userId))) return BRAND.houseWatermark;
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { watermarkText: true },
  });
  return user.watermarkText;
}
