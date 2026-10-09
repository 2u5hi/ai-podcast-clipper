// stripe listen --forward-to localhost:3000/api/webhooks/stripe

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "~/env";
import { creditsForPrice } from "~/lib/credit-packs";
import { grantCredits, revokeRefundedCredits } from "~/server/credits";
import { db } from "~/server/db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
});

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

const packPrices = {
  small: env.STRIPE_SMALL_CREDIT_PACK,
  medium: env.STRIPE_MEDIUM_CREDIT_PACK,
  large: env.STRIPE_LARGE_CREDIT_PACK,
};

// Stripe retries deliveries; a unique-id violation on the ledger means this event was already applied
function alreadyApplied(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed", error);
      return new NextResponse("Webhook signature verification failed", {
        status: 400,
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // delayed payment methods complete checkout before the money arrives
      if (session.payment_status !== "paid") {
        return new NextResponse(null, { status: 200 });
      }
      const customerId = session.customer as string;

      const retrievedSession = await stripe.checkout.sessions.retrieve(
        session.id,
        { expand: ["line_items"] },
      );
      const priceId = retrievedSession.line_items?.data[0]?.price?.id;
      const creditsToAdd = priceId
        ? creditsForPrice(priceId, packPrices)
        : null;
      if (!creditsToAdd) {
        console.error(
          `Checkout ${session.id} has no known credit pack price (${priceId})`,
        );
        return new NextResponse(null, { status: 200 });
      }

      const user = await db.user.findUniqueOrThrow({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });

      try {
        await db.$transaction((tx) =>
          grantCredits(tx, {
            userId: user.id,
            amount: creditsToAdd,
            reason: "PURCHASE",
            stripeEventId: event.id,
          }),
        );
      } catch (error) {
        if (alreadyApplied(error))
          return new NextResponse(null, { status: 200 });
        throw error;
      }
    }

    // a refund takes the pack's credits back (F17); partial refunds are left to a manual adjustment
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!charge.refunded || !paymentIntent) {
        return new NextResponse(null, { status: 200 });
      }

      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntent,
        expand: ["data.line_items"],
      });
      const session = sessions.data[0];
      const priceId = session?.line_items?.data[0]?.price?.id;
      const credits = priceId ? creditsForPrice(priceId, packPrices) : null;
      if (!session || !credits) {
        console.error(
          `Refunded charge ${charge.id} isn't a credit pack purchase (${priceId})`,
        );
        return new NextResponse(null, { status: 200 });
      }

      const user = await db.user.findUniqueOrThrow({
        where: { stripeCustomerId: session.customer as string },
        select: { id: true },
      });

      try {
        await db.$transaction((tx) =>
          revokeRefundedCredits(tx, {
            userId: user.id,
            amount: credits,
            stripeEventId: event.id,
          }),
        );
      } catch (error) {
        if (alreadyApplied(error))
          return new NextResponse(null, { status: 200 });
        throw error;
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Webhook error", { status: 500 });
  }
}
