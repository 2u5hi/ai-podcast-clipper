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
| GPU pipeline | `ai-podcast-clipper-backend/main.py` | Modal, Python 3.11, CUDA 12.4, WhisperX large-v2, LR-ASD, ffmpeg, pysubs2, google-genai |
| Admin ingestion | `ai-podcast-clipper-backend/ingest_youtube.py`, `scripts/trigger-processing.mjs` | yt-dlp locally → S3 → Inngest event |
| Ops scripts | `ai-podcast-clipper-frontend/scripts/` | `ensure-reviewer`, `job-status`, `cleanup-stale-jobs`, `delete-job`, `trigger-processing` |
| Local observability | `observability/` | Grafana + Loki + Promtail, development only ([ADR 0010](adr/0010-local-observability-stack.md)) |

## 4. Data model

Prisma schema: `ai-podcast-clipper-frontend/prisma/schema.prisma`.

| Model | Purpose | Notes |
|---|---|---|
| `User` | Account and credit balance | `email` unique, `password` bcrypt hash, `credits` default 10, `stripeCustomerId` |
| `UploadedFile` | One processing job | `s3Key` (`<uuid>/original.<ext>` or `youtube_<videoId>/original.mp4`), `uploaded`, `status` string |
| `Clip` | One produced clip | `s3Key` (`<prefix>/clip_<n>.mp4`), belongs to a user and a file |
| `Account`, `Session`, `VerificationToken` | Auth.js adapter tables | Unused with JWT sessions and the credentials provider |
| `Post` | T3 template leftover | Unused; removed in Phase 1 |

### 4.1 Job states

`UploadedFile.status` is a free-form string today; Phase 1 makes it an enum with a failure reason.

```
queued ──► processing ──► processed
   │            │
   │            └──► failed        (Modal error, nothing recovered from S3)
   └──► no credits                 (balance was 0 when the job started)
```

`uploaded` is a separate flag: `false` from the moment the signed PUT is issued until the client confirms the
upload and the event is sent.

### 4.2 S3 layout

```
<uuid>/original.<ext>          uploaded episode
<uuid>/clip_0.mp4 … clip_4.mp4 produced clips
youtube_<videoId>/original.mp4 YouTube-ingested episode (shared across users — see LAUNCH_PLAN F3)
```

## 5. The pipeline

`AiPodcastClipper.process_video` in `main.py`, on an L40S with a one-hour timeout, `retries=0`, and a 20-second
scale-down window. Models load once per container in `@modal.enter()`; Torch weights are cached on the
`ai-podcast-clipper-model-cache` volume, and the LR-ASD weights are baked into the image
([ADR 0003](adr/0003-gpu-pipeline-on-modal.md)).

| Step | What happens |
|---|---|
| 1. Fetch | Download `original` from S3, or run yt-dlp when `youtube_url` is set and upload the result to S3 |
| 2. Transcribe | WhisperX large-v2 (float16, batch 16), then word-level alignment for English |
| 3. Pick moments | Gemini, with a JSON response schema and a fallback chain of models ([ADR 0004](adr/0004-gemini-moment-selection.md)) |
| 4. Filter | Keep moments of 25–70s; if fewer than 3, top up with the longest moments of 15s or more; at most 5 |
| 5. Per clip | Cut the segment → LR-ASD finds the speaking face per frame → crop to 1080×1920 following the speaker, or fit over a blurred background when no face is tracked → captions (pysubs2, Anton font, 5 words per line) → watermark via ffmpeg `drawtext` ([ADR 0007](adr/0007-burned-in-watermark.md)) |
| 6. Deliver | Upload `clip_<n>.mp4` beside the original; delete the run's `/tmp` directory |

## 6. The job function

`processVideo` in `src/inngest/functions.ts`. One retry; concurrency limited to one job per `userId`.

| Step | |
|---|---|
| `check-credits` | Read the file's user and balance |
| `set-status-processing` | Only when the balance is above zero; otherwise `set-status-no-credits` and stop |
| `step.fetch` to Modal | Bearer `PROCESS_VIDEO_ENDPOINT_AUTH`; non-2xx throws |
| `create-clips-in-db` | List the job's S3 prefix; create a `Clip` row for each key except `original.mp4` |
| `deduct-credits` | Decrement by `min(balance, clipsFound)` ([ADR 0005](adr/0005-credits-per-clip.md)) |
| `set-status-processed` | |
| On error | `check-for-recovered-clips`: if clips exist in S3, create the missing rows, charge for them, mark `processed`; otherwise mark `failed` and rethrow |

## 7. Accounts and access

Auth.js v5 with the credentials provider and JWT sessions ([ADR 0006](adr/0006-credentials-auth-with-jwt.md)).
Sign-up (`src/actions/auth.ts`) validates with Zod, hashes with bcrypt, and creates a Stripe customer when Stripe
is configured. The session callback copies `token.sub` into `session.user.id`; server actions read it through
`auth()`.

| Action | Checks today |
|---|---|
| `generateUploadUrl` | Signed in |
| `processVideo` | **None** (LAUNCH_PLAN F2) |
| `processYouTubeUrl` | Signed in; URL matches an 11-character video id |
| `getClipPlayUrl` | Signed in; clip belongs to the user |
| `createCheckoutSession` | Signed in |

## 8. Payments

Stripe Checkout in `payment` mode, three one-time prices (`STRIPE_SMALL/MEDIUM/LARGE_CREDIT_PACK`) for 50,
150, and 500 credits. The webhook at `/api/webhooks/stripe` verifies the signature, re-fetches the session
with its line items, maps the price id to a credit amount, and increments the balance of the user with that
Stripe customer id. Not idempotent yet (LAUNCH_PLAN F4).

## 9. Configuration

Frontend variables are validated at startup by `src/env.js` (`@t3-oss/env-nextjs`); the template is
`.env.example`. The Modal worker reads the secret `ai-podcast-clipper-secret` (`AUTH_TOKEN`, `GEMINI_API_KEY`,
`S3_BUCKET_NAME`, AWS keys, `WATERMARK_TEXT`) and the optional `yt-dlp-cookies` secret (`YT_COOKIES`).

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
| Shell commands in the worker | `shell=True` with interpolated paths and the YouTube URL | Argument lists only |
| Server action authorization | Missing on `processVideo` | Session and ownership on every action |
| Storage isolation | Per-job prefix for uploads; shared prefix for YouTube | Per-job prefix for everything |
| Webhook | Signature verified; not idempotent | Event ids recorded |
| Secrets | In `.env` files and Modal secrets; some shared through earlier sessions | Rotated; least-privilege IAM |
| Abuse | No rate limits; 10 free credits per account | Rate limits; credits on verified email |

## 12. Known limitations

- YouTube downloads from Modal are often bot-checked; the reliable path is `ingest_youtube.py` run by an operator ([ADR 0008](adr/0008-youtube-ingestion.md)).
- Transcription alignment is English-only.
- First request after idle waits ~100s for a GPU container.
- At most 5 clips per episode, fixed 9:16, one caption style.
- Comments in `main.py` and `.gitignore` refer to a `DEPLOYMENT.md` that isn't in this repository.
