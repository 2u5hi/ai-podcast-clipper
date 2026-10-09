// The production build on Netlify (netlify.toml) — and on Vercel, via the "vercel-build" script.
// Production deploys apply the committed migrations first (ADR 0014); previews never touch the
// production database. Netlify sets CONTEXT, Vercel sets VERCEL_ENV.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

const production =
  process.env.CONTEXT === "production" || process.env.VERCEL_ENV === "production";

if (production) {
  run("npx prisma migrate deploy");
} else {
  console.log(
    `Skipping migrations (CONTEXT=${process.env.CONTEXT ?? "-"}, VERCEL_ENV=${process.env.VERCEL_ENV ?? "-"})`,
  );
}
run("npx next build");
