import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { AgreementNote, CreditRules, PricingCards } from "~/components/pricing";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export default function BillingPage() {
  return (
    <div className="mx-auto flex flex-col space-y-8 px-4 py-12">
      <div className="relative flex items-center justify-center gap-4">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "absolute top-0 left-0",
          )}
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            Buy Credits
          </h1>
          <p className="text-muted-foreground">
            Purchase credits to generate more clips. The more credits you buy,
            the better the value.
          </p>
        </div>
      </div>

      <PricingCards mode="buy" />
      <AgreementNote action="buying credits" />
      <CreditRules />
    </div>
  );
}
