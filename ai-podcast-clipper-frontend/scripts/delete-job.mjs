// deletes a job and its clip rows (for when the S3 objects are gone too)
// usage: node --env-file=.env scripts/delete-job.mjs --id <uploadedFileId>
import { PrismaClient } from "@prisma/client";

const i = process.argv.indexOf("--id");
const id = i > -1 ? process.argv[i + 1] : undefined;
if (!id) {
  console.error("Required: --id <uploadedFileId>");
  process.exit(1);
}

const prisma = new PrismaClient();
const clips = await prisma.clip.deleteMany({ where: { uploadedFileId: id } });
await prisma.uploadedFile.delete({ where: { id } });
console.log(`Deleted job ${id} and ${clips.count} clip rows`);
await prisma.$disconnect();
