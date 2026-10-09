"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { createCheckoutSession } from "~/actions/stripe";
import { BRAND } from "~/config/brand";
import { CREDIT_RULES, PACKS } from "~/config/pricing";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

// "buy" starts Stripe checkout (billing page); "signup" sends visitors to create an account (pricing page)
export function PricingCards({ mode }: { mode: "buy" | "signup" }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {PACKS.map((pack) => {
        const popular = "popular" in pack && pack.popular;
        const label = `Buy ${pack.credits} credits`;
        return (
          <Card
            key={pack.id}
            className={cn(
              "relative flex flex-col",
              popular && "border-primary border-2",
            )}
          >
            {popular && (
              <div className="bg-primary text-primary-foreground absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap">
                Most Popular
              </div>
            )}
            <CardHeader className="flex-1">
              <CardTitle>{pack.title}</CardTitle>
              <div className="text-4xl font-bold">{pack.price}</div>
              {"saving" in pack && (
                <p className="text-sm font-medium text-green-600">
                  {pack.saving}
                </p>
              )}
              <CardDescription>{pack.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-muted-foreground space-y-2 text-sm">
                {[
                  `${pack.credits} credits`,
                  "No expiration",
                  "Your own watermark, or none",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckIcon className="text-primary size-4" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {mode === "buy" ? (
                <form
                  action={() => createCheckoutSession(pack.id)}
                  className="w-full"
                >
                  <Button
                    variant={popular ? "default" : "outline"}
                    className="w-full"
                    type="submit"
                  >
                    {label}
                  </Button>
                </form>
              ) : (
                <Button
                  variant={popular ? "default" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link href="/signup">Get started</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export function CreditRules() {
  return (
    <div className="bg-muted/50 rounded-lg p-6">
      <h3 className="mb-4 text-lg font-semibold">How credits work</h3>
      <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
        {CREDIT_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
        <li>
          Clips from free credits carry the {BRAND.houseWatermark} watermark;
          once you buy any pack, use your own text or none, at no extra cost
        </li>
      </ul>
    </div>
  );
}

// shown wherever money changes hands or an account is created
export function AgreementNote({ action }: { action: string }) {
  return (
    <p className="text-muted-foreground text-center text-xs">
      By {action}, you agree to the{" "}
      <Link href="/terms" className="underline underline-offset-4">
        Terms of Service
      </Link>
      ,{" "}
      <Link href="/privacy" className="underline underline-offset-4">
        Privacy Policy
      </Link>
      , and{" "}
      <Link href="/refunds" className="underline underline-offset-4">
        Refund Policy
      </Link>
      .
    </p>
  );
}
