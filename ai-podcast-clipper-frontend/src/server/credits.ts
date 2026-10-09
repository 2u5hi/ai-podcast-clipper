import { type CreditReason, type Prisma } from "@prisma/client";

// The only code that changes User.credits: each change writes a ledger row in the same transaction (ADR 0013).
// Callers pass a transaction client from db.$transaction.

type Tx = Prisma.TransactionClient;

export async function grantCredits(
  tx: Tx,
  entry: {
    userId: string;
    amount: number;
    reason: Extract<
      CreditReason,
      "SIGNUP_GRANT" | "PURCHASE" | "ADMIN_ADJUSTMENT"
    >;
    stripeEventId?: string;
  },
) {
  if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) {
    throw new Error(`Invalid credit amount: ${entry.amount}`);
  }
  // the ledger row goes first: a duplicate Stripe event fails on its unique id before the balance moves
  await tx.creditLedgerEntry.create({
    data: {
      userId: entry.userId,
      delta: entry.amount,
      reason: entry.reason,
      stripeEventId: entry.stripeEventId,
    },
  });
  await tx.user.update({
    where: { id: entry.userId },
    data: { credits: { increment: entry.amount } },
  });
}

// Takes up to `max` credits for a job, or as many as the user has. Returns how many were taken.
export async function reserveCredits(
  tx: Tx,
  job: { userId: string; uploadedFileId: string; max: number },
): Promise<number> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: job.userId },
    select: { credits: true },
  });
  const amount = Math.min(user.credits, job.max);
  if (amount <= 0) return 0;

  // conditional on the balance read above, so a concurrent change makes this take nothing rather than overdraw
  const taken = await tx.user.updateMany({
    where: { id: job.userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  if (taken.count === 0) return 0;

  await tx.creditLedgerEntry.create({
    data: {
      userId: job.userId,
      delta: -amount,
      reason: "JOB_RESERVE",
      uploadedFileId: job.uploadedFileId,
    },
  });
  return amount;
}

// Returns the unused part of a job's reservation.
export async function refundCredits(
  tx: Tx,
  job: { userId: string; uploadedFileId: string; amount: number },
) {
  if (job.amount <= 0) return;
  await tx.creditLedgerEntry.create({
    data: {
      userId: job.userId,
      delta: job.amount,
      reason: "JOB_REFUND",
      uploadedFileId: job.uploadedFileId,
    },
  });
  await tx.user.update({
    where: { id: job.userId },
    data: { credits: { increment: job.amount } },
  });
}
