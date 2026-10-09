export const CREDIT_PACKS = { small: 50, medium: 150, large: 500 } as const;

// credits bought by a Stripe price, or null for a price that isn't one of ours
export function creditsForPrice(
  priceId: string,
  prices: { small: string; medium: string; large: string },
): number | null {
  if (priceId === prices.small) return CREDIT_PACKS.small;
  if (priceId === prices.medium) return CREDIT_PACKS.medium;
  if (priceId === prices.large) return CREDIT_PACKS.large;
  return null;
}
