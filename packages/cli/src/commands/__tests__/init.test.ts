import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initAction, generateBootstrapWorkflow } from "../init.js";
import type { InitOptions } from "../init.js";
import { EXIT_SUCCESS, EXIT_ERROR } from "../../utils/exit-codes.js";

describe("init command", () => {
  let tempDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions: InitOptions = {
    bootstrap: false,
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "workpipe-init-test-"));
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initAction", () => {
    it("should print usage hint when no options provided", async () => {
      const exitCode = await initAction(defaultOptions);

      expect(exitCode).toBe(EXIT_SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "WorkPipe init: use --bootstrap to generate the CI workflow"
      );
    });
  });

  describe("generateBootstrapWorkflow", () => {
    it("should create bootstrap workflow file in .github/workflows", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);

      expect(workflowPath).toBe(
        path.join(tempDir, ".github", "workflows", "workpipe-compile.yml")
      );

      await expect(access(workflowPath)).resolves.toBeUndefined();
    });

    it("should write valid YAML content", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("name: WorkPipe Compile");
      expect(content).toContain("on:");
      expect(content).toContain("push:");
      expect(content).toContain("pull_request:");
      expect(content).toContain("workflow_dispatch:");
      expect(content).toContain("permissions:");
      expect(content).toContain("contents: write");
      expect(content).toContain("jobs:");
      expect(content).toContain("compile:");
    });

    it("should include checkout step with token", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("uses: actions/checkout@v4");
      expect(content).toContain("token: ${{ secrets.GITHUB_TOKEN }}");
    });

    it("should include node setup step", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("uses: actions/setup-node@v4");
      expect(content).toContain("node-version: '20'");
    });

    it("should include WorkPipe install and compile steps", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("npm install -g @workpipe/cli");
      expect(content).toContain("workpipe build");
    });

    it("should include git commit logic", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("git diff --quiet");
      expect(content).toContain('echo "changed=true"');
      expect(content).toContain("git config user.name");
      expect(content).toContain("git add .github/workflows/");
      expect(content).toContain("git commit -m");
      expect(content).toContain("git push");
    });

    it("should create directories recursively", async () => {
      const nestedDir = path.join(tempDir, "nested", "project");
      const workflowPath = await generateBootstrapWorkflow(nestedDir);

      expect(workflowPath).toBe(
        path.join(nestedDir, ".github", "workflows", "workpipe-compile.yml")
      );

      await expect(access(workflowPath)).resolves.toBeUndefined();
    });

    it("should include path filters for workpipe files", async () => {
      const workflowPath = await generateBootstrapWorkflow(tempDir);
      const content = await readFile(workflowPath, "utf-8");

      expect(content).toContain("'workpipe/**/*.workpipe'");
      expect(content).toContain("'workpipe/**/*.wp'");
    });
  });

  describe("bootstrap option", () => {
    it("should generate bootstrap workflow when --bootstrap flag is set", async () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        const exitCode = await initAction({ bootstrap: true });

        expect(exitCode).toBe(EXIT_SUCCESS);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("Created:")
        );

        const workflowPath = path.join(
          tempDir,
          ".github",
          "workflows",
          "workpipe-compile.yml"
        );
        await expect(access(workflowPath)).resolves.toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
