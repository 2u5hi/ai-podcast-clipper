# Phase 1 plan: the sellable launch

**Goal:** a stranger can find the product, sign up, verify their email, buy credits with a real card, upload
an episode, and download clips, and nothing about that path is unsafe, overcharges them, or depends on the
operator noticing a problem by hand.

This is Phase 1 of [`PLAN.md`](PLAN.md), which describes the finished product and phases 2–4. Nothing built
here is thrown away later.

---

## 1. Where the project stands

Done and on `main` (Phase 0, the working demo):

| Area | State |
|---|---|
| Pipeline | Modal on L40S: WhisperX transcription → Gemini moment selection with a five-model fallback chain → LR-ASD speaker tracking → 9:16 reframe → captions → watermark → S3 |
| Queue | Inngest function `process-video`: one job per user at a time, recovers clips that land in S3 after the request window closes |
| Web | Next.js 16 dashboard: upload, YouTube URL tab, clip playback, billing page; credentials sign-in with JWT sessions |
| Billing | Stripe Checkout for three credit packs (50 / 150 / 500), webhook adds credits; **test mode** |
| Ops | Scripts for account seeding, manual triggering, job status, stale-job cleanup; local Grafana + Loki + Promtail |
| Docs | README, this plan, [`DESIGN.md`](DESIGN.md), [ADRs](adr/README.md) |
| Tests | Vitest (`npm test`) for the frontend, pytest for the backend's pure modules; both run in GitHub Actions with lint and, for the web app, a production build |

**Health check, 2026-10-09:** typecheck clean; Modal endpoint up (about 100s cold start); S3 and Gemini keys
valid, and every model in the fallback chain still exists; Supabase had auto-paused again and was restored.
The deployed Vercel site is the old `dark-pheonix-dev` project, not this repo.

---

## 2. Findings from the October review

Read from the code on 2026-10-09. Each one is fixed by a commit in §4 unless marked for a later phase.

| # | Finding | Where | Severity | Fixed in |
|---|---|---|---|---|
| F1 | YouTube URL is interpolated into a shell command (`shell=True`) — command injection on the GPU worker | `main.py:495` (and 8 other `shell=True` calls) | **Critical** | 3 ✅ |
| F2 | `processVideo` server action has no session check; any caller can start processing for any file id | `generation.ts:11` | High | 3 ✅ |
| F3 | YouTube jobs write to `youtube_<videoId>/`, shared across users; a second user clipping the same video gets the first user's clips listed as theirs | `generation.ts:53`, `functions.ts` prefix listing | High | 3 ✅ |
| F4 | Stripe webhook isn't idempotent; a retried `checkout.session.completed` adds credits twice | `stripe/route.ts:57` | High | 4 ✅ |
| F5 | A user with 1 credit can receive 5 clips (`Math.min(credits, clipsFound)`); the recovery path decrements without a floor and can go negative | `functions.ts:112`, `functions.ts:172` | Medium | 4 ✅ |
| F6 | Email is case-sensitive at sign-in and sign-up (`findUnique({ where: { email } })`), but lowercased for Stripe | `auth.ts:26`, `config.ts:51` | Medium | 5 ✅ |
| F7 | Uploads accept any content type and size; the extension comes from the client's filename | `s3.ts:30` | Medium | 3 ✅ |
| F8 | Clip tiles fail silently: a failed signed URL leaves a black player with only a console error (BUG-1) | `clip-display.tsx:20` | Medium | 6 ✅ |
| F9 | No rate limits on sign-up, sign-in, or job submission; 10 free credits per account | `schema.prisma:63` | Medium | 5 ✅ |
| F10 | Free-tier Supabase pauses after ~3 weeks idle; the app is fully down when it does | infra | High for launch | 8 |
| F11 | Leftovers: T3 `Post` model, unused `Account`/`Session` tables under JWT sessions, a QA account with a trivial password | `schema.prisma` | Low | 8 |
| F12 | Modal web endpoints answer any request longer than 150s with a 303 redirect while the job keeps running (seen in the 2026-10-09 smoke test: 303 at 150.8s, clips landed afterwards). Whether Inngest's `step.fetch` follows it is unverified; this is the likely source of the "timed-out but successful" runs that [ADR 0009](adr/0009-recover-runs-from-s3.md) recovers | `functions.ts` `step.fetch` | Medium | Phase 2 |
| F13 | Next 16 dev logging printed server-action arguments — sign-up and sign-in passwords — and `observability/` ships dev logs to Loki | `next.config.js` | High (dev) | 3 ✅ |
| F14 | A valid session for an account that no longer exists makes the dashboard throw instead of sending the person to log in (seen while testing against a fresh database) | `dashboard/layout.tsx`, `dashboard/page.tsx` | Low | Phase 2 |

---

## 3. Phase 1 scope

### In
1. **Security** — no shell interpolation, ownership checks on every server action, per-job storage, validated uploads, rotated secrets, least-privilege IAM.
2. **Billing that's right** — idempotent webhook, credits charged for what was delivered and never below zero, automatic refund on failure, Stripe live mode.
3. **Accounts** — normalized emails, email verification, password reset, rate limits.
4. **Visible failure** — job states a user can read, clip tiles that show an error and retry.
5. **Tests and CI** — unit tests for the money paths, a pipeline test for moment filtering, a Playwright smoke test, all on every push.
6. **Legal and storefront** — terms, privacy, refund policy, pricing page, support contact.
7. **Production infrastructure** — paid Supabase, Vercel project on this repo with a custom domain, Sentry, S3 lifecycle and CORS applied.

### Later phases
Job progress and email notifications, cost tracking, admin view (Phase 2); clip options, brand kit, trimming
(Phase 3); social sign-in and direct publishing (Phase 4). See [`PLAN.md`](PLAN.md).

### Not in Phase 1
A decision on keeping YouTube ingestion is made in commit 3 (upload-only by default), but making it reliable is not
in scope.

---

## 4. Work plan — eight commits

Each is one commit, with tests, docs (an ADR when a decision is made), and a short review summary.
"Done when" is what done means.

| # | Commit | Contents | Done when |
|---|---|---|---|
| 1 ✅ | `docs: plan, design, and decision records` | `docs/PLAN.md`, this file, `docs/DESIGN.md`, `docs/adr/` with the decisions already made, README links | A new session can resume from the docs alone |
| 2 ✅ | `ci: typecheck, lint, and tests on every push` | `web.yml` (ESLint, Vitest, `next build` with placeholder env) and `backend.yml` (ruff, pytest); lint scripts moved off `next lint`, which Next 16 removed; YouTube id parsing extracted to `src/lib/youtube.ts`; moment parsing and selection extracted to `moments.py` so they test without the GPU stack | A pull request shows green checks; a type error turns them red |
| 3 ✅ | `fix(security): no shell, owned jobs, validated uploads` | Every `subprocess.run` takes an argument list; YouTube URLs validated against an allow-list pattern before use; session + ownership check in `processVideo`; per-job storage prefix for YouTube jobs (`<uuid>/original.mp4`); upload content-type allow-list and size cap; ADR on YouTube ingestion (default: off for customers) | A URL containing `; touch /tmp/x` is rejected before reaching the worker; calling `processVideo` with another user's id fails; two users clipping the same video see only their own clips |
| 4 ✅ | `fix(billing): idempotent credits that match the work` | `CreditLedgerEntry` with a unique Stripe event id, written in the same transaction as every balance change (opening rows backfilled); `CHECK (credits >= 0)`; jobs reserve up to 5 credits, ask Modal for at most that many clips (`max_clips`), and refund what wasn't delivered — all of it on failure; sign-up credits through the ledger; Prisma migrations from a verified baseline replace `db push`; billing tests on a real Postgres in CI; ADRs 0013, 0014. The credit unit stays one clip until cost data exists | Replaying the same webhook three times adds credits once; a failed job leaves the balance unchanged; every balance equals the sum of its ledger rows |
| 5 ✅ | `feat(auth): verified, rate-limited accounts` | Emails lowercased by the schemas and a database `CHECK`; email verification (button-press confirm) and password reset with hashed single-use tokens; Resend mailer with a dev fallback that prints links; rate limits as Postgres counters (no Upstash); 10 free credits granted once on verification; uploads, jobs, YouTube, and checkout require a verified email; ADR 0015 | An unverified account can't start a job; `Qa@Gmail.com` and `qa@gmail.com` are one account; the 11th sign-in attempt in a minute is refused |
| 6 ✅ | `feat(jobs): states and errors users can see` | `JobStatus` enum (in-place migration of the old strings) and `failureReason`; reasons mapped from the worker's status, never the raw error; the worker refuses files without video and audio (ffprobe, 422) before GPU work; dashboard shows Failed + reason + "Credits refunded", "No clip-worthy moments found" for empty runs, and refreshes itself while jobs run; clip tiles show an error with Retry; `cleanup-stale-jobs` keeps failed jobs | A job forced to fail shows "Failed — credits refunded" and a reason; a clip whose URL 403s shows an error tile, not a black player |
| 7 | `feat(web): pricing, terms, privacy, and refund pages` | Public pricing page, terms of service (including "you must own the rights to what you upload"), privacy policy, refund policy, support email in the footer | Every page is reachable without signing in and linked from the footer and checkout |
| 8 | `feat(deploy): production environment` | Supabase on a paid plan; Vercel project on this repo with a custom domain and production env; Stripe live products, prices, and webhook; Sentry for web and Modal; IAM user with Get/Put/List on one bucket; S3 CORS and a lifecycle rule for originals; secrets rotated; `Post`/`Account`/`Session` removed; QA account deleted; Playwright smoke test against production | A real card buys a small pack on the live domain, the clips download, the purchase is refunded, and Sentry shows the run's traces |

---

## 5. Operator tasks

Things only the account owner can do. Start the slow ones first.

| Task | Blocks | Lead time |
|---|---|---|
| Stripe business verification and bank account for live mode | 8 | Days |
| Upgrade Supabase to Pro | 8 | Minutes |
| Buy a domain and point it at Vercel | 7, 8 | Minutes to hours |
| Create a Resend account and verify the sending domain (Upstash is no longer needed, ADR 0015) | 8 | Minutes, plus DNS |
| Rotate AWS, Stripe, Gemini, Modal auth, `AUTH_SECRET`, and database credentials | 8 | An hour |
| Attach the Get/Put/List policy to the `dark-phoenix-dev` IAM user | 8 | Minutes |

---

## 6. Process

| Rule | |
|---|---|
| Commit size | **One commit per feature** (the eight above), not per sub-step. Conventional Commit subjects |
| Tests | Run the suite once per commit; report only failures. Money and security paths get tests before the fix lands |
| Browser checks | Once per UI commit, and once after deploy — not per change |
| Docs | An ADR when a real decision is made; one line in the index. `DESIGN.md` updated when the implementation diverges |
| Summaries | **5 lines**: what changed, what was verified, what's next |
| Pushing | **Always ask before pushing.** Commit locally, summarize, wait for "push" |
| Deferred work | Anything cut goes into [`PLAN.md`](PLAN.md), not into the commit |

---

## 7. Resuming in a new conversation

Say: *"Continue the podcast clipper — read docs/LAUNCH_PLAN.md."* Then:

1. Find the first commit in §4 without a ✅ and start there.
2. Read [`docs/adr/README.md`](adr/README.md) for decisions already made; don't relitigate them.
3. `git log --oneline -15` to see where the work stopped.

**Local setup reminders**
- Schema changes are migrations (`prisma migrate diff` → edit → `prisma migrate deploy`), never `db push` ([ADR 0014](adr/0014-prisma-migrations.md)).
- If the database is unreachable, check whether Supabase has auto-paused before debugging anything else. TCP to the pooler still connects when it has; only a real query fails.
- Local development needs `INNGEST_DEV=1` in the frontend `.env` and the Inngest dev server (`npm run inngest-dev`, port 8288). The production signing key rejects the local server.
- On Windows, stop `next dev` before `prisma generate` (the query engine DLL is locked while it runs).
- The Modal CLI needs `PYTHONUTF8=1` on Windows. It lives in `ai-podcast-clipper-backend/.venv` (Python 3.14; 3.10 is too old for current numpy). `modal deploy` imports `main.py` locally, so that venv also needs `main.py`'s top-level imports: `pip install modal boto3 opencv-python-headless numpy fastapi pydantic google-genai pysubs2 tqdm`.
- End-to-end tests without touching production data: run `next dev` with `DATABASE_URL` pointing at a local Postgres (process env beats both `.env` files), plus `npm run inngest-dev`, and send `process-video-events` to `http://localhost:8288/e/local`. `scripts/trigger-processing.mjs` sends to Inngest Cloud, which routes to the deployed site.
- The browser pane only runs page JavaScript while the Claude window is in front.
- Smoke-test the pipeline without the web app: upload a ~75s clip to `smoketest-<timestamp>/original.mp4` and POST `{"s3_key": ...}` to the Modal endpoint with the bearer token. A wrong token returning 401 is a cheap check that the image boots.
- Modal cold start is about 100 seconds; a timeout on the first call after idle isn't an outage.
- Tests: `npm test` and `npm run lint` in the frontend (the billing tests need `TEST_DATABASE_URL`, e.g. `docker run -d --name clipper-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=clipper_test -p 55432:5432 postgres:16-alpine` then `TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/clipper_test npm test`; without it they skip); `pip install -r requirements-dev.txt`, then `pytest -q` and `ruff check .` in the backend. The backend tests import only pure modules, so the GPU dependencies aren't needed.
- The frontend's `.npmrc` sets `legacy-peer-deps=true`, so peer dependencies (e.g. `vite` for Vitest) must be installed explicitly.
- The watermark text comes from `WATERMARK_TEXT` in the Modal secret `ai-podcast-clipper-secret`; the code default is `yourbrand.ai`.
