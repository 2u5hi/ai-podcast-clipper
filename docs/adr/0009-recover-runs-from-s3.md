# 0009. A run that errors is checked against S3 before it is called failed

**Status:** accepted (2026-06), recorded retroactively

## Context
Long episodes can outlive the HTTP window of `step.fetch` while Modal keeps working and uploads every clip.
Marking those jobs `failed` threw away paid GPU work and showed users an error for a job that had succeeded.

## Decision
The Inngest function's `catch` ([`functions.ts`](../../ai-podcast-clipper-frontend/src/inngest/functions.ts))
runs a `check-for-recovered-clips` step: list the job's S3 prefix, create `Clip` rows for keys not already
recorded, charge for the new ones, and mark the job `processed`. Only when no clips exist is it marked `failed`
and the error rethrown.

## Consequences
- Timeouts don't lose finished work.
- The recovery path charges `newKeys.length` without the balance cap the main path uses ([LAUNCH_PLAN](../LAUNCH_PLAN.md) F5).
- It only works if a job's prefix contains nothing but that job's output — another reason prefixes must be per job.
