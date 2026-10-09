# 0008. YouTube ingestion: in the worker when it works, by an operator when it doesn't

**Status:** accepted (2026-06) for the demo; **to be decided for customers in Phase 1 commit 3**

## Context
The demo needed clips from a YouTube video. yt-dlp running on Modal is frequently blocked by YouTube's bot
checks, even with cookies.

## Decision (as built)
Two paths:

1. **In-app:** `processYouTubeUrl` ([`generation.ts`](../../ai-podcast-clipper-frontend/src/actions/generation.ts)) creates a job with `s3Key = youtube_<videoId>/original.mp4` and passes the URL to Modal, which runs yt-dlp (with `YT_COOKIES` from the `yt-dlp-cookies` secret when set) and uploads the file to S3 before processing.
2. **Operator:** `ingest_youtube.py` downloads locally and uploads to S3; `scripts/trigger-processing.mjs` creates the row and sends the event.

## Consequences
- The in-app path is unreliable, and its shell command interpolates the URL ([LAUNCH_PLAN](../LAUNCH_PLAN.md) F1).
- The S3 prefix is shared by every user who submits the same video (F3).
- Downloading from YouTube conflicts with YouTube's terms of service. For a paid product the safe default is upload-only, with the URL tab removed or limited to content the user owns. This ADR gets a successor when that decision is made.
