# 0011. Harden for a paid launch before adding features

**Status:** accepted (2026-10-09)

## Context
The demo works end to end, but it was built to be shown, not sold. The October review found a command
injection in the worker, an unauthenticated server action, cross-user clip leakage on YouTube jobs, a
non-idempotent payment webhook, and a database that pauses itself when idle
([`LAUNCH_PLAN.md` §2](../LAUNCH_PLAN.md)).

## Decision
Phase 1 is a sellable launch: security, billing correctness, verified accounts, tests and CI, legal pages, and
production infrastructure, in eight commits, before any new user-facing feature. Planning follows the same
shape as the project's other repositories: [`PLAN.md`](../PLAN.md) for the product and its phases, a
commit-by-commit plan per phase with "done when" criteria, a living [`DESIGN.md`](../DESIGN.md), and an ADR for
each real decision.

**Process:** one commit per feature, tests once per commit, browser checks once per UI commit, five-line
summaries, and always ask before pushing. Deferred work goes into `PLAN.md`.

## Consequences
- No new features until Phase 1 is done; requests that come up go into `PLAN.md`.
- Money and security paths get tests before their fixes land.
- Several Phase 1 steps depend on the account owner (Stripe verification, Supabase upgrade, domain, credential rotation); [`LAUNCH_PLAN.md` §5](../LAUNCH_PLAN.md) lists them so they can start early.
