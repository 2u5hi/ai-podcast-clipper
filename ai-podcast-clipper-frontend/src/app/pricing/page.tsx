import { type Metadata } from "next";
import Link from "next/link";
import { AgreementNote, CreditRules, PricingCards } from "~/components/pricing";
import { BRAND } from "~/config/brand";

export const metadata: Metadata = {
  title: `Pricing · ${BRAND.productName}`,
};

export default function PricingPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col space-y-8 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Pricing
        </h1>
        <p className="text-muted-foreground">
          Pay per clip with credit packs. No subscription. New accounts get 10
          free credits once they confirm their email.
        </p>
      </div>

      <PricingCards mode="signup" />
      <AgreementNote action="creating an account or buying credits" />
      <CreditRules />

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/dashboard/billing"
          className="underline underline-offset-4"
        >
          Buy credits
        </Link>
      </p>
    </main>
  );
}
