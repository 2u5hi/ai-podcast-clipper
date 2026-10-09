-- AlterTable
ALTER TABLE "User" ADD COLUMN     "watermarkText" TEXT;


-- Matches MAX_WATERMARK_LENGTH in src/lib/watermark.ts.
ALTER TABLE "User" ADD CONSTRAINT "User_watermarkText_length" CHECK (char_length("watermarkText") BETWEEN 1 AND 40);
