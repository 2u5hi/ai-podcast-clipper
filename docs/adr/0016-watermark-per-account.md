# 0016. The company's watermark on free clips; paying creators choose their own or none

**Status:** accepted (2026-10-09). Supersedes [ADR 0007](0007-burned-in-watermark.md)'s single global watermark;
burning the mark into the MP4 stands.

## Context
Every clip carried one watermark, set by the `WATERMARK_TEXT` Modal secret (`DAILYTECH.AI`) — including clips made
for customers, who won't pay to post someone else's brand. Charging extra credits for a creator's own watermark
was considered and rejected: the GPU cost is the same either way (the watermark pass already runs), and a
per-clip surcharge on branding would read as nickel-and-diming. Branding should be a reason to buy credits.

## Decision
**The rule is per account**, chosen over tracking free and paid credits separately: once an account has a
`PURCHASE` row in the ledger, every job uses the creator's `User.watermarkText`, or no watermark when it's
empty. Until then, jobs carry the house watermark from [`src/config/brand.ts`](../../ai-podcast-clipper-frontend/src/config/brand.ts),
which also holds the company and product names as placeholders until they're chosen.

**Decided once per job**, in the `reserve-credits` step ([`functions.ts`](../../ai-podcast-clipper-frontend/src/inngest/functions.ts)),
and sent to Modal as `watermark_text` (`null` = none), so a replayed run brands its clips the same way.

**The text is never parsed.** It's printable ASCII, 1–40 characters — checked by the web app, the worker
([`watermark.py`](../../ai-podcast-clipper-backend/watermark.py)), and a database `CHECK` — written to a file,
and drawn with `drawtext=textfile=…:expansion=none`, so quotes, colons, `%`, backslashes, and `%{…}` render
literally.

**Settings.** `/dashboard/settings` lets paying accounts set or clear their text; others see what they'd get
by buying a pack. The billing page says so, and no longer claims a credit is a minute of processing (LAUNCH_PLAN F15).

## Consequences
- An account that buys the smallest pack once can spend its remaining free credits without the house mark. Accepted: they're a paying customer by then.
- Callers that don't send `watermark_text` still get the `WATERMARK_TEXT` secret, so older callers keep working.
- Only text, only top-right, one font. Logo images, fonts, colours, and placement are the Phase 3 brand kit.
- Tested on Postgres (the house mark before a purchase, none or the creator's text after, refusals for free accounts and invalid text), with the rule mutated to confirm the tests catch it; the drawtext filter was checked with tricky text locally and on Modal.
