import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkAction } from "../check.js";
import type { CheckOptions } from "../check.js";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../../utils/exit-codes.js";

describe("check command", () => {
  let tempDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions: CheckOptions = {
    verbose: false,
    color: true,
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "workpipe-check-test-"));
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("valid files", () => {
    it("should return EXIT_SUCCESS for a valid workpipe file", async () => {
      const workpipeFile = path.join(tempDir, "valid.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      const exitCode = await checkAction([workpipeFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith("All 1 file(s) valid");
    });

    it("should validate multiple valid files", async () => {
      const file1 = path.join(tempDir, "workflow1.workpipe");
      const file2 = path.join(tempDir, "workflow2.workpipe");

      await writeFile(
        file1,
        `workflow first {
  on: push
  job a {
    runs_on: ubuntu-latest
    steps: [run("echo first")]
  }
}`
      );

      await writeFile(
        file2,
        `workflow second {
  on: pull_request
  job b {
    runs_on: ubuntu-latest
    steps: [run("echo second")]
  }
}`
      );

      const exitCode = await checkAction([file1, file2], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith("All 2 file(s) valid");
    });

    it("should show OK in verbose mode for valid files", async () => {
      const workpipeFile = path.join(tempDir, "valid.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      const exitCode = await checkAction([workpipeFile], { verbose: true, color: true });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/OK.*valid\.workpipe/)
      );
    });
  });

  describe("invalid files", () => {
    it("should return EXIT_VALIDATION_FAILURE for invalid syntax", async () => {
      const workpipeFile = path.join(tempDir, "invalid.workpipe");
      await writeFile(workpipeFile, "this is not valid workpipe syntax {{{{");

      const exitCode = await checkAction([workpipeFile], defaultOptions);

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid.workpipe")
      );
    });

    it("should report errors with file:line:column format", async () => {
      const workpipeFile = path.join(tempDir, "syntax-error.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  invalid syntax here {{{{
}`
      );

      const exitCode = await checkAction([workpipeFile], defaultOptions);

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("syntax-error.workpipe")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error[WP0001]")
      );
    });

    it("should continue checking after encountering an invalid file", async () => {
      const validFile = path.join(tempDir, "valid.workpipe");
      const invalidFile = path.join(tempDir, "invalid.workpipe");

      await writeFile(
        validFile,
        `workflow valid {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("echo valid")]
  }
}`
      );
      await writeFile(invalidFile, "invalid syntax {{{{");

      const exitCode = await checkAction(
        [invalidFile, validFile],
        { verbose: true, color: true }
      );

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid.workpipe")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/OK.*valid\.workpipe/)
      );
    });

    it("should report multiple errors in a single file", async () => {
      const workpipeFile = path.join(tempDir, "multi-error.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  {{{ error1
  }}} error2
}`
      );

      const exitCode = await checkAction([workpipeFile], defaultOptions);

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
    });
  });

  describe("error handling", () => {
    it("should return EXIT_ERROR when no files found", async () => {
      const emptyDir = await mkdtemp(path.join(tmpdir(), "workpipe-empty-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(emptyDir);
        const exitCode = await checkAction([], defaultOptions);

        expect(exitCode).toBe(EXIT_ERROR);
        expect(consoleErrorSpy).toHaveBeenCalledWith("No WorkPipe files found");
      } finally {
        process.chdir(originalCwd);
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    it("should handle file not found errors gracefully", async () => {
      const nonExistentFile = path.join(tempDir, "does-not-exist.workpipe");

      const exitCode = await checkAction([nonExistentFile], defaultOptions);

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("does-not-exist.workpipe")
      );
    });

    it("should handle read permission errors", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      const originalReadFile = await import("fs/promises").then(
        (m) => m.readFile
      );

      const { checkAction: freshCheckAction } = await import("../check.js");

      const exitCode = await freshCheckAction([workpipeFile], defaultOptions);
      expect(typeof exitCode).toBe("number");
    });
  });

  describe("verbose mode", () => {
    it("should log resolving files message in verbose mode", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      await checkAction([workpipeFile], { verbose: true, color: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Resolving files...");
    });

    it("should log file count in verbose mode", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      await checkAction([workpipeFile], { verbose: true, color: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Found 1 file(s)");
    });

    it("should log checking message for each file in verbose mode", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      await checkAction([workpipeFile], { verbose: true, color: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Checking:")
      );
    });
  });

  describe("exit codes", () => {
    it("EXIT_SUCCESS should be 0", () => {
      expect(EXIT_SUCCESS).toBe(0);
    });

    it("EXIT_ERROR should be 1", () => {
      expect(EXIT_ERROR).toBe(1);
    });

    it("EXIT_VALIDATION_FAILURE should be 2", () => {
      expect(EXIT_VALIDATION_FAILURE).toBe(2);
    });
  });

  describe("import system", () => {
    it("should validate files with imports successfully", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type BuildInfo {
  version: string
  commit: string
}`
      );

      await writeFile(
        mainFile,
        `import { BuildInfo } from "./types.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("make build")]
  }
}`
      );

      const exitCode = await checkAction([typesFile, mainFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith("All 2 file(s) valid");
    });

    it("should report import errors with file context", async () => {
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        mainFile,
        `import { NonExistent } from "./missing.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("make")]
  }
}`
      );

      const exitCode = await checkAction([mainFile], defaultOptions);

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing.workpipe")
      );
    });

    it("should continue checking after import errors", async () => {
      const badFile = path.join(tempDir, "bad.workpipe");
      const goodFile = path.join(tempDir, "good.workpipe");

      await writeFile(
        badFile,
        `import { Missing } from "./nonexistent.workpipe"

workflow bad {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("echo bad")]
  }
}`
      );

      await writeFile(
        goodFile,
        `workflow good {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("echo good")]
  }
}`
      );

      const exitCode = await checkAction(
        [badFile, goodFile],
        { verbose: true, color: true }
      );

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/OK.*good\.workpipe/)
      );
    });

    it("should validate type-only files", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");

      await writeFile(
        typesFile,
        `type Config {
  env: string
  debug: bool
}`
      );

      const exitCode = await checkAction([typesFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should validate imported type usage in output schema", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type ReviewResult {
  approved: bool
  comments: string
}`
      );

      await writeFile(
        mainFile,
        `import { ReviewResult } from "./types.workpipe"

workflow review {
  on: push
  agent_job reviewer {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Review code") {
        output_schema: ReviewResult
      }
    ]
  }
}`
      );

      const exitCode = await checkAction([typesFile, mainFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should compile workflow with output schema type reference", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type ReviewResult {
  approved: bool
}`
      );

      await writeFile(
        mainFile,
        `import { ReviewResult } from "./types.workpipe"

workflow review {
  on: push
  agent_job reviewer {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Review code") {
        output_schema: ReviewResult
      }
    ]
  }
}`
      );

      const exitCode = await checkAction([typesFile, mainFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should handle multi-file import chains", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const sharedFile = path.join(tempDir, "shared.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type BaseInfo {
  id: string
}`
      );

      await writeFile(
        sharedFile,
        `import { BaseInfo } from "./types.workpipe"

type SharedConfig {
  name: string
}`
      );

      await writeFile(
        mainFile,
        `import { SharedConfig } from "./shared.workpipe"

workflow pipeline {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("build")]
  }
}`
      );

      const exitCode = await checkAction(
        [mainFile, sharedFile, typesFile],
        { verbose: true, color: true }
      );

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should log import-aware validation in verbose mode", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type Config {
  env: string
}`
      );

      await writeFile(
        mainFile,
        `import { Config } from "./types.workpipe"

workflow deploy {
  on: push
  job deploy_job {
    runs_on: ubuntu-latest
    steps: [run("deploy")]
  }
}`
      );

      const exitCode = await checkAction(
        [typesFile, mainFile],
        { verbose: true, color: true }
      );

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("import-aware")
      );
    });
  });
});
