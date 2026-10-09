-- All three were empty when this was written (checked on the live database, 2026-10-10): Post is a T3
-- template leftover, and Account/Session belonged to the Auth.js adapter, unused with credentials + JWT sessions.

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Session";

