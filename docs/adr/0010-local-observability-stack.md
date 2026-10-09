# 0010. Grafana, Loki, and Promtail for local observability

**Status:** accepted (2026-07), recorded retroactively

## Context
QA work on the app needed request-level visibility — which routes return what, when errors spike — without
adding a hosted vendor during development.

## Decision
A Docker Compose stack in [`observability/`](../../observability/README.md): the Next.js server's output is
written to `observability/logs/frontend.log`, Promtail tails it and promotes `method` and `status` to labels,
Loki stores it, and Grafana on `:3001` shows a provisioned dashboard with anonymous admin access.

## Consequences
- Useful for local testing; nothing in it runs in production.
- Anonymous admin is acceptable only on localhost.
- Production error tracking is a separate decision (Sentry, Phase 1 commit 8); Modal and Inngest logs stay in their own dashboards.
