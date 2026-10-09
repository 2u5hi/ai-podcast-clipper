// Vercel runs this instead of `next build` (the "vercel-build" script). Production deploys apply the
// committed migrations first (ADR 0014); preview deploys never touch the production database.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
} else {
  console.log(`Skipping migrations for VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}`);
}
run("npx next build");
