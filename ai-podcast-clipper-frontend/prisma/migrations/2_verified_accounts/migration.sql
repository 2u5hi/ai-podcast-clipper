-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");


-- Emails are stored lowercase, so "Qa@Gmail.com" and "qa@gmail.com" can only ever be one account.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower(btrim("email")));

-- Accounts that existed before verification are treated as verified; they already hold their credits.
UPDATE "User" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;
