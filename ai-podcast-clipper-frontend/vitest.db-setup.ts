import { execSync } from "node:child_process";

// Rebuilds the test database from the migrations before the *.db.test.ts files run.
// Without TEST_DATABASE_URL those files skip themselves and this does nothing.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  // a reset drops every table, so never point it at anything but a local database
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `TEST_DATABASE_URL must be a local database, got host ${host}`,
    );
  }

  execSync("npx prisma migrate reset --force --skip-generate --skip-seed", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
