# 0005. A credit is one delivered clip, charged after the job

**Status:** accepted (2026-06), recorded retroactively. The charging rules are superseded by [ADR 0013](0013-credit-ledger-reserve-and-settle.md); the unit stands

## Context
Users buy credit packs. The question is what a credit buys and when it is taken.

## Decision (as built)
Charge after the pipeline finishes, one credit per clip found in S3, capped at the current balance
([`functions.ts`](../../ai-podcast-clipper-frontend/src/inngest/functions.ts)):

```ts
credits: { decrement: Math.min(credits, clipsFound) },
```

A job with zero balance doesn't start (`no credits`). A job that finds no moments charges nothing.

## Consequences
- Users aren't charged for failures or empty results.
- **Undercharging:** a user with 1 credit receives up to 5 clips for 1 credit.
- The recovery path ([ADR 0009](0009-recover-runs-from-s3.md)) decrements without the cap and can drive a balance negative.
- Credit changes aren't recorded anywhere but the balance, so a disputed charge can't be reconstructed.
- GPU cost tracks minutes of source video, not clips, so per-clip pricing can lose money on long episodes. Phase 1 commit 4 decides the unit using cost-per-job data and adds a credit ledger.
