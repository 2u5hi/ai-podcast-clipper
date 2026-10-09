# Product plan

What the finished product is, and the order it gets built in. Each phase ends in something deployed and
usable by a paying customer. Phase 1's commit-by-commit plan is in [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md); later
phases get the same treatment when they start. Decisions along the way are in [`adr/`](adr/README.md).

## The finished product

A self-serve SaaS that turns long-form podcasts and interviews into vertical, captioned, branded short-form
clips. A creator uploads an episode, buys credits, and downloads clips ready for TikTok, Shorts, and Reels.

| Pillar | What it means here |
|---|---|
| **Clip quality** | An LLM picks self-contained 30–60s moments; speaker tracking reframes to 9:16; captions and a watermark are burned into the MP4 |
| **Trustworthy billing** | Credits are bought through Stripe and charged only for work delivered; failed jobs cost nothing; every credit change is traceable |
| **Accounts** | Verified email, password reset, rate-limited sign-in; each user sees only their own files and clips |
| **Runs unattended** | Durable jobs with visible states, alerts when something breaks, a database that doesn't pause, costs known per job |

Out of scope, and the README says so: live-stream clipping, video editing beyond trimming, team workspaces,
a public API, and posting directly to social platforms (until Phase 4).

## Phases

| # | Phase | Delivers | Done when |
|---|---|---|---|
| 0 ✅ | **Working demo** | Upload → transcribe → pick moments → reframe → captions → watermark → dashboard; Stripe in test mode; deployed on Vercel + Modal + Supabase + S3 | One video produces watermarked, captioned clips end to end (done June 2026) |
| 1 | **Sellable launch** | Security fixes, correct billing, verified accounts, rate limits, tests and CI, legal pages, production infrastructure, Stripe live | A stranger can sign up, verify their email, buy credits with a real card, upload an episode, and download clips; a failed job refunds itself; CI is green; no known security issue is open |
| 2 | **Reliability + operations** | Job progress and failure reasons in the UI, "clips ready" email, Sentry and alerting, per-job cost tracking, S3 lifecycle rules, an admin view of jobs and credits | A job that fails at any step shows why, refunds, and pages the operator; the cost of each job is recorded next to what it charged |
| 3 | **Product depth** | Choice of clip count and length, caption styles, a per-user brand kit (watermark text, colors), trimming a clip's start/end, bulk download | A user can restyle and re-render a clip without reprocessing the whole episode |
| 4 | **Growth** | Social sign-in, publishing straight to YouTube/TikTok, referral credits, a pricing experiment, team seats | A clip can go from upload to a scheduled post without leaving the app |

## Where it runs

| Layer | Service | Notes |
|---|---|---|
| Web app + server actions | Vercel (Next.js 16) | The production project gets re-pointed at this repo in Phase 1; the old `dark-pheonix-dev` deploy is retired |
| Job queue | Inngest Cloud | Durable steps, one job per user at a time |
| GPU pipeline | Modal, L40S | Scales to zero; weights baked into the image |
| Database | Supabase Postgres | Moves to a paid plan in Phase 1 so it stops auto-pausing |
| Storage | AWS S3, us-east-2 | Signed PUT for uploads, signed GET for playback |
| Payments | Stripe | Test mode until Phase 1's last commit |

## Open decisions

Each becomes an ADR when it is made.

| Decision | Why it's open |
|---|---|
| Keep YouTube URL ingestion for paying users? | Downloading from YouTube conflicts with its terms of service, and Modal's IPs get bot-checked. Upload-only is the safe launch default ([ADR 0008](adr/0008-youtube-ingestion.md)) |
| What a credit buys | Today a credit is one clip. Per-minute-of-source pricing tracks GPU cost better. Needs real cost-per-job numbers first |
| Free credits at signup | The schema default is 10. Without email verification and rate limits, that is free GPU time for anyone with throwaway inboxes |
