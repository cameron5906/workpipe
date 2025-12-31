import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect } from "vitest";
import { compile } from "../index.js";

export interface GoldenTestOptions {
  fixturePath: string;
  inputName?: string;
  expectedName?: string;
  updateSnapshots?: boolean;
}

export async function runGoldenTest(options: GoldenTestOptions): Promise<void> {
  const {
    fixturePath,
    inputName = path.basename(fixturePath) + ".workpipe",
    expectedName = "expected.yml",
    updateSnapshots = process.env.WORKPIPE_UPDATE_SNAPSHOTS === "true",
  } = options;

  const inputPath = path.join(fixturePath, inputName);
  const expectedPath = path.join(fixturePath, expectedName);

  const input = await fs.readFile(inputPath, "utf-8");

  const result = compile(input);

  if (!result.success) {
    throw new Error(
      `Compilation failed:\n${result.diagnostics.map((d) => d.message).join("\n")}`
    );
  }

  const actual = result.value;

  if (updateSnapshots) {
    await fs.writeFile(expectedPath, actual, "utf-8");
    return;
  }

  let expected: string;
  try {
    expected = await fs.readFile(expectedPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Expected output file not found: ${expectedPath}\n` +
          `Run with WORKPIPE_UPDATE_SNAPSHOTS=true to generate it.`
      );
    }
    throw err;
  }

  expect(actual).toBe(expected);
}

export async function listFixtures(
  fixturesDir: string
): Promise<{ name: string; path: string }[]> {
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(fixturesDir, entry.name),
    }));
}
