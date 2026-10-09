# 0001. Fork the open-source clipper instead of building from scratch

**Status:** accepted (2026-06), recorded retroactively

## Context
The pipeline — transcription, speaker tracking, reframing, captions — is weeks of work to get right and is
not where this product differentiates. Andreas Trolle's [ai-podcast-clipper](https://github.com/Andreaswt/ai-podcast-clipper-saas)
already does it end to end under the MIT license, with a Next.js dashboard and Stripe credits.

## Decision
Fork it and build on top: YouTube ingestion, a burned-in watermark, hardened moment selection, run recovery,
ops scripts, and the deployment. Keep its stack (T3 Next.js, Prisma, Inngest, Modal) rather than rewriting
around preferences.

## Consequences
- A working product in days rather than weeks.
- T3 template leftovers come with it: the `Post` model and unused Auth.js adapter tables (removed in Phase 1).
- `LICENSE.MD` and the README credit the original author; the MIT notice must stay in the repository.
