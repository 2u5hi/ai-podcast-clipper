import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.db-setup.ts"],
    // the *.db.test.ts files share one database
    fileParallelism: false,
    // next-auth imports "next/server" without an extension, which Node's ESM loader rejects; let Vite resolve it
    server: { deps: { inline: ["next-auth"] } },
  },
});
