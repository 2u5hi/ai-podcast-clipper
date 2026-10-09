// Who runs the service and what it's called, in one place (PLAN.md: the clipper is a product of a company).
// The legal pages (Phase 1 commit 8) read these; change them here and every page follows.
export const BRAND = {
  // chosen 2026-10-09; add the legal suffix (e.g. "LLC") once the entity is formed
  companyName: "Soushi Technologies",
  // chosen 2026-10-09 (DivClip over DivClipt, which contains the existing "Clipt" clipping tool's name)
  productName: "DivClip",
  // the header logo, drawn as div/clip the way podcast/clipper was
  wordmark: ["div", "clip"],
  // the founder's inbox until the domain has its own address
  supportEmail: "dhanushannoji@gmail.com",
  governingLaw: "the State of Georgia, USA",
  // burned into clips made by accounts that haven't bought credits (ADR 0016); kept as DailyTech by choice for now
  houseWatermark: "DAILYTECH.AI",
} as const;
