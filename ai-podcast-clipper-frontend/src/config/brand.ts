// Who runs the service and what it's called, in one place (PLAN.md: the clipper is a product of a company).
// Values in [brackets] are placeholders until they're chosen; the legal pages (Phase 1 commit 8) need them.
export const BRAND = {
  companyName: "[Company name]",
  productName: "Podcast Clipper",
  supportEmail: "[support@yourdomain.com]",
  governingCountry: "[Country]",
  // burned into clips made by accounts that haven't bought credits (ADR 0016); today's mark until the company has a name
  houseWatermark: "DAILYTECH.AI",
} as const;
