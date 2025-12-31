import { describe, it, expect } from "vitest";
import {
  normalizePath,
  isAbsolutePath,
  isValidRelativePath,
  isPathWithinRoot,
  dirname,
  joinPath,
  resolveImportPath,
  createMemoryFileResolver,
} from "../imports/index.js";

describe("normalizePath", () => {
  describe("basic normalization", () => {
    it("converts backslashes to forward slashes", () => {
      expect(normalizePath("foo\\bar\\baz.workpipe")).toBe("foo/bar/baz.workpipe");
    });

    it("removes duplicate slashes", () => {
      expect(normalizePath("foo//bar///baz.workpipe")).toBe("foo/bar/baz.workpipe");
    });

    it("preserves single dots at the start", () => {
      expect(normalizePath("./types.workpipe")).toBe("./types.workpipe");
    });

    it("resolves . in the middle of the path", () => {
      expect(normalizePath("./foo/./bar/./types.workpipe")).toBe("./foo/bar/types.workpipe");
    });

    it("returns . for empty-ish paths", () => {
      expect(normalizePath("")).toBe(".");
    });
  });

  describe("parent directory resolution", () => {
    it("resolves simple .. paths", () => {
      expect(normalizePath("./foo/../bar/types.workpipe")).toBe("./bar/types.workpipe");
    });

    it("resolves multiple .. in sequence", () => {
      expect(normalizePath("./foo/bar/../../baz/types.workpipe")).toBe("./baz/types.workpipe");
    });

    it("preserves leading .. for relative paths", () => {
      expect(normalizePath("../shared/types.workpipe")).toBe("../shared/types.workpipe");
    });

    it("preserves multiple leading .. segments", () => {
      expect(normalizePath("../../common/types.workpipe")).toBe("../../common/types.workpipe");
    });

    it("handles complex nested .. resolution", () => {
      expect(normalizePath("./foo/bar/../baz/../qux/types.workpipe")).toBe("./foo/qux/types.workpipe");
    });
  });

  describe("absolute paths", () => {
    it("normalizes Unix absolute paths", () => {
      expect(normalizePath("/home/user/project/types.workpipe")).toBe("/home/user/project/types.workpipe");
    });

    it("normalizes Windows paths with backslashes", () => {
      expect(normalizePath("C:\\Users\\user\\project\\types.workpipe")).toBe("C:/Users/user/project/types.workpipe");
    });

    it("handles .. in absolute paths without escaping root", () => {
      expect(normalizePath("/home/user/../other/types.workpipe")).toBe("/home/other/types.workpipe");
    });

    it("does not go above root for absolute paths", () => {
      expect(normalizePath("/home/../../../types.workpipe")).toBe("/types.workpipe");
    });
  });

  describe("Windows-style paths", () => {
    it("handles Windows drive letters", () => {
      expect(normalizePath("C:/Users/user/project/types.workpipe")).toBe("C:/Users/user/project/types.workpipe");
    });

    it("converts Windows backslashes with drive letter", () => {
      expect(normalizePath("D:\\Projects\\workpipe\\types.workpipe")).toBe("D:/Projects/workpipe/types.workpipe");
    });

    it("handles mixed slashes on Windows", () => {
      expect(normalizePath("C:/Users\\user/project\\types.workpipe")).toBe("C:/Users/user/project/types.workpipe");
    });
  });
});

describe("isAbsolutePath", () => {
  it("returns true for Unix absolute paths", () => {
    expect(isAbsolutePath("/home/user/types.workpipe")).toBe(true);
    expect(isAbsolutePath("/")).toBe(true);
    expect(isAbsolutePath("/foo")).toBe(true);
  });

  it("returns true for Windows absolute paths", () => {
    expect(isAbsolutePath("C:/Users/types.workpipe")).toBe(true);
    expect(isAbsolutePath("C:\\Users\\types.workpipe")).toBe(true);
    expect(isAbsolutePath("D:/Projects/types.workpipe")).toBe(true);
  });

  it("returns true for UNC paths", () => {
    expect(isAbsolutePath("\\\\server\\share\\types.workpipe")).toBe(true);
    expect(isAbsolutePath("//server/share/types.workpipe")).toBe(true);
  });

  it("returns false for relative paths", () => {
    expect(isAbsolutePath("./types.workpipe")).toBe(false);
    expect(isAbsolutePath("../types.workpipe")).toBe(false);
    expect(isAbsolutePath("types.workpipe")).toBe(false);
    expect(isAbsolutePath("foo/bar/types.workpipe")).toBe(false);
  });
});

describe("isValidRelativePath", () => {
  it("returns true for paths starting with ./", () => {
    expect(isValidRelativePath("./types.workpipe")).toBe(true);
    expect(isValidRelativePath("./foo/bar/types.workpipe")).toBe(true);
  });

  it("returns true for paths starting with ../", () => {
    expect(isValidRelativePath("../types.workpipe")).toBe(true);
    expect(isValidRelativePath("../../foo/types.workpipe")).toBe(true);
  });

  it("handles Windows backslashes", () => {
    expect(isValidRelativePath(".\\types.workpipe")).toBe(true);
    expect(isValidRelativePath("..\\types.workpipe")).toBe(true);
  });

  it("returns false for bare relative paths", () => {
    expect(isValidRelativePath("types.workpipe")).toBe(false);
    expect(isValidRelativePath("foo/types.workpipe")).toBe(false);
  });

  it("returns false for absolute paths", () => {
    expect(isValidRelativePath("/etc/types.workpipe")).toBe(false);
    expect(isValidRelativePath("C:/types.workpipe")).toBe(false);
  });
});

describe("dirname", () => {
  it("returns directory for simple paths", () => {
    expect(dirname("./types.workpipe")).toBe(".");
    expect(dirname("./foo/types.workpipe")).toBe("./foo");
  });

  it("returns directory for nested paths", () => {
    expect(dirname("./foo/bar/baz/types.workpipe")).toBe("./foo/bar/baz");
  });

  it("returns . for bare filenames", () => {
    expect(dirname("types.workpipe")).toBe(".");
  });

  it("returns / for root files", () => {
    expect(dirname("/types.workpipe")).toBe("/");
  });

  it("handles Windows paths", () => {
    expect(dirname("C:/Users/user/types.workpipe")).toBe("C:/Users/user");
  });
});

describe("joinPath", () => {
  it("joins simple paths", () => {
    expect(joinPath("./foo", "bar.workpipe")).toBe("./foo/bar.workpipe");
  });

  it("joins multiple segments", () => {
    expect(joinPath("./foo", "bar", "baz.workpipe")).toBe("./foo/bar/baz.workpipe");
  });

  it("normalizes the result", () => {
    expect(joinPath("./foo", "../bar.workpipe")).toBe("./bar.workpipe");
  });

  it("handles trailing slashes", () => {
    expect(joinPath("./foo/", "bar.workpipe")).toBe("./foo/bar.workpipe");
  });

  it("returns . for empty input", () => {
    expect(joinPath()).toBe(".");
  });
});

describe("isPathWithinRoot", () => {
  it("returns true for paths inside root", () => {
    expect(isPathWithinRoot("/project/src/types.workpipe", "/project")).toBe(true);
    expect(isPathWithinRoot("/project/types.workpipe", "/project")).toBe(true);
  });

  it("returns true for root itself", () => {
    expect(isPathWithinRoot("/project", "/project")).toBe(true);
  });

  it("returns false for paths outside root", () => {
    expect(isPathWithinRoot("/other/types.workpipe", "/project")).toBe(false);
    expect(isPathWithinRoot("/projectfoo/types.workpipe", "/project")).toBe(false);
  });

  it("handles trailing slashes in root", () => {
    expect(isPathWithinRoot("/project/src/types.workpipe", "/project/")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPathWithinRoot("/Project/src/types.workpipe", "/project")).toBe(true);
    expect(isPathWithinRoot("/PROJECT/src/types.workpipe", "/project")).toBe(true);
  });

  it("handles Windows paths", () => {
    expect(isPathWithinRoot("C:/Project/src/types.workpipe", "C:/Project")).toBe(true);
    expect(isPathWithinRoot("C:/Other/types.workpipe", "C:/Project")).toBe(false);
  });
});

describe("resolveImportPath", () => {
  describe("successful resolution", () => {
    it("resolves ./types.workpipe from /project/src/main.workpipe", () => {
      const result = resolveImportPath("./types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("/project/src/types.workpipe");
      }
    });

    it("resolves ../shared/types.workpipe from /project/src/main.workpipe", () => {
      const result = resolveImportPath("../shared/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("/project/shared/types.workpipe");
      }
    });

    it("resolves paths with .. in the middle", () => {
      const result = resolveImportPath("./foo/../bar/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("/project/src/bar/types.workpipe");
      }
    });

    it("resolves deeply nested paths", () => {
      const result = resolveImportPath("../../common/types.workpipe", "/project/src/deep/nested/main.workpipe");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("/project/src/common/types.workpipe");
      }
    });
  });

  describe("WP7006 - absolute path rejection", () => {
    it("rejects Unix absolute paths", () => {
      const result = resolveImportPath("/etc/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7006");
        expect(result.diagnostic.message).toContain("Absolute import paths are not allowed");
      }
    });

    it("rejects Windows absolute paths", () => {
      const result = resolveImportPath("C:/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7006");
      }
    });

    it("rejects UNC paths", () => {
      const result = resolveImportPath("//server/share/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7006");
      }
    });
  });

  describe("WP7006 - invalid relative path rejection", () => {
    it("rejects bare relative paths without ./", () => {
      const result = resolveImportPath("types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7006");
        expect(result.diagnostic.message).toContain("Invalid import path");
        expect(result.diagnostic.hint).toContain("'./'");
      }
    });

    it("rejects paths starting with folder name", () => {
      const result = resolveImportPath("shared/types.workpipe", "/project/src/main.workpipe");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7006");
      }
    });
  });

  describe("WP7007 - path escaping project root", () => {
    it("rejects paths that escape project root", () => {
      const result = resolveImportPath(
        "../../outside.workpipe",
        "/project/src/main.workpipe",
        "/project"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7007");
        expect(result.diagnostic.message).toContain("escapes project root");
      }
    });

    it("rejects deeply escaping paths", () => {
      const result = resolveImportPath(
        "../../../../../../../etc/passwd",
        "/project/src/main.workpipe",
        "/project"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.code).toBe("WP7007");
      }
    });

    it("allows paths at project root boundary", () => {
      const result = resolveImportPath(
        "../types.workpipe",
        "/project/src/main.workpipe",
        "/project"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("/project/types.workpipe");
      }
    });

    it("allows paths when no project root is specified", () => {
      const result = resolveImportPath(
        "../../../outside.workpipe",
        "/project/src/main.workpipe"
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Windows-style path handling", () => {
    it("handles Windows-style fromFile paths", () => {
      const result = resolveImportPath(
        "./types.workpipe",
        "C:\\Users\\user\\project\\src\\main.workpipe"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolvedPath).toBe("C:/Users/user/project/src/types.workpipe");
      }
    });

    it("handles mixed slashes in paths", () => {
      const result = resolveImportPath(
        ".\\types.workpipe",
        "C:/Users/user/project/src/main.workpipe"
      );

      expect(result.success).toBe(true);
    });
  });

  describe("span handling", () => {
    it("includes span in error diagnostics", () => {
      const span = { start: 10, end: 30 };
      const result = resolveImportPath(
        "/absolute/path.workpipe",
        "/project/src/main.workpipe",
        undefined,
        span
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.span).toEqual(span);
      }
    });

    it("uses default span when not provided", () => {
      const result = resolveImportPath(
        "/absolute/path.workpipe",
        "/project/src/main.workpipe"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.diagnostic.span).toEqual({ start: 0, end: 0 });
      }
    });
  });
});

describe("createMemoryFileResolver", () => {
  const files = {
    "/project/src/main.workpipe": "workflow main {}",
    "/project/src/types.workpipe": "type Foo { x: string }",
    "/project/shared/common.workpipe": "type Bar { y: int }",
  };

  it("resolves existing files", async () => {
    const resolver = createMemoryFileResolver(files);
    const result = await resolver.resolve("./types.workpipe", "/project/src/main.workpipe");

    expect(result).toBe("/project/src/types.workpipe");
  });

  it("resolves files with parent directory", async () => {
    const resolver = createMemoryFileResolver(files);
    const result = await resolver.resolve("../shared/common.workpipe", "/project/src/main.workpipe");

    expect(result).toBe("/project/shared/common.workpipe");
  });

  it("returns null for non-existent files", async () => {
    const resolver = createMemoryFileResolver(files);
    const result = await resolver.resolve("./nonexistent.workpipe", "/project/src/main.workpipe");

    expect(result).toBeNull();
  });

  it("reads file contents", async () => {
    const resolver = createMemoryFileResolver(files);
    const content = await resolver.read("/project/src/types.workpipe");

    expect(content).toBe("type Foo { x: string }");
  });

  it("throws for reading non-existent files", async () => {
    const resolver = createMemoryFileResolver(files);

    await expect(resolver.read("/nonexistent.workpipe")).rejects.toThrow("File not found");
  });

  it("checks file existence", async () => {
    const resolver = createMemoryFileResolver(files);

    expect(await resolver.exists("/project/src/types.workpipe")).toBe(true);
    expect(await resolver.exists("/nonexistent.workpipe")).toBe(false);
  });

  it("is case-insensitive for paths", async () => {
    const resolver = createMemoryFileResolver(files);

    expect(await resolver.exists("/PROJECT/SRC/TYPES.workpipe")).toBe(true);
    expect(await resolver.exists("/Project/Src/Types.workpipe")).toBe(true);
  });

  it("works with Map input", async () => {
    const fileMap = new Map([
      ["/project/types.workpipe", "type Baz { z: bool }"],
    ]);
    const resolver = createMemoryFileResolver(fileMap);

    expect(await resolver.exists("/project/types.workpipe")).toBe(true);
    expect(await resolver.read("/project/types.workpipe")).toBe("type Baz { z: bool }");
  });
});
