# 0006. Email-and-password accounts with JWT sessions

**Status:** accepted (2026-06), recorded retroactively

## Context
The original project used Auth.js with credentials. The audience is individual creators; there is no
organization or SSO requirement.

## Decision
Auth.js v5 with the credentials provider and `session: { strategy: "jwt" }`
([`server/auth/config.ts`](../../ai-podcast-clipper-frontend/src/server/auth/config.ts)). Passwords are bcrypt
hashes on `User.password`. The session callback copies `token.sub` into `session.user.id`, which server actions
read through `auth()`.

## Consequences
- No session table lookup on each request.
- Sessions can't be revoked server-side before they expire; a password change doesn't sign out other devices.
- The Prisma adapter's `Account` and `Session` tables are unused.
- No email verification or password reset exists yet (Phase 1 commit 5), and emails are compared case-sensitively.
