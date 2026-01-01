import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  findClosestMatch,
  validateImportPath,
  detectCircularImports,
  detectDuplicateImports,
  createTypeNotFoundDiagnostic,
  createNameCollisionDiagnostic,
  createFileNotFoundDiagnostic,
  ImportGraph,
  type ImportDeclaration,
} from "../imports/index.js";
import { IMPORT_DIAGNOSTICS } from "../diagnostics/index.js";
import { compileWithImports, createImportContext } from "../compile.js";
import { createMemoryFileResolver } from "../imports/file-resolver.js";

describe("Levenshtein distance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns string length for empty comparisons", () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
    expect(levenshteinDistance("hello", "")).toBe(5);
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("calculates single character difference", () => {
    expect(levenshteinDistance("hello", "hallo")).toBe(1);
    expect(levenshteinDistance("hello", "helloo")).toBe(1);
    expect(levenshteinDistance("hello", "ello")).toBe(1);
  });

  it("calculates multiple character differences", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("handles transpositions", () => {
    expect(levenshteinDistance("ab", "ba")).toBe(2);
  });

  it("handles case differences", () => {
    expect(levenshteinDistance("Hello", "hello")).toBe(1);
  });
});

describe("findClosestMatch", () => {
  it("returns undefined for empty candidates", () => {
    expect(findClosestMatch("test", [])).toBeUndefined();
  });

  it("returns exact match when available", () => {
    expect(findClosestMatch("BuildInfo", ["BuildInfo", "Config", "Status"])).toBe("BuildInfo");
  });

  it("returns closest match within threshold", () => {
    expect(findClosestMatch("BuildInof", ["BuildInfo", "Config", "Status"])).toBe("BuildInfo");
    expect(findClosestMatch("Confg", ["BuildInfo", "Config", "Status"])).toBe("Config");
  });

  it("returns undefined when no match within threshold", () => {
    expect(findClosestMatch("XYZ", ["BuildInfo", "Config", "Status"])).toBeUndefined();
  });

  it("uses case-insensitive matching", () => {
    expect(findClosestMatch("buildinfo", ["BuildInfo", "Config"])).toBe("BuildInfo");
  });

  it("respects custom threshold", () => {
    expect(findClosestMatch("BuildInof", ["BuildInfo"], 1)).toBeUndefined();
    expect(findClosestMatch("BuildInof", ["BuildInfo"], 2)).toBe("BuildInfo");
  });

  it("handles common typos", () => {
    expect(findClosestMatch("Buidlinfo", ["BuildInfo"])).toBe("BuildInfo");
    expect(findClosestMatch("DeployReslt", ["DeployResult", "TestResult"])).toBe("DeployResult");
  });
});

describe("WP7001 - Circular import detected", () => {
  it("detects direct circular import (A -> B -> A)", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/b.workpipe", importedNames: ["TypeB"] }]);
    graph.addFile("/b.workpipe", [{ from: "/b.workpipe", to: "/a.workpipe", importedNames: ["TypeA"] }]);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe(IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.code);
    expect(diagnostic?.message).toContain("Circular import detected");
    expect(diagnostic?.hint).toContain("Import cycle:");
  });

  it("detects self-referential import (A -> A)", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/a.workpipe", importedNames: ["SelfType"] }]);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe(IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.code);
  });

  it("detects transitive circular import (A -> B -> C -> A)", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/b.workpipe", importedNames: ["TypeB"] }]);
    graph.addFile("/b.workpipe", [{ from: "/b.workpipe", to: "/c.workpipe", importedNames: ["TypeC"] }]);
    graph.addFile("/c.workpipe", [{ from: "/c.workpipe", to: "/a.workpipe", importedNames: ["TypeA"] }]);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.code).toBe(IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.code);
  });

  it("returns null when no cycle exists", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/b.workpipe", importedNames: ["TypeB"] }]);
    graph.addFile("/b.workpipe", [{ from: "/b.workpipe", to: "/c.workpipe", importedNames: ["TypeC"] }]);
    graph.addFile("/c.workpipe", []);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic).toBeNull();
  });

  it("includes hint about extracting shared types", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/b.workpipe", importedNames: ["TypeB"] }]);
    graph.addFile("/b.workpipe", [{ from: "/b.workpipe", to: "/a.workpipe", importedNames: ["TypeA"] }]);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic?.hint).toContain("Extract shared types");
  });
});

describe("WP7002 - Import file not found", () => {
  it("creates diagnostic with correct code", () => {
    const diagnostic = createFileNotFoundDiagnostic(
      "./missing.workpipe",
      { start: 0, end: 30 }
    );

    expect(diagnostic.code).toBe(IMPORT_DIAGNOSTICS.FILE_NOT_FOUND.code);
    expect(diagnostic.message).toContain("Cannot resolve import path");
    expect(diagnostic.message).toContain("missing.workpipe");
    expect(diagnostic.hint).toContain("Check that the file exists");
  });

  it("includes path in message", () => {
    const diagnostic = createFileNotFoundDiagnostic(
      "./deep/nested/path.workpipe",
      { start: 0, end: 50 }
    );

    expect(diagnostic.message).toContain("deep/nested/path.workpipe");
  });
});

describe("WP7002 - file not found in compileWithImports", () => {
  it("reports error for non-existent import file", async () => {
    const files = {
      "/project/main.workpipe": `
import { SomeType } from "./nonexistent.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("echo")]
  }
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(false);
    const error = result.diagnostics.find(
      (d) => d.code === IMPORT_DIAGNOSTICS.FILE_NOT_FOUND.code
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("nonexistent.workpipe");
  });
});

describe("WP7003 - Type not exported", () => {
  it("creates diagnostic with suggestion for typo", () => {
    const diagnostic = createTypeNotFoundDiagnostic(
      "BuildInof",
      "./types.workpipe",
      ["BuildInfo", "DeployResult", "TestSummary"],
      { start: 10, end: 20 }
    );

    expect(diagnostic.code).toBe(IMPORT_DIAGNOSTICS.TYPE_NOT_EXPORTED.code);
    expect(diagnostic.message).toContain("BuildInof");
    expect(diagnostic.message).toContain("does not exist");
    expect(diagnostic.hint).toContain("Did you mean 'BuildInfo'?");
  });

  it("lists available types when no close match", () => {
    const diagnostic = createTypeNotFoundDiagnostic(
      "CompletelyDifferent",
      "./types.workpipe",
      ["BuildInfo", "DeployResult"],
      { start: 10, end: 20 }
    );

    expect(diagnostic.hint).toContain("Available types");
    expect(diagnostic.hint).toContain("BuildInfo");
    expect(diagnostic.hint).toContain("DeployResult");
  });

  it("shows empty message when no types available", () => {
    const diagnostic = createTypeNotFoundDiagnostic(
      "SomeType",
      "./empty.workpipe",
      [],
      { start: 10, end: 20 }
    );

    expect(diagnostic.hint).toContain("No exportable types");
  });
});

describe("WP7004 - Duplicate import", () => {
  it("detects duplicate import of same type from same file", () => {
    const imports: ImportDeclaration[] = [
      {
        path: "./types.workpipe",
        items: [
          { name: "BuildInfo", span: { start: 10, end: 20 } },
          { name: "BuildInfo", span: { start: 25, end: 35 } },
        ],
        span: { start: 0, end: 50 },
      },
    ];

    const diagnostics = detectDuplicateImports(imports);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(IMPORT_DIAGNOSTICS.DUPLICATE_IMPORT.code);
    expect(diagnostics[0].message).toContain("BuildInfo");
    expect(diagnostics[0].message).toContain("already imported");
  });

  it("allows same type from different files", () => {
    const imports: ImportDeclaration[] = [
      {
        path: "./types-a.workpipe",
        items: [{ name: "Config", span: { start: 10, end: 20 } }],
        span: { start: 0, end: 50 },
      },
      {
        path: "./types-b.workpipe",
        items: [{ name: "Config", span: { start: 60, end: 70 } }],
        span: { start: 55, end: 100 },
      },
    ];

    const diagnostics = detectDuplicateImports(imports);

    expect(diagnostics).toHaveLength(0);
  });

  it("detects multiple duplicates", () => {
    const imports: ImportDeclaration[] = [
      {
        path: "./types.workpipe",
        items: [
          { name: "TypeA", span: { start: 10, end: 15 } },
          { name: "TypeA", span: { start: 20, end: 25 } },
          { name: "TypeB", span: { start: 30, end: 35 } },
          { name: "TypeB", span: { start: 40, end: 45 } },
        ],
        span: { start: 0, end: 50 },
      },
    ];

    const diagnostics = detectDuplicateImports(imports);

    expect(diagnostics).toHaveLength(2);
  });
});

describe("WP7005 - Name collision", () => {
  it("creates diagnostic for local collision", () => {
    const diagnostic = createNameCollisionDiagnostic(
      "Config",
      "Config",
      undefined,
      false,
      { start: 10, end: 20 }
    );

    expect(diagnostic.code).toBe(IMPORT_DIAGNOSTICS.NAME_COLLISION.code);
    expect(diagnostic.message).toContain("Config");
    expect(diagnostic.message).toContain("already exists");
    expect(diagnostic.message).toContain("defined locally");
    expect(diagnostic.hint).toContain("as <different_name>");
  });

  it("creates diagnostic for imported collision", () => {
    const diagnostic = createNameCollisionDiagnostic(
      "Config",
      "Config",
      "./other.workpipe",
      false,
      { start: 10, end: 20 }
    );

    expect(diagnostic.message).toContain("imported from");
    expect(diagnostic.message).toContain("other.workpipe");
  });

  it("suggests different alias for aliased imports", () => {
    const diagnostic = createNameCollisionDiagnostic(
      "LocalConfig",
      "ExternalConfig",
      undefined,
      true,
      { start: 10, end: 20 }
    );

    expect(diagnostic.hint).toContain("different alias");
  });
});

describe("WP7006 - Invalid import path", () => {
  it("rejects absolute Unix paths", () => {
    const diagnostics = validateImportPath(
      "/usr/share/types.workpipe",
      "/project/main.workpipe",
      undefined,
      { start: 0, end: 30 }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(IMPORT_DIAGNOSTICS.INVALID_PATH.code);
    expect(diagnostics[0].message).toContain("Absolute import paths are not allowed");
  });

  it("rejects absolute Windows paths", () => {
    const diagnostics = validateImportPath(
      "C:/Users/types.workpipe",
      "/project/main.workpipe",
      undefined,
      { start: 0, end: 30 }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(IMPORT_DIAGNOSTICS.INVALID_PATH.code);
  });

  it("rejects bare paths without ./ prefix", () => {
    const diagnostics = validateImportPath(
      "types.workpipe",
      "/project/main.workpipe",
      undefined,
      { start: 0, end: 20 }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(IMPORT_DIAGNOSTICS.INVALID_PATH.code);
    expect(diagnostics[0].hint).toContain("must start with './' or '../'");
  });

  it("accepts valid relative paths", () => {
    const diagnostics1 = validateImportPath(
      "./types.workpipe",
      "/project/main.workpipe",
      undefined,
      { start: 0, end: 20 }
    );

    const diagnostics2 = validateImportPath(
      "../shared/types.workpipe",
      "/project/sub/main.workpipe",
      undefined,
      { start: 0, end: 30 }
    );

    expect(diagnostics1).toHaveLength(0);
    expect(diagnostics2).toHaveLength(0);
  });
});

describe("WP7007 - Path escapes project root", () => {
  it("detects paths that escape project root", () => {
    const diagnostics = validateImportPath(
      "../../outside.workpipe",
      "/project/sub/main.workpipe",
      "/project",
      { start: 0, end: 30 }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(IMPORT_DIAGNOSTICS.PATH_ESCAPES_ROOT.code);
    expect(diagnostics[0].message).toContain("escapes project root");
  });

  it("accepts paths within project root", () => {
    const diagnostics = validateImportPath(
      "../types.workpipe",
      "/project/sub/main.workpipe",
      "/project",
      { start: 0, end: 25 }
    );

    expect(diagnostics).toHaveLength(0);
  });

  it("skips root check when projectRoot not provided", () => {
    const diagnostics = validateImportPath(
      "../../outside.workpipe",
      "/project/sub/main.workpipe",
      undefined,
      { start: 0, end: 30 }
    );

    expect(diagnostics).toHaveLength(0);
  });
});

describe("compileWithImports integration - circular imports", () => {
  it("detects circular import between two files", async () => {
    const files = {
      "/project/a.workpipe": `
import { TypeB } from "./b.workpipe"

type TypeA {
  value: string
}

workflow a {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo")]
  }
}
`,
      "/project/b.workpipe": `
import { TypeA } from "./a.workpipe"

type TypeB {
  value: string
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/a.workpipe"],
      filePath: "/project/a.workpipe",
      importContext,
    });

    expect(result.success).toBe(false);
    const circularError = result.diagnostics.find(
      (d) => d.code === IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.code
    );
    expect(circularError).toBeDefined();
    expect(circularError?.hint).toContain("Import cycle:");
  });
});

describe("compileWithImports integration - type not found with suggestions", () => {
  it("suggests similar type name for typo", async () => {
    const files = {
      "/project/types.workpipe": `
type BuildInfo {
  version: string
}

type DeployResult {
  status: string
}
`,
      "/project/main.workpipe": `
import { BuildInof } from "./types.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("echo")]
  }
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(false);
    const error = result.diagnostics.find(
      (d) => d.code === IMPORT_DIAGNOSTICS.TYPE_NOT_EXPORTED.code
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("BuildInof");
  });
});

describe("error format compliance", () => {
  it("WP7001 has correct severity", () => {
    const graph = new ImportGraph();
    graph.addFile("/a.workpipe", [{ from: "/a.workpipe", to: "/b.workpipe", importedNames: ["T"] }]);
    graph.addFile("/b.workpipe", [{ from: "/b.workpipe", to: "/a.workpipe", importedNames: ["T"] }]);

    const diagnostic = detectCircularImports(graph, "/a.workpipe", { start: 0, end: 10 });

    expect(diagnostic?.severity).toBe("error");
  });

  it("WP7002 has correct severity", () => {
    const diagnostic = createFileNotFoundDiagnostic("./missing.workpipe", { start: 0, end: 10 });
    expect(diagnostic.severity).toBe("error");
  });

  it("WP7003 has correct severity", () => {
    const diagnostic = createTypeNotFoundDiagnostic("T", "./file.workpipe", [], { start: 0, end: 10 });
    expect(diagnostic.severity).toBe("error");
  });

  it("WP7004 has correct severity", () => {
    const diagnostics = detectDuplicateImports([
      {
        path: "./types.workpipe",
        items: [
          { name: "T", span: { start: 0, end: 5 } },
          { name: "T", span: { start: 10, end: 15 } },
        ],
        span: { start: 0, end: 20 },
      },
    ]);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("WP7005 has correct severity", () => {
    const diagnostic = createNameCollisionDiagnostic("T", "T", undefined, false, { start: 0, end: 10 });
    expect(diagnostic.severity).toBe("error");
  });

  it("WP7006 has correct severity", () => {
    const diagnostics = validateImportPath("/absolute/path", "/from.workpipe", undefined, { start: 0, end: 10 });
    expect(diagnostics[0].severity).toBe("error");
  });
});
