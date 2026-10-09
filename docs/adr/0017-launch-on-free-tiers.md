# 0017. Launch on free tiers; pay for nothing until it sells

**Status:** accepted (2026-10-10). Host: Netlify's free plan.

## Context
The first launch runbook assumed paid upgrades: Supabase Pro ($25/month) to stop pausing, a domain (~$10/year)
for Resend email and a custom address, and a company formed before Stripe. The owner won't spend on upgrades
or a domain before the product makes sales.

## Decision
| Need | Free answer |
|---|---|
| Database that doesn't pause | Stay on Supabase's free plan. Supabase pauses free projects after 7 days of low database activity, so `.github/workflows/keepalive.yml` calls `/api/health` (one `SELECT 1`) daily. It's free on a public repo, and a failing ping emails the owner, which doubles as a free uptime alert |
| Address | The host's free subdomain (e.g. `divclip.netlify.app`) until a domain is worth buying |
| Email | Gmail SMTP with an app password (`SMTP_USER`/`SMTP_PASSWORD`), roughly 500 messages a day on a personal account. Resend stays supported: [`mailer.ts`](../../ai-podcast-clipper-frontend/src/server/mailer.ts) uses it whenever `RESEND_API_KEY` is set, which needs a verified domain. Production refuses to start sending with neither configured |
| Payments | Stripe has no monthly fee; it can be activated as an individual, so no company has to be formed first |
| GPU, queue, storage, AI | Already pay-as-you-go or free at this scale: Modal (monthly free credit), Inngest (free tier), S3 (pennies), Gemini ($5 prepaid plus the free tier, both disclosed in the privacy policy) |
| Error tracking | Optional; Sentry's free tier if wanted |

**Hosting: Netlify's free plan** (chosen 2026-10-10). Vercel Hobby was the alternative, but its fair-use
guidelines limit it to non-commercial use and count collecting payments as commercial; Netlify's free plan
appears to allow commercial use (the main restriction is reselling hosting, per Netlify's forum; check the
current Terms of Use). What Netlify needs, in the repo:
- [`netlify.toml`](../../netlify.toml): base directory, Node 22, and the build command `node scripts/build.mjs`, which applies migrations only when `CONTEXT=production`.
- `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in the Prisma schema, so the query engine for Netlify's Node 20+ functions is generated.
- `trustHost: true` in the Auth.js config, which only trusts the forwarded host automatically on Vercel.
- The free plan is a hard 300 credits a month shared by deploys, requests, bandwidth, and function compute; a production deploy costs about 15. When credits run out, the site is paused until the month resets. So `netlify.toml` skips builds when nothing under `ai-podcast-clipper-frontend/` changed, and clips are served from S3, not through Netlify.

## Consequences
- The launch costs $0, within roughly 20 production deploys a month; batch web changes rather than deploying each one.
- After a deploy that changes Inngest functions, re-sync the app (`curl -X PUT <site>/api/inngest`, or Inngest's dashboard).
- Each paid upgrade is a decision for after the first sales: a domain (which also enables Resend), then whatever the host requires at volume.
- Sign-up and reset emails come from the owner's Gmail address. Deliverability is fine at low volume; a domain with SPF/DKIM is the upgrade path.
- If the keep-alive stops running (GitHub disables scheduled workflows in repositories with no activity for 60 days), the database can pause again; the dashboard's "Resume project" brings it back within 90 days.
- [`DEPLOY.md`](../DEPLOY.md) is written for this plan.
