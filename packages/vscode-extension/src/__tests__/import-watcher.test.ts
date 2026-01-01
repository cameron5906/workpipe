import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { ImportAwareCompilation } from "../import-watcher";

describe("ImportAwareCompilation", () => {
  let importCompilation: ImportAwareCompilation;

  beforeEach(() => {
    importCompilation = new ImportAwareCompilation();
  });

  afterEach(() => {
    importCompilation.dispose();
  });

  describe("basic functionality", () => {
    it("should be created and disposed without error", () => {
      expect(importCompilation).toBeDefined();
      expect(() => importCompilation.dispose()).not.toThrow();
    });

    it("should have an empty import graph initially", () => {
      const graph = importCompilation.getImportGraph();
      expect(graph.size).toBe(0);
    });

    it("should clear caches correctly", () => {
      importCompilation.clearCaches();
      expect(importCompilation.getImportGraph().size).toBe(0);
    });
  });

  describe("getDependentsOf", () => {
    it("should return empty set for unknown file", () => {
      const dependents = importCompilation.getDependentsOf("/unknown/file.workpipe");
      expect(dependents.size).toBe(0);
    });
  });

  describe("getDirectDependentsOf", () => {
    it("should return empty set for unknown file", () => {
      const dependents = importCompilation.getDirectDependentsOf("/unknown/file.workpipe");
      expect(dependents.size).toBe(0);
    });
  });

  describe("getDirectImportsOf", () => {
    it("should return empty set for unknown file", () => {
      const imports = importCompilation.getDirectImportsOf("/unknown/file.workpipe");
      expect(imports.size).toBe(0);
    });
  });

  describe("hasImports", () => {
    it("should return false for file with no imports", () => {
      expect(importCompilation.hasImports("/some/file.workpipe")).toBe(false);
    });
  });

  describe("isImported", () => {
    it("should return false for file that is not imported by any other file", () => {
      expect(importCompilation.isImported("/some/file.workpipe")).toBe(false);
    });
  });

  describe("getCachedContent", () => {
    it("should return undefined for uncached file", () => {
      expect(importCompilation.getCachedContent("/some/file.workpipe")).toBeUndefined();
    });
  });

  describe("onFileChanged", () => {
    it("should debounce file changes", () => {
      vi.useFakeTimers();

      const uri = vscode.Uri.file("/test/file.workpipe");
      importCompilation.onFileChanged(uri);
      importCompilation.onFileChanged(uri);
      importCompilation.onFileChanged(uri);

      vi.advanceTimersByTime(300);

      vi.useRealTimers();
    });

    it("should handle multiple different files", () => {
      vi.useFakeTimers();

      const uri1 = vscode.Uri.file("/test/file1.workpipe");
      const uri2 = vscode.Uri.file("/test/file2.workpipe");

      importCompilation.onFileChanged(uri1);
      importCompilation.onFileChanged(uri2);

      vi.advanceTimersByTime(300);

      vi.useRealTimers();
    });
  });

  describe("dispose", () => {
    it("should clear pending invalidations", () => {
      vi.useFakeTimers();

      const uri = vscode.Uri.file("/test/file.workpipe");
      importCompilation.onFileChanged(uri);

      importCompilation.dispose();

      vi.advanceTimersByTime(1000);

      vi.useRealTimers();
    });
  });
});
