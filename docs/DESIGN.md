# Design: AI Podcast Clipper

Status: **Living design.** It describes the system as built; where the code departs from it, the code is
updated or this document is. Decisions, with the reasoning, are in [`docs/adr/`](adr/README.md). Build order is
in [`PLAN.md`](PLAN.md); the current phase is [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md).

Built on [Andreas Trolle's ai-podcast-clipper](https://github.com/Andreaswt/ai-podcast-clipper-saas) (MIT)
([ADR 0001](adr/0001-fork-the-open-source-clipper.md)).

---

## 1. What it does

A user uploads a podcast episode (or pastes a YouTube link). The system transcribes it, asks an LLM for the
self-contained 30–60 second moments worth posting, follows the active speaker to crop each moment to 9:16,
burns in captions and a watermark, and shows the clips in a dashboard. The user pays in credits bought through
Stripe.

## 2. Architecture

```
Browser
  │  server actions (Next.js on Vercel)
  │    • signed S3 PUT for the upload       • UploadedFile row
  │    • Inngest event "process-video-events"
  ▼
Inngest Cloud ── calls back into /api/inngest ──► process-video function
  │                                                  │ check credits (Postgres)
  │                                                  │ POST s3_key → Modal (bearer token)
  ▼                                                  ▼
Modal (L40S GPU)                              Postgres (Supabase)
  download original from S3                     User, UploadedFile, Clip
  WhisperX → Gemini → LR-ASD → ffmpeg
  upload clip_N.mp4 next to the original
  ▼
AWS S3 ── list prefix ──► Inngest writes Clip rows, deducts credits
       ── signed GET ───► dashboard playback
```

### 2.1 Boundaries, and why these

| Boundary | Rule | Why |
|---|---|---|
| Web ↔ GPU | They never call each other directly; Inngest sits between them | The GPU job runs for minutes and can outlive any HTTP request. Inngest gives retries, per-user concurrency, and durable state ([ADR 0002](adr/0002-inngest-between-web-and-gpu.md)) |
| Contract | The only thing passed to the GPU is an S3 key (plus an optional YouTube URL) | The worker needs no database access and no user context |
| Database ↔ video | Postgres never holds video; the GPU never touches Postgres | Keeps the worker stateless and the database small |
| Results | The worker's output is files under the job's S3 prefix; Inngest discovers them by listing | Lets a timed-out request still produce a successful job ([ADR 0009](adr/0009-recover-runs-from-s3.md)) |

## 3. Components

| Component | Where | Tech |
|---|---|---|
| Web app | `ai-podcast-clipper-frontend/` | Next.js 16 (App Router), React 19, TypeScript, Tailwind, shadcn/ui, Auth.js v5, Prisma 6 |
| Job function | `src/inngest/functions.ts` | Inngest v4 |
| GPU pipeline | `ai-podcast-clipper-backend/main.py`, `moments.py` | Modal, Python 3.11, CUDA 12.4, WhisperX large-v2, LR-ASD, ffmpeg, pysubs2, google-genai |
| Admin ingestion | `ai-podcast-clipper-backend/ingest_youtube.py`, `scripts/trigger-processing.mjs` | yt-dlp locally → S3 → Inngest event |
| Brand config | `ai-podcast-clipper-frontend/src/config/brand.ts` | Company and product names, support email, governing country (placeholders until chosen), house watermark |
| Ops scripts | `ai-podcast-clipper-frontend/scripts/` | `ensure-reviewer`, `job-status`, `cleanup-stale-jobs`, `delete-job`, `trigger-processing` |
| Local observability | `observability/` | Grafana + Loki + Promtail, development only ([ADR 0010](adr/0010-local-observability-stack.md)) |

## 4. Data model

Prisma schema: `ai-podcast-clipper-frontend/prisma/schema.prisma`; changes ship as migrations in `prisma/migrations/` ([ADR 0014](adr/0014-prisma-migrations.md)).

| Model | Purpose | Notes |
|---|---|---|
| `User` | Account and credit balance | `email` unique and lowercase (`CHECK`), `emailVerified`, `password` bcrypt hash, `credits` (default 0, `CHECK >= 0`), `stripeCustomerId`, `watermarkText` (1–40 printable characters, `CHECK`; null = none) |
| `CreditLedgerEntry` | One row per balance change | signed `delta`, `reason` (`OPENING_BALANCE`, `SIGNUP_GRANT`, `PURCHASE`, `JOB_RESERVE`, `JOB_REFUND`, `ADMIN_ADJUSTMENT`), optional job, unique `stripeEventId`; a balance always equals the sum of its rows ([ADR 0013](adr/0013-credit-ledger-reserve-and-settle.md)) |
| `UploadedFile` | One processing job | `s3Key` (`<uuid>/original.<ext>` or `youtube_<videoId>/original.mp4`), `uploaded`, `status` string |
| `Clip` | One produced clip | `s3Key` (`<prefix>/clip_<n>.mp4`), belongs to a user and a file |
| `VerificationToken` | Email-link tokens | `verify:<userId>` / `reset:<userId>`, SHA-256 of the token, expiry ([ADR 0015](adr/0015-verified-rate-limited-accounts.md)) |
| `RateLimit` | Fixed-window counters | `(key, windowStart)` → `count` |
| `Account`, `Session` | Auth.js adapter tables | Unused with JWT sessions and the credentials provider |
| `Post` | T3 template leftover | Unused; removed in Phase 1 |

### 4.1 Job states

`UploadedFile.status` is the `JobStatus` enum; `failureReason` holds the sentence the dashboard shows for a
failed job.

```
QUEUED ──► PROCESSING ──► PROCESSED   (clips delivered; or none found, credits refunded)
   │            │
   │            └──► FAILED           (credits refunded; failureReason says why)
   └──► NO_CREDITS                    (nothing could be reserved when the job started)
```

Failure reasons come from `failureReasonFor` (`src/lib/job-failures.ts`), keyed on the worker's HTTP status:
422 (the worker's ffprobe found no video or audio) asks the user to check the file; 401/403 says processing is
unavailable; anything else asks them to try again. The raw error never reaches the UI; it stays in Inngest's
run log. The dashboard refreshes every 15 seconds while any job is queued or processing.

`uploaded` is a separate flag: `false` from the moment the signed PUT is issued until the client confirms the
upload and the event is sent. `scripts/cleanup-stale-jobs.mjs` deletes only those abandoned rows, after a day.

### 4.2 S3 layout

```
<uuid>/original.<ext>          uploaded episode
<uuid>/clip_0.mp4 … clip_4.mp4 produced clips
youtube_<videoId>/original.mp4 legacy operator ingestion (ingest_youtube.py); in-app YouTube jobs use <uuid>/ like uploads
```

## 5. The pipeline

`AiPodcastClipper.process_video` in `main.py`, on an L40S with a one-hour timeout, `retries=0`, and a 20-second
scale-down window. Models load once per container in `@modal.enter()`; Torch weights are cached on the
`ai-podcast-clipper-model-cache` volume, and the LR-ASD weights are baked into the image
([ADR 0003](adr/0003-gpu-pipeline-on-modal.md)).

| Step | What happens |
|---|---|
| 1. Fetch | Download `original` from S3, or run yt-dlp when `youtube_url` is set and upload the result to S3; then `ffprobe` it and answer 422 unless it has a video and an audio stream |
| 2. Transcribe | WhisperX large-v2 (float16, batch 16), then word-level alignment for English |
| 3. Pick moments | Gemini, with a JSON response schema and a fallback chain of models ([ADR 0004](adr/0004-gemini-moment-selection.md)) |
| 4. Filter | `moments.py`: keep moments of 25–70s; if fewer than 3, top up with the longest moments of 15s or more; at most `max_clips` (1–5, the credits the job reserved) |
| 5. Per clip | Cut the segment → LR-ASD finds the speaking face per frame → crop to 1080×1920 following the speaker, or fit over a blurred background when no face is tracked → captions (pysubs2, Anton font, 5 words per line) → the job's watermark, if any, via ffmpeg `drawtext` reading a text file with expansion off ([ADR 0016](adr/0016-watermark-per-account.md)) |
| 6. Deliver | Upload `clip_<n>.mp4` beside the original; delete the run's `/tmp` directory |

## 6. The job function

`runProcessVideo` in `src/inngest/functions.ts`, registered as Inngest's `process-video`. One retry; one job per
`userId` at a time. Credits are reserved, then settled ([ADR 0013](adr/0013-credit-ledger-reserve-and-settle.md)).

| Step | |
|---|---|
| `reserve-credits` | Take `min(balance, 5)` in one transaction with a `JOB_RESERVE` ledger row; zero → `set-status-no-credits` and stop |
| `set-status-processing` | |
| `step.fetch` to Modal | `s3_key`, `max_clips` = the reservation, `watermark_text` (decided in `reserve-credits`: the house mark until the account has bought credits, then its own text or null), optional `youtube_url`; bearer `PROCESS_VIDEO_ENDPOINT_AUTH`; non-2xx throws |
| `create-clips-in-db` | List `<prefix>/` in S3; record clip keys (not `original.mp4`) up to the reservation |
| `settle-credits` | Refund `reserved − delivered` as `JOB_REFUND` |
| `set-status-processed` | |
| On error | `check-for-recovered-clips` records any clips that reached S3 anyway; `settle-failed-job` refunds the rest and marks `processed` or `failed`; with nothing delivered, the error is rethrown |

## 7. Accounts and access

Auth.js v5 with the credentials provider and JWT sessions ([ADR 0006](adr/0006-credentials-auth-with-jwt.md)).
Sign-up (`src/actions/auth.ts`) validates and lowercases with Zod, hashes with bcrypt, creates a Stripe customer
when Stripe is configured, and emails a confirmation link; actions that spend credits or money require a confirmed
email ([ADR 0015](adr/0015-verified-rate-limited-accounts.md)). The session callback copies `token.sub` into `session.user.id`; server actions read it through
`auth()`.

| Action | Checks today |
|---|---|
| `generateUploadUrl` | Verified email; 20/hour; MP4 only, 1 byte–500MB; the size and type are signed into the PUT URL, so S3 refuses any other body |
| `processVideo` | Verified email; one `updateMany` claims the file only if the caller owns it and it wasn't already submitted |
| `processYouTubeUrl` | Verified email; 20/hour; `YOUTUBE_INGESTION_ENABLED`; youtube.com/youtu.be link parsed with a URL parser; canonical URL rebuilt from the id ([ADR 0012](adr/0012-youtube-off-for-customers.md)) |
| `getClipPlayUrl` | Signed in; clip belongs to the user |
| `createCheckoutSession` | Verified email |
| `updateWatermark` | Verified email; account has bought credits; 1–40 printable characters or empty for none |
| `signUp` | 10/hour per IP; email lowercased; account starts at 0 credits; sends the confirmation link |
| `verifyEmail` | Single-use token; grants 10 credits once ([ADR 0015](adr/0015-verified-rate-limited-accounts.md)) |
| `requestPasswordReset` / `resetPassword` | Same answer for unknown emails; 3/hour per email, 10/hour per IP; single-use one-hour token |
| Sign-in (`authorize`) | 10/min per email, 30/min per IP; over the limit, the form says so |

## 8. Payments

Stripe Checkout in `payment` mode, three one-time prices (`STRIPE_SMALL/MEDIUM/LARGE_CREDIT_PACK`) for 50,
150, and 500 credits. The webhook at `/api/webhooks/stripe` verifies the signature, re-fetches the session
with its line items, maps the price id to a credit amount, and increments the balance of the user with that
Stripe customer id. Only `payment_status: "paid"` sessions add credits. The ledger row carries the Stripe event
id under a unique index and is written before the balance, so a redelivered event changes nothing and gets a 200
([ADR 0013](adr/0013-credit-ledger-reserve-and-settle.md)).

## 9. Configuration

Frontend variables are validated at startup by `src/env.js` (`@t3-oss/env-nextjs`); the template is
`.env.example`. The Modal worker reads the secret `ai-podcast-clipper-secret` (`AUTH_TOKEN`, `GEMINI_API_KEY`,
`S3_BUCKET_NAME`, AWS keys, `WATERMARK_TEXT` — now only the fallback for callers that don't send `watermark_text`) and the optional `yt-dlp-cookies` secret (`YT_COOKIES`).

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Prisma |
| `AUTH_SECRET` | Auth.js JWT signing |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` | Signed URLs, prefix listing |
| `PROCESS_VIDEO_ENDPOINT`, `PROCESS_VIDEO_ENDPOINT_AUTH` | Inngest → Modal |
| `STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout and webhook |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_DEV` | Inngest client; `INNGEST_DEV=1` locally |
| `BASE_URL` | Checkout success redirect |

## 10. Observability

Development only: the Next.js server's output goes to `observability/logs/frontend.log`, Promtail parses
request method and status into labels, Loki stores it, Grafana (`:3001`) shows a provisioned dashboard. Modal
and Inngest have their own run logs in their dashboards. Production error tracking (Sentry) arrives in Phase 1.

## 11. Security posture

| Area | Today | Phase 1 |
|---|---|---|
| Shell commands in the worker | Argument lists only; `s3_key` and `youtube_url` validated against fixed patterns before use ([`inputs.py`](../ai-podcast-clipper-backend/inputs.py)); bearer token compared in constant time | Done |
| Server action authorization | Session and ownership on every action | Done |
| Storage isolation | Per-job prefix for everything | Done |
| Webhook | Signature verified; idempotent on the Stripe event id | Done |
| Secrets | In `.env` files and Modal secrets; some shared through earlier sessions | Rotated; least-privilege IAM |
| Abuse | Rate limits on sign-up, sign-in, reset, and jobs; free credits only with a confirmed email | Done |
| Logs | Server-action argument logging is off in development (`next.config.js`), so passwords never reach Loki | Done |

## 12. Known limitations

- YouTube downloads from Modal are often bot-checked; the reliable path is `ingest_youtube.py` run by an operator ([ADR 0008](adr/0008-youtube-ingestion.md)).
- Transcription alignment is English-only.
- First request after idle waits ~100s for a GPU container.
- Modal answers any request longer than 150s with a 303 redirect while the job keeps running; the job function's S3 recovery ([ADR 0009](adr/0009-recover-runs-from-s3.md)) covers the case where the caller gives up (LAUNCH_PLAN F12).
- A 75s source clip takes about 2.5 minutes end to end on a warm container and yields 2 clips (smoke test, 2026-10-09).
- At most 5 clips per episode, fixed 9:16, one caption style.
- Comments in `main.py` and `.gitignore` refer to a `DEPLOYMENT.md` that isn't in this repository.
