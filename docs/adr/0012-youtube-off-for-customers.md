# 0012. YouTube links are off for customers unless explicitly enabled

**Status:** accepted (2026-10-09). Supersedes the in-app half of [ADR 0008](0008-youtube-ingestion.md); the operator path stays.

## Context
[ADR 0008](0008-youtube-ingestion.md) let any signed-in user paste a YouTube link, which the worker downloaded
with yt-dlp. For a paid product that has three problems: downloading from YouTube conflicts with its terms of
service, Modal's IPs are bot-checked so the feature fails often, and the URL went into a shell command
([LAUNCH_PLAN](../LAUNCH_PLAN.md) F1).

## Decision
- **Off by default.** `YOUTUBE_INGESTION_ENABLED` (validated in [`env.js`](../../ai-podcast-clipper-frontend/src/env.js), default `"false"`). When off, the dashboard hides the tab and `processYouTubeUrl` refuses the request.
- **When on, only canonical links travel.** The web app parses the link with a URL parser, accepts `youtube.com`/`www.`/`m.` watch links and `youtu.be` links, and sends the worker a URL rebuilt from the 11-character id ([`youtube.ts`](../../ai-podcast-clipper-frontend/src/lib/youtube.ts)). The worker accepts nothing but `https://www.youtube.com/watch?v=<id>` ([`inputs.py`](../../ai-podcast-clipper-backend/inputs.py)) and passes it to yt-dlp as an argument after `--`, with no shell.
- **Per-job storage.** YouTube jobs get a `<uuid>/original.mp4` key like uploads, so two users clipping the same video never share output.
- **Operator path unchanged.** `ingest_youtube.py` + `scripts/trigger-processing.mjs` still work for content the operator has the rights to; the worker keeps accepting legacy `youtube_<id>/original.mp4` keys.

## Consequences
- Customers upload files. The upload limits (MP4, 500MB, size signed into the URL) are the one ingestion path to keep solid.
- Turning the flag on is a business decision with a legal side, not a config tweak: it needs terms of service that cover it and a reliable download path.
- The same video submitted twice is downloaded and processed twice; per-job keys trade deduplication for isolation.
