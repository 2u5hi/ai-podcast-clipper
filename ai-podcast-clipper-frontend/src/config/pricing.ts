import { CREDIT_PACKS } from "~/lib/credit-packs";

// What the billing and pricing pages show. The amounts charged are the Stripe prices
// (STRIPE_*_CREDIT_PACK); keep these labels in step with them.
export const PACKS = [
  {
    id: "small",
    title: "Small Pack",
    price: "$9.99",
    credits: CREDIT_PACKS.small,
    description: "For trying it on a few episodes",
  },
  {
    id: "medium",
    title: "Medium Pack",
    price: "$24.99",
    credits: CREDIT_PACKS.medium,
    description: "Best value for regular podcasters",
    popular: true,
    saving: "Save 17%",
  },
  {
    id: "large",
    title: "Large Pack",
    price: "$69.99",
    credits: CREDIT_PACKS.large,
    description: "For studios and agencies",
    saving: "Save 30%",
  },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

// How credits work, in the words both pages use
export const CREDIT_RULES = [
  "1 credit = 1 finished clip; each video makes up to 5 clips",
  "You only pay for clips you get: if a video fails or has no clip-worthy moments, its credits come back",
  "Credits never expire, and all packs are one-time purchases (no subscription)",
] as const;
