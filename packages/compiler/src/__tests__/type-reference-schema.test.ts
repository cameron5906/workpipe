import { describe, it, expect } from "vitest";
import { compile } from "../index.js";
import { typeDeclarationToJsonSchema } from "../codegen/index.js";
import { createTypeRegistry } from "../semantics/type-registry.js";
import type {
  TypeDeclarationNode,
  TypeFieldNode,
  TypeExpressionNode,
} from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10) {
  return { start, end };
}

function createPrimitiveType(
  type: "string" | "int" | "float" | "bool" | "json" | "path"
): TypeExpressionNode {
  return { kind: "primitive_type", type, span: createSpan() };
}

function createTypeReference(name: string): TypeExpressionNode {
  return { kind: "type_reference", name, span: createSpan() };
}

function createArrayType(elementType: TypeExpressionNode): TypeExpressionNode {
  return { kind: "array_type", elementType, span: createSpan() };
}

function createObjectType(fields: TypeFieldNode[]): TypeExpressionNode {
  return { kind: "object_type", fields, span: createSpan() };
}

function createUnionType(members: TypeExpressionNode[]): TypeExpressionNode {
  return { kind: "union_type", members, span: createSpan() };
}

function createStringLiteralType(value: string): TypeExpressionNode {
  return { kind: "string_literal_type", value, span: createSpan() };
}

function createNullType(): TypeExpressionNode {
  return { kind: "null_type", span: createSpan() };
}

function createTypeField(name: string, type: TypeExpressionNode): TypeFieldNode {
  return { kind: "type_field", name, type, span: createSpan() };
}

function createTypeDeclaration(
  name: string,
  fields: TypeFieldNode[]
): TypeDeclarationNode {
  return {
    kind: "type_declaration",
    name,
    fields,
    span: createSpan(),
  };
}

describe("typeDeclarationToJsonSchema", () => {
  it("converts simple type with primitive fields", () => {
    const type = createTypeDeclaration("BuildInfo", [
      createTypeField("version", createPrimitiveType("string")),
      createTypeField("buildNumber", createPrimitiveType("int")),
      createTypeField("timestamp", createPrimitiveType("float")),
      createTypeField("isRelease", createPrimitiveType("bool")),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        version: { type: "string" },
        buildNumber: { type: "integer" },
        timestamp: { type: "number" },
        isRelease: { type: "boolean" },
      },
      required: ["version", "buildNumber", "timestamp", "isRelease"],
      additionalProperties: false,
    });
  });

  it("converts type with array fields", () => {
    const type = createTypeDeclaration("IssueList", [
      createTypeField("issues", createArrayType(createPrimitiveType("string"))),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["issues"],
      additionalProperties: false,
    });
  });

  it("converts type with nested object fields", () => {
    const type = createTypeDeclaration("Result", [
      createTypeField(
        "metadata",
        createObjectType([
          createTypeField("author", createPrimitiveType("string")),
          createTypeField("date", createPrimitiveType("string")),
        ])
      ),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            author: { type: "string" },
            date: { type: "string" },
          },
          required: ["author", "date"],
          additionalProperties: false,
        },
      },
      required: ["metadata"],
      additionalProperties: false,
    });
  });

  it("converts type with string literal union (enum)", () => {
    const type = createTypeDeclaration("StatusResult", [
      createTypeField(
        "status",
        createUnionType([
          createStringLiteralType("pending"),
          createStringLiteralType("success"),
          createStringLiteralType("failed"),
        ])
      ),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        status: { enum: ["pending", "success", "failed"] },
      },
      required: ["status"],
      additionalProperties: false,
    });
  });

  it("converts type with nullable field", () => {
    const type = createTypeDeclaration("OptionalResult", [
      createTypeField(
        "message",
        createUnionType([createPrimitiveType("string"), createNullType()])
      ),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        message: {
          oneOf: [{ type: "string" }, { type: "null" }],
        },
      },
      required: ["message"],
      additionalProperties: false,
    });
  });

  it("converts type with array of objects", () => {
    const type = createTypeDeclaration("AnalysisResult", [
      createTypeField(
        "issues",
        createArrayType(
          createObjectType([
            createTypeField("file", createPrimitiveType("string")),
            createTypeField("severity", createPrimitiveType("string")),
          ])
        )
      ),
      createTypeField("summary", createPrimitiveType("string")),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              file: { type: "string" },
              severity: { type: "string" },
            },
            required: ["file", "severity"],
            additionalProperties: false,
          },
        },
        summary: { type: "string" },
      },
      required: ["issues", "summary"],
      additionalProperties: false,
    });
  });

  it("resolves type references with registry", () => {
    const registry = createTypeRegistry();

    const innerType = createTypeDeclaration("Inner", [
      createTypeField("value", createPrimitiveType("int")),
    ]);
    registry.register(innerType);

    const outerType = createTypeDeclaration("Outer", [
      createTypeField("nested", createTypeReference("Inner")),
    ]);

    const result = typeDeclarationToJsonSchema(outerType, registry);

    expect(result).toEqual({
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            value: { type: "integer" },
          },
          required: ["value"],
          additionalProperties: false,
        },
      },
      required: ["nested"],
      additionalProperties: false,
    });
  });

  it("resolves array of type references", () => {
    const registry = createTypeRegistry();

    const itemType = createTypeDeclaration("Item", [
      createTypeField("id", createPrimitiveType("string")),
      createTypeField("count", createPrimitiveType("int")),
    ]);
    registry.register(itemType);

    const containerType = createTypeDeclaration("Container", [
      createTypeField("items", createArrayType(createTypeReference("Item"))),
    ]);

    const result = typeDeclarationToJsonSchema(containerType, registry);

    expect(result).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              count: { type: "integer" },
            },
            required: ["id", "count"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    });
  });

  it("converts json type to empty object schema", () => {
    const type = createTypeDeclaration("FlexibleResult", [
      createTypeField("data", createPrimitiveType("json")),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      required: ["data"],
      additionalProperties: false,
    });
  });

  it("converts path type to string schema", () => {
    const type = createTypeDeclaration("FileResult", [
      createTypeField("outputPath", createPrimitiveType("path")),
    ]);

    const result = typeDeclarationToJsonSchema(type);

    expect(result).toEqual({
      type: "object",
      properties: {
        outputPath: { type: "string" },
      },
      required: ["outputPath"],
      additionalProperties: false,
    });
  });
});

describe("compile with type reference in output_schema", () => {
  it("compiles agent task with type reference and generates JSON schema", () => {
    const source = `
type Issue {
  filePath: string
  severity: string
}

type AnalysisResult {
  issues: [Issue]
  summary: string
}

workflow ci {
  on: push
  agent_job analyze {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Analyze the code") {
        output_schema: "AnalysisResult"
      }
    ]
  }
}`;

    const result = compile(source);
    if (!result.success) {
      console.log("Compile failed with diagnostics:", result.diagnostics);
    }

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("type: object");
      expect(result.value).toContain("properties:");
      expect(result.value).toContain("issues:");
      expect(result.value).toContain("summary:");
      expect(result.value).toContain("type: array");
      expect(result.value).toContain("filePath:");
      expect(result.value).toContain("severity:");
      expect(result.value).toContain("additionalProperties: false");
      expect(result.value).not.toContain("$ref: AnalysisResult");
    }
  });

  it("compiles agent task with type reference containing nested types", () => {
    const source = `
type Issue {
  filePath: string
  line: int
  message: string
}

type ReviewResult {
  issues: [Issue]
  approved: bool
}

workflow ci {
  on: push
  agent_job review {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Review code") {
        output_schema: "ReviewResult"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("type: object");
      expect(result.value).toContain("issues:");
      expect(result.value).toContain("approved:");
      expect(result.value).toContain("filePath:");
      expect(result.value).toContain("line:");
      expect(result.value).toContain("message:");
      expect(result.value).toContain("type: integer");
      expect(result.value).toContain("type: boolean");
    }
  });

  it("compiles agent task with type containing union fields", () => {
    const source = `
type Result {
  status: "success" | "error" | "pending"
  message: string | null
}

workflow ci {
  on: push
  agent_job check {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Validate input") {
        output_schema: "Result"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("enum:");
      expect(result.value).toContain("- success");
      expect(result.value).toContain("- error");
      expect(result.value).toContain("- pending");
      expect(result.value).toContain("oneOf:");
    }
  });

  it("falls back to $ref for JSON file paths", () => {
    const source = `
workflow ci {
  on: push
  agent_job build {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Build the project") {
        output_schema: "./schemas/build-result.json"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("$ref: ./schemas/build-result.json");
    }
  });

  it("produces WP5002 error for unknown type reference", () => {
    const source = `
workflow ci {
  on: push
  agent_job analyze {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Analyze the code") {
        output_schema: "UnknownType"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === "WP5002")).toBe(true);
    expect(errors.some((e) => e.message.includes("UnknownType"))).toBe(true);
  });

  it("compiles type with deeply nested structure", () => {
    const source = `
type Level3 {
  value: int
}

type Level2 {
  nested: Level3
  items: [string]
}

type Level1 {
  data: Level2
  name: string
}

workflow ci {
  on: push
  agent_job process {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Process data") {
        output_schema: "Level1"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("data:");
      expect(result.value).toContain("nested:");
      expect(result.value).toContain("value:");
      expect(result.value).toContain("items:");
      expect(result.value).toContain("name:");
    }
  });

  it("compiles agent_job with type reference", () => {
    const source = `
type BuildResult {
  artifacts: [string]
  success: bool
}

workflow ci {
  on: push
  agent_job builder {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Build project") {
        output_schema: "BuildResult"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("artifacts:");
      expect(result.value).toContain("success:");
      expect(result.value).toContain("type: boolean");
    }
  });

  it("compiles matrix job with type reference", () => {
    const source = `
type TestResult {
  passed: int
  failed: int
  skipped: int
}

workflow ci {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest, macos-latest]
    }
    steps: [
      agent_task("Run tests") {
        output_schema: "TestResult"
      }
    ]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("output_schema:");
      expect(result.value).toContain("passed:");
      expect(result.value).toContain("failed:");
      expect(result.value).toContain("skipped:");
      expect(result.value).toContain("type: integer");
    }
  });
});
