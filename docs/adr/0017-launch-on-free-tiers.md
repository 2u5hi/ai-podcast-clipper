# 0017. Launch on free tiers; pay for nothing until it sells

**Status:** accepted (2026-10-10). The web host is still to be chosen (see below).

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

**Hosting, to be chosen by the owner:**
- **Vercel Hobby** is free but its fair-use guidelines limit it to non-commercial, personal use, and they count collecting payments as commercial. Fine for testing; taking real payments there needs Pro ($20/month).
- **Netlify's free plan** appears to allow commercial use (the main restriction is reselling hosting, per Netlify's forum; check the current Terms of Use). It runs on monthly credits, and each production deploy uses some.

## Consequences
- The launch costs $0. Each paid upgrade is a decision for after the first sales: a domain (which also enables Resend), then whatever the host requires at volume.
- Sign-up and reset emails come from the owner's Gmail address. Deliverability is fine at low volume; a domain with SPF/DKIM is the upgrade path.
- If the keep-alive stops running (GitHub disables scheduled workflows in repositories with no activity for 60 days), the database can pause again; the dashboard's "Resume project" brings it back within 90 days.
- [`DEPLOY.md`](../DEPLOY.md) is written for this plan.
