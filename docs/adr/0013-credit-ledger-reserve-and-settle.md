# 0013. Credits move through a ledger; jobs reserve, then settle

**Status:** accepted (2026-10-09). Supersedes the charging rules in [ADR 0005](0005-credits-per-clip.md); the unit (one credit = one delivered clip) is unchanged.

## Context
Billing was a single `User.credits` number changed in five places, and it was wrong in four ways
([LAUNCH_PLAN](../LAUNCH_PLAN.md) F4, F5): a retried Stripe webhook added credits twice; a user with 1 credit
got up to 5 clips; the recovery path could drive a balance negative; and nothing recorded why a balance
changed, so a disputed charge couldn't be reconstructed.

## Decision
**One code path, one ledger.** Every change to `User.credits` goes through
[`src/server/credits.ts`](../../ai-podcast-clipper-frontend/src/server/credits.ts) and writes a
`CreditLedgerEntry` (signed `delta`, a `CreditReason`, the job or Stripe event) in the same transaction. The
migration gave every existing balance an `OPENING_BALANCE` row, so a balance always equals the sum of its
user's ledger. Sign-up's 10 credits are a `SIGNUP_GRANT` row; the column default is now 0.

**The database enforces what it can.** `CHECK (credits >= 0)` on `User`, and a unique index on
`CreditLedgerEntry.stripeEventId`. The webhook writes the ledger row before the balance, so a redelivered event
fails on the unique id and changes nothing; the handler treats that as already done and answers 200.

**Jobs reserve, then settle** ([`functions.ts`](../../ai-podcast-clipper-frontend/src/inngest/functions.ts)):

1. `reserve-credits` takes `min(balance, 5)` with a conditional update, recorded as `JOB_RESERVE`. Zero means `no credits` and no GPU work.
2. Modal is called with `max_clips` = the reservation, and [`select_moments`](../../ai-podcast-clipper-backend/moments.py) never returns more.
3. `create-clips-in-db` records at most the reserved number of clips found under the job's prefix.
4. `settle-credits` refunds `reserved − delivered` as `JOB_REFUND`. On failure — after checking S3 for clips that landed anyway ([ADR 0009](0009-recover-runs-from-s3.md)) — the same refund runs, which is all of it when nothing was delivered.

Every side effect is inside an Inngest step, so a replayed run repeats none of them.

## Consequences
- A failed job, or one that finds no moments, leaves the balance where it started; the ledger shows a reserve and an equal refund.
- While a job runs, its reservation is out of the balance, so the dashboard shows fewer credits until it settles.
- Tested against a real Postgres built from the migrations (`src/server/billing.db.test.ts`, also in CI), including a webhook delivered three times and a failing pipeline; mutating the fixes makes those tests fail.
- **The unit is still per clip.** The smoke tests put a 75-second source at ~150s of L40S time for 2 clips; per-clip pricing can lose money on long episodes, where transcription grows with length. Choosing the unit and the pack prices is a business decision that needs per-job cost tracking (Phase 2) and is left open in [`PLAN.md`](../PLAN.md).
- Added 2026-10-10: a full Stripe refund takes the pack's credits back as `PURCHASE_REFUND`, capped at the balance and keyed on the refund event's id (LAUNCH_PLAN F17).
