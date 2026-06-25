// creates the UploadedFile row for a video already in S3 (via ingest_youtube.py)
// and fires the normal inngest event so the deployed queue picks it up
//
// usage:
//   node --env-file=.env scripts/trigger-processing.mjs \
//     --s3-key youtube_<id>/original.mp4 --user-email <email> [--display-name <url>]
import { PrismaClient } from "@prisma/client";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const s3Key = arg("s3-key");
const userEmail = arg("user-email");
const displayName = arg("display-name") ?? s3Key;
if (!s3Key || !userEmail) {
  console.error("Required: --s3-key <key> --user-email <email>");
  process.exit(1);
}

const eventKey = process.env.INNGEST_EVENT_KEY;
if (!eventKey) {
  console.error("INNGEST_EVENT_KEY is not set.");
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.user.findUniqueOrThrow({
  where: { email: userEmail },
  select: { id: true, credits: true },
});
console.log(`User ${userEmail} (${user.id}), credits: ${user.credits}`);
if (user.credits <= 0) {
  console.error("User has no credits; seed credits first.");
  process.exit(1);
}

const uploadedFile = await prisma.uploadedFile.create({
  data: { s3Key, displayName, userId: user.id, uploaded: true },
});
console.log(`UploadedFile created: ${uploadedFile.id}`);

const res = await fetch(`https://inn.gs/e/${eventKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "process-video-events",
    data: { uploadedFileId: uploadedFile.id, userId: user.id },
  }),
});
if (!res.ok) {
  console.error(`Inngest event send failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log("Inngest event sent:", await res.json());
console.log("Watch progress in the Inngest dashboard or the app's queue table.");

await prisma.$disconnect();
