# Production runbook: launching DivClip for free

Phase 1 commit 9 in [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md). Everything here is on free tiers
([ADR 0017](adr/0017-launch-on-free-tiers.md)); nothing requires a paid upgrade or a domain. Steps run top to
bottom, and each says who does it.

**Never paste a secret into chat or a commit.** Put keys straight into the host's environment settings or the
Modal secret; the ones Claude needs locally go in the gitignored `.env` files.

`<site>` below means the live address, e.g. `https://divclip.netlify.app`.

---

## A. Decide

| # | Who | Step |
|---|---|---|
| A1 | You | Pick the host: **Netlify free** (commercial use appears allowed) or **Vercel Hobby** (free, but non-commercial only, so real payments would need Pro at $20/month). See ADR 0017 |

## B. Free accounts and settings

| # | Who | Step |
|---|---|---|
| B1 | You | Host: create a site from the GitHub repo `2u5hi/ai-podcast-clipper`, base directory `ai-podcast-clipper-frontend`; choose the free subdomain (try `divclip`). The first build may fail until C4 is done |
| B2 | You | Gmail: turn on 2-Step Verification, then create an **app password** (Google Account → Security → App passwords). Put it in the host's env as `SMTP_PASSWORD` (C4), never in chat |
| B3 | You | Inngest Cloud (free): create the production app and copy the event and signing keys into the host's env (C4). On Vercel, the Inngest integration does this |
| B4 | You | GitHub → repo Settings → Secrets and variables → Actions → **Variables** → `APP_URL` = `<site>`, which turns on the daily keep-alive |
| B5 | You | Stripe → activate live payments **as an individual** (bank account and identity; no company needed). This can take days, so start early |
| B6 | You (optional) | DMCA designated agent at copyright.gov (about $6); a lawyer's review of the policies |

## C. Credentials

| # | Who | Step |
|---|---|---|
| C1 | Claude, with your OK | AWS: create IAM user `divclip-app` with [`infra/iam-app-policy.json`](../infra/iam-app-policy.json), create its access key, and apply [`infra/s3-cors.json`](../infra/s3-cors.json) once `<site>` is known. Then deactivate the old `dark-phoenix-dev` keys and stop using `loanlens-dev`'s here |
| C2 | Claude, with your OK | Rotate the Modal secret `ai-podcast-clipper-secret`: new `AUTH_TOKEN`, the `divclip-app` AWS key, `GEMINI_API_KEY`, `S3_BUCKET_NAME`, `AWS_REGION` |
| C3 | You | Supabase (free) → reset the database password; put the new `DATABASE_URL` in the host's env and both local `.env` files |
| C4 | You | Host → environment variables (production), listed below |
| C5 | You | Stripe (live mode, once B5 is approved): three one-time prices — $9.99, $24.99, $69.99 — and a webhook to `<site>/api/webhooks/stripe` for `checkout.session.completed` and `charge.refunded`; copy the price IDs, webhook secret, and keys into the host's env |

**Production environment variables**

| Variable | Value |
|---|---|
| `DATABASE_URL` | from C3 |
| `AUTH_SECRET` | new: `npx auth secret` or 32 random bytes; never reuse the local one |
| `BASE_URL` | `<site>` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `divclip-app` key from C1 |
| `AWS_REGION`, `S3_BUCKET_NAME` | `us-east-2`, `dark-phoenix-dev` |
| `PROCESS_VIDEO_ENDPOINT` | the Modal URL (unchanged) |
| `PROCESS_VIDEO_ENDPOINT_AUTH` | the new `AUTH_TOKEN` from C2 |
| `SMTP_USER`, `SMTP_PASSWORD` | your Gmail address; the app password from B2 |
| `EMAIL_FROM` | `DivClip <your Gmail address>` |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | live keys (test keys until B5 is approved) |
| `STRIPE_WEBHOOK_SECRET` | from the webhook in C5 |
| `STRIPE_SMALL_CREDIT_PACK`, `STRIPE_MEDIUM_CREDIT_PACK`, `STRIPE_LARGE_CREDIT_PACK` | price IDs from C5 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | from B3 |
| `YOUTUBE_INGESTION_ENABLED` | leave unset (off, ADR 0012) |
| `INNGEST_DEV` | **never set in production** |

## D. Deploy and verify (Claude)

| # | Step |
|---|---|
| D1 | Apply pending migrations (5, 6) to the live database with `prisma migrate deploy`. On Vercel the `vercel-build` script does it on production deploys; on Netlify, Claude runs it before the first deploy |
| D2 | `SMOKE_BASE_URL=<site> SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke` with a dedicated, verified test account |
| D3 | A sign-up on `<site>` receives the confirmation email from Gmail |
| D4 | One real job end to end: upload a short video and watch it reserve, process, deliver, and settle |
| D5 | Once Stripe live is approved: you buy the small pack with a real card; Claude checks the credits and ledger row; you refund it in Stripe; Claude checks the refund took the credits back (F17) |

## E. Clean up (your call each)

- Delete the `qa@gmail.com` account (password `1234`) and the `smoketest+…@example.com` accounts from the production database.
- Delete the `smoketest-…` folders in S3 once you've looked at them.
- Retire the old Vercel project `dark-pheonix-dev`, which still runs the June code against this database.
- Set spending alerts where they're free: Google Cloud (Gemini), Modal (spend limit), AWS (budgets).

## Later, once it sells

A domain (~$10/year) with Resend for email from your own address; a company for the Stripe account; whatever
the host's plan needs at volume. See ADR 0017.
