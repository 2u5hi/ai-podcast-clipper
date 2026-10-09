# 0007. The watermark is burned into the MP4, and its text is configuration

**Status:** accepted (2026-06), recorded retroactively. The single global watermark is superseded by [ADR 0016](0016-watermark-per-account.md); burning it into the file stands

## Context
Clips leave the app: they are downloaded and posted elsewhere. A watermark drawn by the web player would
disappear the moment the file is downloaded.

## Decision
After captions, a final ffmpeg `drawtext` pass writes the mark into the video
([`main.py`](../../ai-podcast-clipper-backend/main.py), `process_clip`): upper right, Anton at 36px, white at 60%
opacity on a 30% black box, clear of the captions. The text comes from `WATERMARK_TEXT` in the Modal secret,
defaulting to `yourbrand.ai`.

## Consequences
- The brand travels with the file.
- One extra encode per clip (`-preset fast -crf 23`), a few seconds each.
- One watermark for every user. A per-user brand kit is Phase 3.
- The text is interpolated into the ffmpeg filter string; it must be escaped, or the call moved to an argument list, before it can ever come from user input.
