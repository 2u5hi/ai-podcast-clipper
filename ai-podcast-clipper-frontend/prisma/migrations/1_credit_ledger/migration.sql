-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('OPENING_BALANCE', 'SIGNUP_GRANT', 'PURCHASE', 'JOB_RESERVE', 'JOB_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "uploadedFileId" TEXT,
    "stripeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_stripeEventId_key" ON "CreditLedgerEntry"("stripeEventId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_userId_createdAt_idx" ON "CreditLedgerEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: one opening row per existing non-zero balance, so every balance equals the sum of its ledger.
INSERT INTO "CreditLedgerEntry" ("id", "userId", "delta", "reason", "createdAt")
SELECT 'opening_' || "id", "id", "credits", 'OPENING_BALANCE', CURRENT_TIMESTAMP
FROM "User"
WHERE "credits" <> 0;

-- Balances can't go negative, whatever the application code does.
ALTER TABLE "User" ADD CONSTRAINT "User_credits_nonnegative" CHECK ("credits" >= 0);

-- New accounts start at 0; sign-up grants its credits through the ledger.
ALTER TABLE "User" ALTER COLUMN "credits" SET DEFAULT 0;
