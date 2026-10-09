# Architecture decision records

One file per decision: the context, what was decided, where it lives in the code, and the consequences.
0001–0010 were recorded retroactively from the code as it stood in October 2026.

| # | Decision | Area |
|---|---|---|
| [0001](0001-fork-the-open-source-clipper.md) | Fork the open-source clipper instead of building from scratch | Process |
| [0002](0002-inngest-between-web-and-gpu.md) | Inngest sits between the web app and the GPU; the contract is an S3 key | Architecture |
| [0003](0003-gpu-pipeline-on-modal.md) | The pipeline runs on Modal L40S GPUs, with weights baked into the image | Platform |
| [0004](0004-gemini-moment-selection.md) | Gemini picks moments, through a schema, a fallback chain, and a salvage parser | AI |
| [0005](0005-credits-per-clip.md) | A credit is one delivered clip, charged after the job (charging rules superseded by 0013) | Billing |
| [0006](0006-credentials-auth-with-jwt.md) | Email-and-password accounts with JWT sessions | Auth |
| [0007](0007-burned-in-watermark.md) | The watermark is burned into the MP4, and its text is configuration | Pipeline |
| [0008](0008-youtube-ingestion.md) | YouTube ingestion: in the worker when it works, by an operator when it doesn't (in-app half superseded by 0012) | Ingestion |
| [0009](0009-recover-runs-from-s3.md) | A run that errors is checked against S3 before it is called failed | Reliability |
| [0010](0010-local-observability-stack.md) | Grafana, Loki, and Promtail for local observability | Tooling |
| [0011](0011-harden-before-features.md) | Harden for a paid launch before adding features | Process |
| [0012](0012-youtube-off-for-customers.md) | YouTube links are off for customers unless explicitly enabled; only canonical URLs reach the worker | Ingestion |
| [0013](0013-credit-ledger-reserve-and-settle.md) | Credits move through a ledger; jobs reserve, then settle; the database refuses negatives and duplicate Stripe events | Billing |
| [0014](0014-prisma-migrations.md) | Schema changes are Prisma migrations from a verified baseline; `db push` is retired | Persistence |
