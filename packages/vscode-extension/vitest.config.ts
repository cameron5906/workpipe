import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    alias: {
      vscode: path.resolve(__dirname, "src/__tests__/__mocks__/vscode.ts"),
    },
  },
});
