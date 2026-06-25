// removes job rows with no clips (leftovers from failed runs)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const r = await prisma.uploadedFile.deleteMany({
  where: { clips: { none: {} } },
});
console.log("Deleted stale rows:", r.count);
await prisma.$disconnect();
