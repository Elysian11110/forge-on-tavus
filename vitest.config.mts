import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The project root with a trailing slash, so "@/lib/x" resolves like the tsconfig alias.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: root }],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
