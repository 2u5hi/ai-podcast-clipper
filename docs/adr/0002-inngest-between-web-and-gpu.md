# 0002. Inngest sits between the web app and the GPU; the contract is an S3 key

**Status:** accepted (2026-06), recorded retroactively

## Context
Processing an episode takes minutes to tens of minutes. A server action can't wait that long, and if the web
app called Modal directly, a dropped request would lose the job with no record and no retry.

## Decision
The server action writes an `UploadedFile` row and sends an Inngest event. The Inngest function
([`functions.ts`](../../ai-podcast-clipper-frontend/src/inngest/functions.ts)) checks credits, calls Modal with
the file's S3 key, then discovers the clips by listing that key's prefix. Each step is durable and recorded.

```ts
concurrency: { limit: 1, key: "event.data.userId" },
```

The worker receives an S3 key and nothing else about the user; it never reads or writes Postgres.

## Consequences
- A user can't monopolize GPUs: their jobs run one at a time.
- Inngest's dashboard is the job history.
- Local development needs the Inngest dev server and `INNGEST_DEV=1`; production signing keys reject it.
- A job's output is defined by what is under its S3 prefix, so prefixes must be unique per job (see [LAUNCH_PLAN](../LAUNCH_PLAN.md) F3).
