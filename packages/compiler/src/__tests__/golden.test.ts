import { describe, it } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGoldenTest, listFixtures } from "../testing/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = resolve(__dirname, "../../../../examples");

describe("Golden tests", () => {
  it("minimal", async () => {
    await runGoldenTest({
      fixturePath: resolve(fixturesDir, "minimal"),
    });
  });

  it("simple-job", async () => {
    await runGoldenTest({
      fixturePath: resolve(fixturesDir, "simple-job"),
    });
  });

  it("agent-task", async () => {
    await runGoldenTest({
      fixturePath: resolve(fixturesDir, "agent-task"),
    });
  });

  it("cycle-basic", async () => {
    await runGoldenTest({
      fixturePath: resolve(fixturesDir, "cycle-basic"),
    });
  });
});
