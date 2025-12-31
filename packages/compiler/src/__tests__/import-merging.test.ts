import { describe, it, expect } from "vitest";
import {
  createTypeRegistry,
  type TypeRegistry,
  type ImportItem,
} from "../semantics/type-registry.js";
import {
  compileWithImports,
  createImportContext,
} from "../compile.js";
import { createMemoryFileResolver } from "../imports/file-resolver.js";
import type {
  TypeDeclarationNode,
  TypeFieldNode,
  TypeExpressionNode,
  Span,
} from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10): Span {
  return { start, end };
}

function createPrimitiveType(
  type: "string" | "int" | "float" | "bool" | "json" | "path"
): TypeExpressionNode {
  return { kind: "primitive_type", type, span: createSpan() };
}

function createTypeField(name: string, type: TypeExpressionNode): TypeFieldNode {
  return { kind: "type_field", name, type, span: createSpan() };
}

function createTypeDeclaration(
  name: string,
  fields: TypeFieldNode[] = []
): TypeDeclarationNode {
  return {
    kind: "type_declaration",
    name,
    fields,
    span: createSpan(),
  };
}

describe("TypeRegistry.importTypes", () => {
  describe("single import", () => {
    it("imports a single type successfully", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(
        createTypeDeclaration("BuildInfo", [
          createTypeField("version", createPrimitiveType("string")),
        ])
      );

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "BuildInfo" }],
        "./types.workpipe"
      );

      expect(diagnostics).toHaveLength(0);
      expect(targetRegistry.has("BuildInfo")).toBe(true);
      expect(targetRegistry.resolve("BuildInfo")).toBe(
        sourceRegistry.resolve("BuildInfo")
      );
    });

    it("tracks provenance of imported type", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("Config"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "Config" }],
        "./shared/config.workpipe"
      );

      expect(targetRegistry.getTypeProvenance("Config")).toBe(
        "./shared/config.workpipe"
      );
    });

    it("returns undefined provenance for locally defined types", () => {
      const registry = createTypeRegistry();
      registry.register(createTypeDeclaration("LocalType"));

      expect(registry.getTypeProvenance("LocalType")).toBeUndefined();
    });
  });

  describe("multiple imports from same file", () => {
    it("imports multiple types successfully", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("TypeA"));
      sourceRegistry.register(createTypeDeclaration("TypeB"));
      sourceRegistry.register(createTypeDeclaration("TypeC"));

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "TypeA" }, { name: "TypeB" }, { name: "TypeC" }],
        "./types.workpipe"
      );

      expect(diagnostics).toHaveLength(0);
      expect(targetRegistry.has("TypeA")).toBe(true);
      expect(targetRegistry.has("TypeB")).toBe(true);
      expect(targetRegistry.has("TypeC")).toBe(true);
    });

    it("tracks provenance for all imported types", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("TypeA"));
      sourceRegistry.register(createTypeDeclaration("TypeB"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "TypeA" }, { name: "TypeB" }],
        "./common.workpipe"
      );

      expect(targetRegistry.getTypeProvenance("TypeA")).toBe("./common.workpipe");
      expect(targetRegistry.getTypeProvenance("TypeB")).toBe("./common.workpipe");
    });
  });

  describe("aliased imports", () => {
    it("imports type with alias", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(
        createTypeDeclaration("BuildInfo", [
          createTypeField("version", createPrimitiveType("string")),
        ])
      );

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "BuildInfo", alias: "BI" }],
        "./types.workpipe"
      );

      expect(diagnostics).toHaveLength(0);
      expect(targetRegistry.has("BI")).toBe(true);
      expect(targetRegistry.has("BuildInfo")).toBe(false);
      expect(targetRegistry.resolve("BI")).toBe(
        sourceRegistry.resolve("BuildInfo")
      );
    });

    it("tracks provenance for aliased type", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("Configuration"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "Configuration", alias: "Config" }],
        "./settings.workpipe"
      );

      expect(targetRegistry.getTypeProvenance("Config")).toBe("./settings.workpipe");
      expect(targetRegistry.getTypeProvenance("Configuration")).toBeUndefined();
    });

    it("allows same type imported with different aliases", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("BaseType"));

      const targetRegistry = createTypeRegistry();

      const diag1 = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "BaseType", alias: "AliasA" }],
        "./base.workpipe"
      );

      const diag2 = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "BaseType", alias: "AliasB" }],
        "./base.workpipe"
      );

      expect(diag1).toHaveLength(0);
      expect(diag2).toHaveLength(0);
      expect(targetRegistry.has("AliasA")).toBe(true);
      expect(targetRegistry.has("AliasB")).toBe(true);
    });
  });

  describe("WP7003 - imported type does not exist in source file", () => {
    it("produces diagnostic for non-existent type", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("ExistingType"));

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "NonExistentType" }],
        "./types.workpipe",
        createSpan(10, 50)
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP7003");
      expect(diagnostics[0].message).toContain("NonExistentType");
      expect(diagnostics[0].message).toContain("./types.workpipe");
      expect(diagnostics[0].span).toEqual({ start: 10, end: 50 });
    });

    it("includes available types in hint", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("TypeA"));
      sourceRegistry.register(createTypeDeclaration("TypeB"));

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "TypeC" }],
        "./types.workpipe"
      );

      expect(diagnostics[0].hint).toContain("TypeA");
      expect(diagnostics[0].hint).toContain("TypeB");
    });

    it("shows empty message when no types available", () => {
      const sourceRegistry = createTypeRegistry();

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "SomeType" }],
        "./empty.workpipe"
      );

      expect(diagnostics[0].hint).toContain("No exportable types");
    });

    it("produces diagnostics for each missing type", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("ValidType"));

      const targetRegistry = createTypeRegistry();
      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [
          { name: "MissingA" },
          { name: "ValidType" },
          { name: "MissingB" },
        ],
        "./types.workpipe"
      );

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].code).toBe("WP7003");
      expect(diagnostics[0].message).toContain("MissingA");
      expect(diagnostics[1].code).toBe("WP7003");
      expect(diagnostics[1].message).toContain("MissingB");
      expect(targetRegistry.has("ValidType")).toBe(true);
    });
  });

  describe("WP7005 - name collision", () => {
    it("produces diagnostic when importing name that exists locally", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("Config"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.register(createTypeDeclaration("Config", [], createSpan(100, 150)));

      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "Config" }],
        "./external.workpipe",
        createSpan(10, 50)
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP7005");
      expect(diagnostics[0].message).toContain("Config");
      expect(diagnostics[0].message).toContain("already exists");
    });

    it("suggests using alias to avoid collision", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("Config"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.register(createTypeDeclaration("Config"));

      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "Config" }],
        "./external.workpipe"
      );

      expect(diagnostics[0].hint).toContain("as");
    });

    it("produces diagnostic when alias collides with existing type", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("ExternalConfig"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.register(createTypeDeclaration("LocalConfig"));

      const diagnostics = targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "ExternalConfig", alias: "LocalConfig" }],
        "./external.workpipe"
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP7005");
      expect(diagnostics[0].message).toContain("LocalConfig");
    });

    it("indicates provenance of collision when type was imported", () => {
      const sourceA = createTypeRegistry();
      sourceA.register(createTypeDeclaration("SharedType"));

      const sourceB = createTypeRegistry();
      sourceB.register(createTypeDeclaration("SharedType"));

      const targetRegistry = createTypeRegistry();
      targetRegistry.importTypes(
        sourceA,
        [{ name: "SharedType" }],
        "./source-a.workpipe"
      );

      const diagnostics = targetRegistry.importTypes(
        sourceB,
        [{ name: "SharedType" }],
        "./source-b.workpipe"
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP7005");
      expect(diagnostics[0].message).toContain("imported from");
      expect(diagnostics[0].message).toContain("source-a.workpipe");
    });
  });

  describe("non-transitive imports", () => {
    it("marks imported types as non-exportable", () => {
      const sourceRegistry = createTypeRegistry();
      sourceRegistry.register(createTypeDeclaration("OriginalType"));

      const middleRegistry = createTypeRegistry();
      middleRegistry.importTypes(
        sourceRegistry,
        [{ name: "OriginalType" }],
        "./source.workpipe"
      );

      expect(middleRegistry.isExportable("OriginalType")).toBe(false);
    });

    it("marks locally defined types as exportable", () => {
      const registry = createTypeRegistry();
      registry.register(createTypeDeclaration("LocalType"));

      expect(registry.isExportable("LocalType")).toBe(true);
    });

    it("produces diagnostic when trying to import non-exportable type", () => {
      const originalSource = createTypeRegistry();
      originalSource.register(createTypeDeclaration("SharedType"));

      const middleRegistry = createTypeRegistry();
      middleRegistry.importTypes(
        originalSource,
        [{ name: "SharedType" }],
        "./original.workpipe"
      );

      const finalRegistry = createTypeRegistry();
      const diagnostics = finalRegistry.importTypes(
        middleRegistry,
        [{ name: "SharedType" }],
        "./middle.workpipe"
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP7003");
      expect(diagnostics[0].message).toContain("not exportable");
      expect(diagnostics[0].hint).toContain("import directly");
    });

    it("does not include non-exportable types in available types hint", () => {
      const originalSource = createTypeRegistry();
      originalSource.register(createTypeDeclaration("ImportedType"));

      const middleRegistry = createTypeRegistry();
      middleRegistry.register(createTypeDeclaration("LocalType"));
      middleRegistry.importTypes(
        originalSource,
        [{ name: "ImportedType" }],
        "./original.workpipe"
      );

      const finalRegistry = createTypeRegistry();
      const diagnostics = finalRegistry.importTypes(
        middleRegistry,
        [{ name: "NonExistent" }],
        "./middle.workpipe"
      );

      expect(diagnostics[0].hint).toContain("LocalType");
      expect(diagnostics[0].hint).not.toContain("ImportedType");
    });
  });

  describe("type provenance tracking", () => {
    it("returns undefined for non-existent type", () => {
      const registry = createTypeRegistry();
      expect(registry.getTypeProvenance("NonExistent")).toBeUndefined();
    });

    it("preserves original type definition when importing", () => {
      const sourceRegistry = createTypeRegistry();
      const originalType = createTypeDeclaration("MyType", [
        createTypeField("value", createPrimitiveType("int")),
      ]);
      sourceRegistry.register(originalType);

      const targetRegistry = createTypeRegistry();
      targetRegistry.importTypes(
        sourceRegistry,
        [{ name: "MyType" }],
        "./source.workpipe"
      );

      const resolvedType = targetRegistry.resolve("MyType");
      expect(resolvedType).toBe(originalType);
      expect(resolvedType?.fields[0].name).toBe("value");
    });
  });
});

describe("compileWithImports integration", () => {
  it("compiles file with single import", async () => {
    const files = {
      "/project/types.workpipe": `
type BuildInfo {
  version: string
  commit: string
}
`,
      "/project/main.workpipe": `
import { BuildInfo } from "./types.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("make build")]
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

    expect(result.success).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("compiles file with multiple imports from same file", async () => {
    const files = {
      "/project/types.workpipe": `
type BuildInfo {
  version: string
}

type DeployConfig {
  env: string
}

type TestResult {
  passed: bool
}
`,
      "/project/main.workpipe": `
import { BuildInfo, DeployConfig, TestResult } from "./types.workpipe"

workflow pipeline {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo done")]
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

    expect(result.success).toBe(true);
  });

  it("compiles file with aliased import", async () => {
    const files = {
      "/project/types.workpipe": `
type BuildInfo {
  version: string
}
`,
      "/project/main.workpipe": `
import { BuildInfo as BI } from "./types.workpipe"

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

    expect(result.success).toBe(true);
  });

  it("uses imported type in agent task output_schema", async () => {
    const files = {
      "/project/types.workpipe": `
type ReviewResult {
  approved: bool
  comments: string
}
`,
      "/project/main.workpipe": `
import { ReviewResult } from "./types.workpipe"

workflow review {
  on: push
  agent_job reviewer {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Review the code") {
        output_schema: ReviewResult
      }
    ]
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

    expect(result.success).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === "WP5002")).toHaveLength(0);
  });

  it("reports error for missing type in source file", async () => {
    const files = {
      "/project/types.workpipe": `
type ActualType {
  value: string
}
`,
      "/project/main.workpipe": `
import { NonExistentType } from "./types.workpipe"

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
    const error = result.diagnostics.find((d) => d.code === "WP7003");
    expect(error).toBeDefined();
    expect(error?.message).toContain("NonExistentType");
  });

  it("reports error for import path that does not exist", async () => {
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
    const error = result.diagnostics.find((d) => d.code === "WP7001");
    expect(error).toBeDefined();
    expect(error?.message).toContain("nonexistent.workpipe");
  });

  it("caches parsed files and registries", async () => {
    const files = {
      "/project/types.workpipe": `
type SharedType {
  value: string
}
`,
      "/project/main.workpipe": `
import { SharedType } from "./types.workpipe"

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

    await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(importContext.parsedFiles.size).toBeGreaterThan(0);
    expect(importContext.registries.size).toBeGreaterThan(0);
  });

  it("handles transitive import correctly (non-transitive behavior)", async () => {
    const files = {
      "/project/base.workpipe": `
type BaseType {
  id: string
}
`,
      "/project/middle.workpipe": `
import { BaseType } from "./base.workpipe"

type MiddleType {
  name: string
}
`,
      "/project/main.workpipe": `
import { BaseType } from "./middle.workpipe"

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
    const error = result.diagnostics.find((d) => d.code === "WP7003");
    expect(error).toBeDefined();
    expect(error?.message).toContain("not exportable");
  });

  it("allows importing locally defined type from intermediate file", async () => {
    const files = {
      "/project/base.workpipe": `
type BaseType {
  id: string
}
`,
      "/project/middle.workpipe": `
import { BaseType } from "./base.workpipe"

type MiddleType {
  name: string
}
`,
      "/project/main.workpipe": `
import { MiddleType } from "./middle.workpipe"

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

    expect(result.success).toBe(true);
  });
});

describe("backward compatibility", () => {
  it("compile() works without options", async () => {
    const { compile } = await import("../compile.js");

    const result = compile(`
workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}
`);

    expect(result.success).toBe(true);
  });

  it("compile() works with just source string", async () => {
    const { compile } = await import("../compile.js");

    const result = compile({
      source: `
workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}
`,
    });

    expect(result.success).toBe(true);
  });

  it("compile() handles imports node without ImportContext (no resolution)", async () => {
    const { compile } = await import("../compile.js");

    const result = compile(`
import { SomeType } from "./other.workpipe"

workflow build {
  on: push
  job compile {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}
`);

    expect(result.success).toBe(true);
  });
});
