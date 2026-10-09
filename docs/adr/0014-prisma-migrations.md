# 0014. Schema changes are Prisma migrations; `db push` is retired

**Status:** accepted (2026-10-09)

## Context
The schema was applied with `prisma db push`, which diffs the live database and changes it with no record.
That was fine for a demo. The credit ledger ([ADR 0013](0013-credit-ledger-reserve-and-settle.md)) needs things
`db push` can't express — a backfill and a `CHECK` constraint — and production data now matters.

## Decision
- [`prisma/migrations/0_init`](../../ai-podcast-clipper-frontend/prisma/migrations/0_init/migration.sql) is a baseline generated from the schema as deployed; before it was written, `prisma migrate diff` confirmed the live database matched `schema.prisma` exactly. Existing databases mark it applied with `prisma migrate resolve --applied 0_init`; new ones run it.
- Every later change is a migration directory, generated with `prisma migrate diff` and edited by hand where the data needs it, applied with `prisma migrate deploy`.
- CI checks that the migrations still build exactly what `schema.prisma` describes, and the billing tests run on a database built from them.
- The test setup refuses to reset any database that isn't on localhost.

## Consequences
- Schema history is reviewable in git, and production gets the same SQL the tests ran.
- `npm run db:push` should no longer be used against a real database.
- Production deploys (Phase 1 commit 9) need a `prisma migrate deploy` step.
