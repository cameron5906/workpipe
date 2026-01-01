import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAction } from "../build.js";
import type { BuildOptions } from "../build.js";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../../utils/exit-codes.js";

describe("build command", () => {
  let tempDir: string;
  let outputDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions: BuildOptions = {
    output: "",
    watch: false,
    dryRun: false,
    verbose: false,
    color: true,
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "workpipe-build-test-"));
    outputDir = path.join(tempDir, "output");
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("workflow name extraction", () => {
    it("should extract workflow name from source", async () => {
      const workpipeFile = path.join(tempDir, "ci.workpipe");
      await writeFile(
        workpipeFile,
        `workflow my_workflow {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      const outputFile = path.join(outputDir, "my_workflow.yml");
      const content = await readFile(outputFile, "utf-8");
      expect(content).toContain("name: my_workflow");
    });

    it("should fall back to filename when workflow name cannot be extracted", async () => {
      const workpipeFile = path.join(tempDir, "fallback.workpipe");
      await writeFile(
        workpipeFile,
        `workflow fallback {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`
      );

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      const outputFile = path.join(outputDir, "fallback.yml");
      const content = await readFile(outputFile, "utf-8");
      expect(content).toContain("name: fallback");
    });
  });

  describe("file compilation", () => {
    it("should compile a valid workpipe file and write output", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo Hello")]
  }
}`
      );

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Wrote:")
      );

      const outputFile = path.join(outputDir, "test.yml");
      const content = await readFile(outputFile, "utf-8");
      expect(content).toContain("name: test");
      expect(content).toContain("on:");
      expect(content).toContain("jobs:");
    });

    it("should create output directory if it does not exist", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo Hello")]
  }
}`
      );

      const nestedOutputDir = path.join(outputDir, "nested", "deep");
      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: nestedOutputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      const outputFile = path.join(nestedOutputDir, "test.yml");
      const content = await readFile(outputFile, "utf-8");
      expect(content).toBeTruthy();
    });

    it("should compile multiple files", async () => {
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

      const exitCode = await buildAction([file1, file2], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);

      const output1 = await readFile(path.join(outputDir, "first.yml"), "utf-8");
      const output2 = await readFile(
        path.join(outputDir, "second.yml"),
        "utf-8"
      );

      expect(output1).toContain("name: first");
      expect(output2).toContain("name: second");
    });
  });

  describe("dry-run mode", () => {
    it("should not write files in dry-run mode", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo Hello")]
  }
}`
      );

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
        dryRun: true,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Would write:")
      );

      await expect(
        readFile(path.join(outputDir, "test.yml"), "utf-8")
      ).rejects.toThrow();
    });

    it("should show YAML content in dry-run mode with verbose", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo Hello")]
  }
}`
      );

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
        dryRun: true,
        verbose: true,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("name: test"));
    });
  });

  describe("error handling", () => {
    it("should return EXIT_ERROR for watch mode (not implemented)", async () => {
      const exitCode = await buildAction([], {
        ...defaultOptions,
        watch: true,
      });

      expect(exitCode).toBe(EXIT_ERROR);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Watch mode is not yet implemented"
      );
    });

    it("should return EXIT_ERROR when no files found", async () => {
      const emptyDir = await mkdtemp(path.join(tmpdir(), "workpipe-empty-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(emptyDir);
        const exitCode = await buildAction([], {
          ...defaultOptions,
          output: outputDir,
        });

        expect(exitCode).toBe(EXIT_ERROR);
        expect(consoleErrorSpy).toHaveBeenCalledWith("No WorkPipe files found");
      } finally {
        process.chdir(originalCwd);
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    it("should return EXIT_VALIDATION_FAILURE for invalid syntax", async () => {
      const workpipeFile = path.join(tempDir, "invalid.workpipe");
      await writeFile(workpipeFile, "this is not valid workpipe syntax {{{{");

      const exitCode = await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error[WP0001]")
      );
    });

    it("should continue processing other files after error", async () => {
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

      const exitCode = await buildAction([invalidFile, validFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);

      const validOutput = await readFile(
        path.join(outputDir, "valid.yml"),
        "utf-8"
      );
      expect(validOutput).toContain("name: valid");
    });
  });

  describe("verbose mode", () => {
    it("should log to stderr in verbose mode", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo Hello")]
  }
}`
      );

      await buildAction([workpipeFile], {
        ...defaultOptions,
        output: outputDir,
        verbose: true,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Compiling:")
      );
    });
  });

  describe("import system", () => {
    it("should compile files with imports", async () => {
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

      const exitCode = await buildAction([typesFile, mainFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      const outputFile = path.join(outputDir, "build.yml");
      const content = await readFile(outputFile, "utf-8");
      expect(content).toContain("name: build");
    });

    it("should produce no output for type-only files", async () => {
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

      const exitCode = await buildAction([typesFile, mainFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("types only, no output")
      );
      const deployOutput = path.join(outputDir, "deploy.yml");
      const content = await readFile(deployOutput, "utf-8");
      expect(content).toContain("name: deploy");
    });

    it("should report import errors with proper file context", async () => {
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

      const exitCode = await buildAction([mainFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing.workpipe")
      );
    });

    it("should continue with other files after import errors", async () => {
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

      const exitCode = await buildAction([badFile, goodFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      const goodOutput = await readFile(
        path.join(outputDir, "good.yml"),
        "utf-8"
      );
      expect(goodOutput).toContain("name: good");
    });

    it("should compile files in dependency order", async () => {
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

      const exitCode = await buildAction(
        [mainFile, sharedFile, typesFile],
        {
          ...defaultOptions,
          output: outputDir,
          verbose: true,
        }
      );

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should use imported types in output schema validation", async () => {
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

      const exitCode = await buildAction([typesFile, mainFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should handle aliased imports", async () => {
      const typesFile = path.join(tempDir, "types.workpipe");
      const mainFile = path.join(tempDir, "main.workpipe");

      await writeFile(
        typesFile,
        `type BuildInfo {
  version: string
}`
      );

      await writeFile(
        mainFile,
        `import { BuildInfo as BI } from "./types.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("make")]
  }
}`
      );

      const exitCode = await buildAction([typesFile, mainFile], {
        ...defaultOptions,
        output: outputDir,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
    });

    it("should log import resolution in verbose mode", async () => {
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

      const exitCode = await buildAction([typesFile, mainFile], {
        ...defaultOptions,
        output: outputDir,
        verbose: true,
      });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("import-aware")
      );
    });
  });
});
