import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/lang",
  "packages/compiler",
  "packages/cli",
  "packages/action",
]);
