-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED', 'NO_CREDITS');

-- Convert the status strings in place (Prisma's generated SQL would drop the column and its data).
-- An unknown string fails the cast and the whole migration rolls back, rather than guessing.
ALTER TABLE "UploadedFile" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "UploadedFile" ALTER COLUMN "status" TYPE "JobStatus" USING (
  CASE "status"
    WHEN 'queued' THEN 'QUEUED'
    WHEN 'processing' THEN 'PROCESSING'
    WHEN 'processed' THEN 'PROCESSED'
    WHEN 'failed' THEN 'FAILED'
    WHEN 'no credits' THEN 'NO_CREDITS'
    ELSE "status"
  END
)::"JobStatus";
ALTER TABLE "UploadedFile" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN "failureReason" TEXT;
