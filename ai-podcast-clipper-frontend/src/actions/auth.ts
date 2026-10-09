"use server";

import { headers } from "next/headers";
import Stripe from "stripe";
import { env } from "~/env";
import { hashPassword } from "~/lib/auth";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
  type SignupFormValues,
} from "~/schemas/auth";
import {
  requestPasswordReset as sendResetLink,
  resetPassword as applyNewPassword,
  sendVerificationEmail,
  verifyEmail as applyVerification,
  type VerifyResult,
} from "~/server/accounts";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { clientIp, LIMITS, rateLimit } from "~/server/rate-limit";

type ActionResult = {
  success: boolean;
  error?: string;
};

const TOO_MANY = "Too many attempts. Please wait a while and try again.";

export async function signUp(data: SignupFormValues): Promise<ActionResult> {
  const validationResult = signupSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = validationResult.data;

  if (
    !(await rateLimit(
      `signup:ip:${clientIp(await headers())}`,
      LIMITS.signUpPerIp,
    ))
  ) {
    return { success: false, error: TOO_MANY };
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser) {
      return {
        success: false,
        error: "Email already in use",
      };
    }

    const hashedPassword = await hashPassword(password);

    // Try to create Stripe customer, but don't fail signup if Stripe isn't configured
    let stripeCustomerId: string | null = null;
    try {
      if (
        env.STRIPE_SECRET_KEY &&
        !env.STRIPE_SECRET_KEY.includes("placeholder")
      ) {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const stripeCustomer = await stripe.customers.create({ email });
        stripeCustomerId = stripeCustomer.id;
      }
    } catch (stripeError) {
      console.warn(
        "Stripe customer creation failed, continuing without:",
        stripeError,
      );
    }

    // no credits yet: they're granted when the email is confirmed
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        stripeCustomerId,
      },
      select: { id: true, email: true },
    });

    await sendVerificationEmail(user);

    return { success: true };
  } catch (error) {
    console.error("Signup failed:", error);
    return { success: false, error: "An error occured during signup" };
  }
}

export async function resendVerificationEmail(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return { success: false, error: "Unauthorized" };
  if (user.emailVerified) return { success: true };

  if (
    !(await rateLimit(
      `verify-email:user:${user.id}`,
      LIMITS.verificationEmailPerUser,
    ))
  ) {
    return { success: false, error: TOO_MANY };
  }

  await sendVerificationEmail(user);
  return { success: true };
}

export async function verifyEmail(token: string): Promise<VerifyResult> {
  return applyVerification(token);
}

export async function requestPasswordReset(
  data: ForgotPasswordFormValues,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Please enter a valid email address" };
  }
  const { email } = parsed.data;

  const ip = clientIp(await headers());
  const allowed =
    (await rateLimit(`reset:ip:${ip}`, LIMITS.passwordResetPerIp)) &&
    (await rateLimit(`reset:email:${email}`, LIMITS.passwordResetPerEmail));
  if (!allowed) return { success: false, error: TOO_MANY };

  await sendResetLink(email);
  // the same answer whether or not the account exists
  return { success: true };
}

export async function resetPassword(
  data: ResetPasswordFormValues,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  if (
    !(await rateLimit(
      `reset:ip:${clientIp(await headers())}`,
      LIMITS.passwordResetPerIp,
    ))
  ) {
    return { success: false, error: TOO_MANY };
  }

  const changed = await applyNewPassword(
    parsed.data.token,
    parsed.data.password,
  );
  return changed
    ? { success: true }
    : {
        success: false,
        error: "This reset link is invalid or has expired. Ask for a new one.",
      };
}
