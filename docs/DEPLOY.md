# Production runbook: launching DivClip

Phase 1 commit 9 in [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md). Steps run top to bottom; each says who does it.
**Never paste a secret into chat or a commit.** Put keys straight into Vercel's environment settings or the
Modal secret; the ones Claude needs locally go in the gitignored `.env` files.

Assumes the domain **divclip.com**. If it's different, change it here, in `infra/s3-cors.json`, and in the
Vercel and Stripe settings below.

---

## A. Start now (slow)

| # | Who | Step | Why it's first |
|---|---|---|---|
| A1 | You | Decide Soushi Technologies' legal form with a Georgia CPA or lawyer, and form it with the Secretary of State | The Stripe account belongs to that entity; moving customers to a new Stripe account later is painful |
| A2 | You | Stripe → activate live payments: business details, bank account, identity | Verification can take days |
| A3 | You | Buy **divclip.com** (Cloudflare or Namecheap) | Email, Vercel, CORS, and Stripe all point at it |
| A4 | You | Lawyer review of `/terms`, `/privacy`, `/refunds` (optional but recommended) | They're plain-language drafts from how the app works, not legal advice |
| A5 | You | Register a DMCA designated agent at copyright.gov (about $6) | Safe harbor for content users upload |

## B. Accounts (minutes each)

| # | Who | Step |
|---|---|---|
| B1 | You | Supabase → upgrade the project to Pro, so it stops pausing (F10) |
| B2 | You | Resend → add divclip.com, create the DNS records it lists at your registrar, wait for "Verified" |
| B3 | You | Vercel → New Project → import `2u5hi/ai-podcast-clipper`, **Root Directory `ai-podcast-clipper-frontend`**, framework Next.js. Add the domain divclip.com. Don't worry if the first build fails: it has no environment yet. (Or authorize the Vercel connector with `/mcp` and Claude can do this step and C4.) |
| B4 | You | Inngest Cloud → production environment → install the **Inngest Vercel integration** for the new project (it sets `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` and syncs `/api/inngest` on each deploy) |
| B5 | You | Sentry (optional at launch) → a Next.js project and a Python project; give Claude the two DSNs via `.env` to wire them in |

## C. Credentials

| # | Who | Step |
|---|---|---|
| C1 | Claude, with your OK | AWS: create IAM user `divclip-app` with [`infra/iam-app-policy.json`](../infra/iam-app-policy.json) (get/put objects and list one bucket, nothing else), create its access key, apply [`infra/s3-cors.json`](../infra/s3-cors.json) to the bucket. The new key goes to Vercel (C4) and Modal (C2); then the old `dark-phoenix-dev` keys are deactivated and `loanlens-dev`'s keys are removed from this app |
| C2 | Claude, with your OK | Rotate the Modal secret `ai-podcast-clipper-secret`: new `AUTH_TOKEN`, the `divclip-app` AWS key, `GEMINI_API_KEY`, `S3_BUCKET_NAME`, `AWS_REGION` |
| C3 | You | Supabase → reset the database password; put the new `DATABASE_URL` in Vercel and in both local `.env` files |
| C4 | You (or Claude via the connector) | Vercel → Settings → Environment Variables (Production), listed below |
| C5 | You | Stripe (live mode): three one-time prices — $9.99, $24.99, $69.99 — and a webhook to `https://divclip.com/api/webhooks/stripe` for `checkout.session.completed` and `charge.refunded`; copy the price IDs, webhook secret, and API keys into Vercel |

**Vercel production environment**

| Variable | Value |
|---|---|
| `DATABASE_URL` | from C3 |
| `AUTH_SECRET` | new: `npx auth secret` or 32 random bytes; never reuse the local one |
| `BASE_URL` | `https://divclip.com` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `divclip-app` key from C1 |
| `AWS_REGION`, `S3_BUCKET_NAME` | `us-east-2`, `dark-phoenix-dev` |
| `PROCESS_VIDEO_ENDPOINT` | the Modal URL (unchanged) |
| `PROCESS_VIDEO_ENDPOINT_AUTH` | the new `AUTH_TOKEN` from C2 |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | live keys |
| `STRIPE_WEBHOOK_SECRET` | from the live webhook |
| `STRIPE_SMALL_CREDIT_PACK`, `STRIPE_MEDIUM_CREDIT_PACK`, `STRIPE_LARGE_CREDIT_PACK` | live price IDs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key; `DivClip <noreply@divclip.com>` |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | set by the integration (B4) |
| `YOUTUBE_INGESTION_ENABLED` | leave unset (off, ADR 0012) |
| `INNGEST_DEV` | **never set in production** |

## D. Deploy and verify (Claude)

| # | Step |
|---|---|
| D1 | Deploy production. The `vercel-build` script applies pending migrations (`prisma migrate deploy`) only when `VERCEL_ENV=production`, then builds |
| D2 | `SMOKE_BASE_URL=https://divclip.com SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke` with a dedicated, verified test account |
| D3 | One real job end to end: upload a short video, watch it reserve, process, deliver, settle |
| D4 | You buy the small pack with a real card; Claude checks the credits and ledger row; you refund it in Stripe; Claude checks the refund took the credits back (F17) |
| D5 | Sign-up on the live domain receives the confirmation email from Resend |

## E. Clean up (your call each)

- Delete the `qa@gmail.com` account (password `1234`) and the `smoketest+…@example.com` accounts from the production database.
- Delete the `smoketest-…` folders in S3 once you've looked at them.
- Retire the old Vercel project `dark-pheonix-dev`, which still runs the June code against this database.
- Set billing alerts: Google Cloud (Gemini), Modal (spend limit), AWS, Supabase.
