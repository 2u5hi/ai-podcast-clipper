# 0003. The pipeline runs on Modal L40S GPUs, with weights baked into the image

**Status:** accepted (2026-06), recorded retroactively

## Context
WhisperX large-v2 and LR-ASD need a GPU. Traffic is bursty: nothing for hours, then one long job. Paying for
an always-on GPU would cost hundreds a month for mostly idle time.

## Decision
Run the pipeline as a Modal class (`@app.cls(gpu="L40S", timeout=3600, retries=0, scaledown_window=20)` in
[`main.py`](../../ai-podcast-clipper-backend/main.py)) exposed as a FastAPI endpoint with bearer auth. Load
models once per container in `@modal.enter()`. Cache Torch weights on a Modal volume. Bake the LR-ASD weights
into the image with `add_local_dir("asd", ...)`, because Google Drive blocks downloads from Modal's IPs.

`retries=0` on Modal because Inngest owns retries; two retry layers would multiply GPU spend on a bad input.

## Consequences
- Idle cost is zero; the first request after idle waits about 100 seconds for a container.
- The image pins `whisperx@v3.2.0`, `setuptools<72`, `torch==2.0.1`, and `scenedetect==0.6.4`; upgrading any of them needs a full rebuild and an end-to-end run.
- The ASD weights are gitignored, so a fresh clone must fetch them (README, Setup) before `modal deploy`.
- Modal's spend limit is a hard stop: the Starter plan's $1 limit once halted every job.
