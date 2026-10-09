"use server";

import { hashPassword } from "~/lib/auth";
import { signupSchema, type SignupFormValues } from "~/schemas/auth";
import { grantCredits } from "~/server/credits";
import { db } from "~/server/db";
import Stripe from "stripe";
import { env } from "~/env";

const SIGNUP_CREDITS = 10;

type SignupResult = {
  success: boolean;
  error?: string;
};

export async function signUp(data: SignupFormValues): Promise<SignupResult> {
  const validationResult = signupSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = validationResult.data;

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
        const stripeCustomer = await stripe.customers.create({
          email: email.toLowerCase(),
        });
        stripeCustomerId = stripeCustomer.id;
      }
    } catch (stripeError) {
      console.warn(
        "Stripe customer creation failed, continuing without:",
        stripeError,
      );
    }

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          stripeCustomerId,
        },
        select: { id: true },
      });
      await grantCredits(tx, {
        userId: user.id,
        amount: SIGNUP_CREDITS,
        reason: "SIGNUP_GRANT",
      });
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "An error occured during signup" };
  }
}
