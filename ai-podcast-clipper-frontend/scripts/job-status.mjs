// quick status check on jobs and clip counts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const files = await prisma.uploadedFile.findMany({
  select: {
    id: true,
    status: true,
    s3Key: true,
    updatedAt: true,
    _count: { select: { clips: true } },
  },
});
console.log(JSON.stringify(files, null, 2));
await prisma.$disconnect();
