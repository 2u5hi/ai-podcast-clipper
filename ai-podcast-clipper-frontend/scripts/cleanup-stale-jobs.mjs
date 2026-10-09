// removes job rows whose upload never finished: a signed URL was issued but the file never arrived
// (failed and no-moment jobs are kept: users see their reasons and refunds on the dashboard)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const r = await prisma.uploadedFile.deleteMany({
  where: {
    uploaded: false,
    // the upload URL lasts 10 minutes; a day leaves plenty of room
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});
console.log("Deleted abandoned uploads:", r.count);
await prisma.$disconnect();
