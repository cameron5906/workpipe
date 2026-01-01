import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
  esbuild: {
    target: "node18",
  },
  resolve: {
    alias: {
      "./shell-tokenizer.js": path.resolve(__dirname, "src/shell-tokenizer.ts"),
    },
  },
});
