# 0004. Gemini picks moments, through a schema, a fallback chain, and a salvage parser

**Status:** accepted (2026-06); prompt generalized 2026-07; fallback order changed in `91c6791`

## Context
Moment selection decides whether clips are good. It failed three ways during the demo: the original model's
free-tier quota went to zero, a preview model was intermittently overloaded, and long responses were cut off
mid-JSON. The original prompt also only looked for interview questions.

## Decision
In `identify_moments` ([`main.py`](../../ai-podcast-clipper-backend/main.py)):

- **Schema:** `response_mime_type="application/json"` with an array-of-`{start, end}` schema.
- **Fallback chain:** `gemini-2.5-flash` → `gemini-3-flash-preview` (twice) → `gemini-flash-latest` → `gemini-2.5-flash-lite`, fastest-reliable first so a busy model doesn't add dead time.
- **Salvage:** if the JSON doesn't parse, extract every complete `{...}` object that has `start` and `end`.
- **Filter:** keep 25–70s moments, top up to 3 with the longest moments of 15s or more, cap at 5.
- **Prompt:** any self-contained, engaging moment — stories, hot takes, explanations, Q&A — skipping sponsor reads and fragments that need missing context.

## Consequences
- One model being down or rate-limited doesn't fail the job.
- Model names age: check every name in the chain against the Gemini models list whenever the pipeline is touched (all present on 2026-10-09).
- Clip quality isn't measured; "good" was judged by watching the output. An evaluation set is a Phase 3 candidate.
