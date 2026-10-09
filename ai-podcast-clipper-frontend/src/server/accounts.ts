import { BRAND } from "~/config/brand";
import { env } from "~/env";
import { hashPassword } from "~/lib/auth";
import { auth } from "~/server/auth";
import { grantCredits } from "~/server/credits";
import { db } from "~/server/db";
import { sendEmail } from "~/server/mailer";
import { consumeToken, issueToken } from "~/server/tokens";

// free credits arrive with a verified email, not with sign-up (ADR 0015)
export const SIGNUP_CREDITS = 10;

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
}) {
  const token = await issueToken("verify", user.id);
  await sendEmail({
    to: user.email,
    subject: `Confirm your email for ${BRAND.productName}`,
    text:
      `Confirm your email to start making clips (and get ${SIGNUP_CREDITS} free credits):\n\n` +
      `${env.BASE_URL}/verify-email?token=${token}\n\n` +
      "The link works for 24 hours. If you didn't sign up, ignore this email.",
  });
}

export type VerifyResult = "verified" | "invalid";

// Marks the email verified and grants the sign-up credits, both at most once per account.
export async function verifyEmail(rawToken: string): Promise<VerifyResult> {
  const userId = await consumeToken("verify", rawToken);
  if (!userId) return "invalid";

  await db.$transaction(async (tx) => {
    const firstTime = await tx.user.updateMany({
      where: { id: userId, emailVerified: null },
      data: { emailVerified: new Date() },
    });
    // the ledger is the record of what was granted, so it decides, not the verified flag alone
    const alreadyGranted = await tx.creditLedgerEntry.findFirst({
      where: { userId, reason: "SIGNUP_GRANT" },
      select: { id: true },
    });
    if (firstTime.count === 1 && !alreadyGranted) {
      await grantCredits(tx, {
        userId,
        amount: SIGNUP_CREDITS,
        reason: "SIGNUP_GRANT",
      });
    }
  });
  return "verified";
}

// Sends a reset link if the account exists; says nothing either way, so emails can't be probed.
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) return;

  const token = await issueToken("reset", user.id);
  await sendEmail({
    to: user.email,
    subject: `Reset your ${BRAND.productName} password`,
    text:
      `Choose a new password:\n\n${env.BASE_URL}/reset-password?token=${token}\n\n` +
      "The link works for one hour. If you didn't ask for this, ignore this email; your password hasn't changed.",
  });
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const userId = await consumeToken("reset", rawToken);
  if (!userId) return false;

  await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword) },
  });
  return true;
}

export class UnverifiedEmailError extends Error {
  constructor() {
    super("Confirm your email first; check your inbox for the link");
  }
}

// The signed-in user's id, for actions that spend credits or money.
export async function requireVerifiedUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!user) throw new Error("Unauthorized");
  if (!user.emailVerified) throw new UnverifiedEmailError();
  return session.user.id;
}
