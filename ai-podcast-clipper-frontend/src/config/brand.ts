// Who runs the service and what it's called, in one place (PLAN.md: the clipper is a product of a company).
// Values in [brackets] are placeholders until they're chosen; the legal pages (Phase 1 commit 8) need them.
export const BRAND = {
  // chosen 2026-10-09; add the legal suffix (e.g. "LLC") once the entity is formed
  companyName: "Soushi Technologies",
  productName: "Podcast Clipper",
  supportEmail: "[support@yourdomain.com]",
  governingCountry: "[Country]",
  // burned into clips made by accounts that haven't bought credits (ADR 0016); kept as DailyTech by choice for now
  houseWatermark: "DAILYTECH.AI",
} as const;
