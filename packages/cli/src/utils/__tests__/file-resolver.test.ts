import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveFiles,
  DEFAULT_PATTERNS,
  IGNORE_PATTERNS,
} from "../file-resolver.js";

describe("file-resolver", () => {
  describe("constants", () => {
    it("should have correct default patterns", () => {
      expect(DEFAULT_PATTERNS).toEqual(["**/*.workpipe", "**/*.wp"]);
    });

    it("should have correct ignore patterns", () => {
      expect(IGNORE_PATTERNS).toContain("**/node_modules/**");
      expect(IGNORE_PATTERNS).toContain("**/.git/**");
      expect(IGNORE_PATTERNS).toContain("**/dist/**");
      expect(IGNORE_PATTERNS).toContain("**/build/**");
      expect(IGNORE_PATTERNS).toContain("**/.github/workflows/**");
    });
  });

  describe("resolveFiles", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), "workpipe-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("should return empty array when no files match", async () => {
      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toEqual([]);
    });

    it("should find .workpipe files by default", async () => {
      const testFile = path.join(tempDir, "test.workpipe");
      await writeFile(testFile, "test content");

      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(testFile);
    });

    it("should find .wp files by default", async () => {
      const testFile = path.join(tempDir, "test.wp");
      await writeFile(testFile, "test content");

      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(testFile);
    });

    it("should find both .workpipe and .wp files", async () => {
      const wpFile = path.join(tempDir, "a.workpipe");
      const wpShortFile = path.join(tempDir, "b.wp");
      await writeFile(wpFile, "content");
      await writeFile(wpShortFile, "content");

      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toHaveLength(2);
      expect(files).toContain(wpFile);
      expect(files).toContain(wpShortFile);
    });

    it("should resolve explicit file paths", async () => {
      const testFile = path.join(tempDir, "explicit.workpipe");
      await writeFile(testFile, "content");

      const files = await resolveFiles(["explicit.workpipe"], { cwd: tempDir });
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(testFile);
    });

    it("should ignore node_modules by default", async () => {
      const nodeModulesDir = path.join(tempDir, "node_modules");
      await mkdir(nodeModulesDir);
      await writeFile(path.join(nodeModulesDir, "test.workpipe"), "content");
      await writeFile(path.join(tempDir, "root.workpipe"), "content");

      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("root.workpipe");
    });

    it("should find files in subdirectories", async () => {
      const subDir = path.join(tempDir, "src", "workflows");
      await mkdir(subDir, { recursive: true });
      await writeFile(path.join(subDir, "ci.workpipe"), "content");

      const files = await resolveFiles([], { cwd: tempDir });
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("ci.workpipe");
    });

    it("should deduplicate matching files", async () => {
      const testFile = path.join(tempDir, "test.workpipe");
      await writeFile(testFile, "content");

      const files = await resolveFiles(["test.workpipe", "test.workpipe"], {
        cwd: tempDir,
      });
      expect(files).toHaveLength(1);
    });

    it("should use custom patterns when provided", async () => {
      await writeFile(path.join(tempDir, "test.workpipe"), "content");
      await writeFile(path.join(tempDir, "test.custom"), "content");

      const files = await resolveFiles([], {
        cwd: tempDir,
        patterns: ["**/*.custom"],
      });
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("test.custom");
    });
  });
});
