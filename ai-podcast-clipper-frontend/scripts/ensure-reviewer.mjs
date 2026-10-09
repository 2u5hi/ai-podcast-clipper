// create/update a test account with a known password and credits
// usage: node --env-file=.env scripts/ensure-reviewer.mjs --email <email> --password <pw> --credits 50
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg("email");
const password = arg("password") ?? process.env.REVIEWER_PASSWORD;
const credits = Number(arg("credits") ?? 50);
if (!email || !password) {
  console.error(
    "Required: --email <email> --password <password> (or REVIEWER_PASSWORD)",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const hashed = await bcrypt.hash(password, 10);

// sets the balance to --credits with one ADMIN_ADJUSTMENT ledger row for the difference (ADR 0013)
const user = await prisma.$transaction(async (tx) => {
  const account = await tx.user.upsert({
    where: { email },
    update: { password: hashed },
    create: { email, password: hashed },
  });
  const delta = credits - account.credits;
  if (delta === 0) return account;
  await tx.creditLedgerEntry.create({
    data: { userId: account.id, delta, reason: "ADMIN_ADJUSTMENT" },
  });
  return tx.user.update({
    where: { id: account.id },
    data: { credits: { increment: delta } },
  });
});
console.log(`Reviewer account ready: ${user.email}, credits: ${user.credits}`);

await prisma.$disconnect();
