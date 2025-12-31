import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fmtAction } from "../fmt.js";
import type { FmtOptions } from "../fmt.js";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../../utils/exit-codes.js";

describe("fmt command", () => {
  let tempDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteOutput: string[];

  const defaultOptions: FmtOptions = {
    write: false,
    check: false,
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "workpipe-fmt-test-"));
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutWriteOutput = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown): boolean => {
      stdoutWriteOutput.push(String(chunk));
      return true;
    });
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("default mode (stdout)", () => {
    it("outputs formatted content to stdout", async () => {
      const workpipeFile = path.join(tempDir, "test.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test{on:push job hello{runs_on:ubuntu-latest steps:[]}}`
      );

      const exitCode = await fmtAction([workpipeFile], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(stdoutWriteOutput.length).toBeGreaterThan(0);
      const output = stdoutWriteOutput.join("");
      expect(output).toContain("workflow test {");
      expect(output).toContain("on: push");
    });

    it("formats multiple files to stdout", async () => {
      const file1 = path.join(tempDir, "first.workpipe");
      const file2 = path.join(tempDir, "second.workpipe");

      await writeFile(file1, `workflow first{on:push}`);
      await writeFile(file2, `workflow second{on:pull_request}`);

      const exitCode = await fmtAction([file1, file2], defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(stdoutWriteOutput.length).toBe(2);
    });
  });

  describe("--check mode", () => {
    it("returns EXIT_SUCCESS when file is already formatted", async () => {
      const workpipeFile = path.join(tempDir, "formatted.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
}
`
      );

      const exitCode = await fmtAction([workpipeFile], { write: false, check: true });

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("returns EXIT_VALIDATION_FAILURE when file needs formatting", async () => {
      const workpipeFile = path.join(tempDir, "unformatted.workpipe");
      await writeFile(workpipeFile, `workflow test{on:push}`);

      const exitCode = await fmtAction([workpipeFile], { write: false, check: true });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Would format:")
      );
    });

    it("reports all files that need formatting", async () => {
      const file1 = path.join(tempDir, "unformatted1.workpipe");
      const file2 = path.join(tempDir, "unformatted2.workpipe");

      await writeFile(file1, `workflow first{on:push}`);
      await writeFile(file2, `workflow second{on:push}`);

      const exitCode = await fmtAction([file1, file2], { write: false, check: true });

      expect(exitCode).toBe(EXIT_VALIDATION_FAILURE);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("does not modify files in check mode", async () => {
      const workpipeFile = path.join(tempDir, "unchanged.workpipe");
      const originalContent = `workflow test{on:push}`;
      await writeFile(workpipeFile, originalContent);

      await fmtAction([workpipeFile], { write: false, check: true });

      const content = await readFile(workpipeFile, "utf-8");
      expect(content).toBe(originalContent);
    });
  });

  describe("--write mode", () => {
    it("writes formatted content back to file", async () => {
      const workpipeFile = path.join(tempDir, "toformat.workpipe");
      await writeFile(workpipeFile, `workflow test{on:push}`);

      const exitCode = await fmtAction([workpipeFile], { write: true, check: false });

      expect(exitCode).toBe(EXIT_SUCCESS);

      const content = await readFile(workpipeFile, "utf-8");
      expect(content).toContain("workflow test {");
      expect(content).toContain("on: push");
    });

    it("logs formatted files", async () => {
      const workpipeFile = path.join(tempDir, "toformat.workpipe");
      await writeFile(workpipeFile, `workflow test{on:push}`);

      await fmtAction([workpipeFile], { write: true, check: false });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Formatted:")
      );
    });

    it("does not modify already formatted files", async () => {
      const workpipeFile = path.join(tempDir, "already-formatted.workpipe");
      const formattedContent = `workflow test {
  on: push
}
`;
      await writeFile(workpipeFile, formattedContent);

      await fmtAction([workpipeFile], { write: true, check: false });

      expect(consoleLogSpy).not.toHaveBeenCalled();

      const content = await readFile(workpipeFile, "utf-8");
      expect(content).toBe(formattedContent);
    });

    it("formats multiple files", async () => {
      const file1 = path.join(tempDir, "first.workpipe");
      const file2 = path.join(tempDir, "second.workpipe");

      await writeFile(file1, `workflow first{on:push}`);
      await writeFile(file2, `workflow second{on:push}`);

      const exitCode = await fmtAction([file1, file2], { write: true, check: false });

      expect(exitCode).toBe(EXIT_SUCCESS);

      const content1 = await readFile(file1, "utf-8");
      const content2 = await readFile(file2, "utf-8");

      expect(content1).toContain("workflow first {");
      expect(content2).toContain("workflow second {");
    });
  });

  describe("error handling", () => {
    it("returns EXIT_ERROR when no files found", async () => {
      const emptyDir = await mkdtemp(path.join(tmpdir(), "workpipe-empty-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(emptyDir);
        const exitCode = await fmtAction([], defaultOptions);

        expect(exitCode).toBe(EXIT_ERROR);
        expect(consoleErrorSpy).toHaveBeenCalledWith("No WorkPipe files found");
      } finally {
        process.chdir(originalCwd);
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    it("handles file not found gracefully", async () => {
      const nonExistentFile = path.join(tempDir, "does-not-exist.workpipe");

      const exitCode = await fmtAction([nonExistentFile], defaultOptions);

      expect(exitCode).toBe(EXIT_ERROR);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error processing")
      );
    });
  });

  describe("formatting rules", () => {
    it("applies consistent indentation", async () => {
      const workpipeFile = path.join(tempDir, "indent.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
on: push
job hello {
runs_on: ubuntu-latest
steps: []
}
}`
      );

      await fmtAction([workpipeFile], { write: true, check: false });

      const content = await readFile(workpipeFile, "utf-8");
      expect(content).toContain("  on: push");
      expect(content).toContain("  job hello {");
      expect(content).toContain("    runs_on: ubuntu-latest");
    });

    it("adds trailing newline", async () => {
      const workpipeFile = path.join(tempDir, "newline.workpipe");
      await writeFile(workpipeFile, `workflow test { on: push }`);

      await fmtAction([workpipeFile], { write: true, check: false });

      const content = await readFile(workpipeFile, "utf-8");
      expect(content.endsWith("\n")).toBe(true);
    });

    it("preserves triple-quoted string content", async () => {
      const workpipeFile = path.join(tempDir, "triple-quoted.workpipe");
      await writeFile(
        workpipeFile,
        `workflow test {
  on: push
  cycle loop {
    until guard_js """
      const result = context.score;
      return result > 0.95;
    """
    body { }
  }
}`
      );

      await fmtAction([workpipeFile], { write: true, check: false });

      const content = await readFile(workpipeFile, "utf-8");
      expect(content).toContain("const result = context.score;");
      expect(content).toContain("return result > 0.95;");
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
});
