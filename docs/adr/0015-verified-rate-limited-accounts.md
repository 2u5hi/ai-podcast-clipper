# 0015. Accounts are verified before they spend; rate limits live in Postgres

**Status:** accepted (2026-10-09)

## Context
Anyone could sign up with any address, collect 10 free credits of GPU time, and repeat; sign-in could be
guessed at any speed; there was no way back into an account with a forgotten password; and `Qa@Gmail.com`
and `qa@gmail.com` were different accounts ([LAUNCH_PLAN](../LAUNCH_PLAN.md) F6, F9).

## Decision
**Emails are lowercase everywhere.** The Zod schemas trim and lowercase every email field, and the database
refuses anything else (`CHECK (email = lower(btrim(email)))`). Existing addresses were already lowercase.

**Credits arrive with a confirmed email.** Sign-up creates the account with 0 credits and emails a link. The
`/verify-email` page confirms on a button press — mail scanners open links on their own, and a GET that
confirmed would spend the token first. Confirming sets `emailVerified` and grants `SIGNUP_GRANT` in one
transaction, and only if the ledger has no earlier `SIGNUP_GRANT` for that account. Accounts that existed
before this were marked verified by the migration.

**Spending needs a confirmed email.** `requireVerifiedUserId()` guards uploads, starting a job, YouTube links,
and checkout. Unverified users can sign in; the dashboard shows a banner with "Resend email" and disables
uploads.

**Password reset.** `/forgot-password` answers the same way whether or not the account exists. The link is
single-use and lasts an hour.

**Tokens** ([`tokens.ts`](../../ai-podcast-clipper-frontend/src/server/tokens.ts)) reuse Auth.js's
`VerificationToken` table, keyed `verify:<userId>` or `reset:<userId>`, stored as SHA-256 hashes. Issuing a
new one replaces the old; using one deletes it, and the delete is the claim, so two concurrent uses can't both
succeed.

**Rate limits are fixed-window counters in Postgres** ([`rate-limit.ts`](../../ai-podcast-clipper-frontend/src/server/rate-limit.ts)),
one upsert per check, instead of Upstash as first planned: the app already has a database, and this needs no
new account or secret. Limits: sign-in 10/min per email and 30/min per IP (the form says "too many attempts"
via a `rate_limited` code); sign-up 10/hour per IP; verification emails 3/hour per user; reset 3/hour per email
and 10/hour per IP; uploads and YouTube jobs 20/hour per user.

**Email** goes through Resend's HTTP API ([`mailer.ts`](../../ai-podcast-clipper-frontend/src/server/mailer.ts)).
`RESEND_API_KEY` and `EMAIL_FROM` are required in production; in development, without them, messages are
printed to the server log.

## Consequences
- Throwaway sign-ups cost a working inbox per 10 credits, and 10 per hour per address.
- Production can't send mail until a Resend account has a verified sending domain — part of Phase 1 commit 8, with the custom domain.
- A rate-limit check costs one database round trip; at this scale that's negligible, and the table can move to Redis later without changing callers.
- Sessions are still JWTs ([ADR 0006](0006-credentials-auth-with-jwt.md)): a password reset doesn't sign out other devices.
- Tested on a real Postgres (`src/server/accounts.db.test.ts`); removing the lowercasing, the sign-in limit, the verified check, single-use tokens, or the once-only grant each makes a test fail.
