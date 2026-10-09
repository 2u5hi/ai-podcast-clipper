# AI Podcast Clipper

Turns long-form podcasts and interviews into vertical, captioned, watermarked
short-form clips for TikTok, YouTube Shorts, and Reels. Paste a YouTube URL (or
upload a video), and the pipeline transcribes it, picks the best 30–60s moments
with an LLM, tracks the active speaker, reframes to 9:16, burns in captions and
a watermark, and delivers the clips through a web dashboard.

Built on top of [Andreas Trolle's open-source ai-podcast-clipper](https://github.com/Andreaswt/ai-podcast-clipper-saas)
(MIT). This fork adds server-side YouTube ingestion, a burned-in configurable
watermark, hardened LLM moment-selection, and an end-to-end cloud deployment.

**Status:** Phase 0 (working demo) complete. Phase 1 — hardening for a paid
launch: security fixes, correct billing, verified accounts, tests and CI,
production infrastructure — is in progress. Stripe is in test mode until then.

- [docs/PLAN.md](docs/PLAN.md) — the finished product and the phases to get there
- [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) — Phase 1, commit by commit, with the open findings
- [docs/DESIGN.md](docs/DESIGN.md) — how the system works today
- [docs/adr/](docs/adr/README.md) — decisions made along the way

## Architecture

```
Browser (Next.js / Vercel)
  │  server action: validate URL → write job row → emit event
  ▼
Inngest Cloud (durable queue: retries, 1 job/user concurrency)
  │  calls back into /api/inngest → POST to Modal (bearer auth)
  ▼
Modal (Python, L40S GPU)
  │  yt-dlp → WhisperX transcription → Gemini moment selection
  │  → LR-ASD speaker tracking → ffmpeg reframe + captions + watermark
  ▼
AWS S3  ──(signed URLs)──►  dashboard playback
```

The two halves never call each other directly — Inngest sits between them, and
the contract is an S3 key. The database never touches video; the GPU never
touches the database.

| Layer | Service |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Auth.js, Prisma |
| Queue | Inngest Cloud |
| GPU backend | Modal (L40S) |
| Database | Postgres (Supabase) |
| Storage | AWS S3 (signed PUT/GET) |
| AI | Gemini (moment selection), WhisperX (transcription), LR-ASD (speaker tracking) |
| Payments | Stripe (test mode) |

## What this fork adds

- **YouTube ingestion** — the original only took file uploads. Added a URL
  path: a dashboard tab + server action, and a server-side download step
  (`youtube_url` handled in the Modal worker, plus a standalone
  `ingest_youtube.py` for environments where YouTube bot-checks the GPU host).
- **Burned-in watermark** — an ffmpeg `drawtext` pass after captions, so the
  mark lives in the exported MP4 (not a web overlay). Text is configurable via
  the `WATERMARK_TEXT` env var.
- **Hardened moment selection** — a generalized prompt that finds any
  self-contained engaging moment (stories, hot takes, explanations, Q&A) rather
  than only interview questions, a JSON response schema, a retry/fallback chain
  across Gemini models (ordered fastest-reliable-first to avoid dead time on an
  overloaded model), a salvage parser for truncated responses, and a duration
  filter so clips actually land in the 30–60s window.
- **Resilient queue** — the Inngest function fails loudly on bad backend
  responses and recovers jobs whose clips reached S3 after the request window
  closed.
- **Ops scripts** — account seeding, admin trigger, job status, and a
  deliverables builder under `scripts/` and the backend dir.

## Observability

A local Grafana + Loki + Promtail stack lives under `observability/` for
monitoring the app under test — logs flow app → `logs/frontend.log` → Promtail
→ Loki → Grafana, with request status codes parsed into labels for graphing.

```powershell
docker compose -f observability/docker-compose.yml up -d   # start stack
./observability/run-frontend-with-logs.ps1                 # run frontend, logs → Loki
# Grafana (anonymous admin): http://localhost:3001
```

See [observability/README.md](observability/README.md) for the LogQL cheatsheet
and design notes (labels vs. content, ingestion vs. event time).

## Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. **Frontend:** `cd ai-podcast-clipper-frontend && npm install && npm run db:push && npm run dev`
3. **Backend (Modal):**
   ```bash
   cd ai-podcast-clipper-backend
   python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
   pip install -r requirements.txt
   # ASD weights are gitignored — fetch them once before deploying:
   python -m gdown 1AbN9fCf9IexMxEKXLQY2KYBlb-IhSEea -O asd/pretrain_TalkSet.model
   python -m gdown 1KafnHz7ccT-3IyddBsL5yi2xGtxAKypt -O asd/model/faceDetector/s3fd/sfd_face.pth
   modal setup && modal deploy main.py
   ```
4. Put the Modal endpoint URL in `PROCESS_VIDEO_ENDPOINT`, set a shared bearer
   token in both `PROCESS_VIDEO_ENDPOINT_AUTH` (frontend) and the Modal
   secret's `AUTH_TOKEN`, and configure S3 CORS for your domain (`cors.json`).

## Credits

Original project © Andreas Trolle, MIT licensed. See `LICENSE.MD`.
