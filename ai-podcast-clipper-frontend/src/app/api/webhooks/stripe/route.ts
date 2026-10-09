// stripe listen --forward-to localhost:3000/api/webhooks/stripe

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "~/env";
import { creditsForPrice } from "~/lib/credit-packs";
import { grantCredits } from "~/server/credits";
import { db } from "~/server/db";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
});

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

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
        ? creditsForPrice(priceId, {
            small: env.STRIPE_SMALL_CREDIT_PACK,
            medium: env.STRIPE_MEDIUM_CREDIT_PACK,
            large: env.STRIPE_LARGE_CREDIT_PACK,
          })
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
        // Stripe retries deliveries; the unique event id means this one was already applied
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return new NextResponse(null, { status: 200 });
        }
        throw error;
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Webhook error", { status: 500 });
  }
}
