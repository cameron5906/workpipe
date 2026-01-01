import { describe, it, expect } from "vitest";
import {
  createTypeRegistry,
  buildTypeRegistry,
  validateTypeReferences,
} from "../semantics/type-registry.js";
import { compile } from "../index.js";
import type {
  WorkPipeFileNode,
  WorkflowNode,
  TypeDeclarationNode,
  TypeFieldNode,
  TypeExpressionNode,
  JobNode,
  AgentJobNode,
  AgentTaskNode,
  CycleNode,
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

function createTypeField(name: string, type: TypeExpressionNode): TypeFieldNode {
  return { kind: "type_field", name, type, span: createSpan() };
}

function createTypeDeclaration(
  name: string,
  fields: TypeFieldNode[],
  spanOverride?: Span
): TypeDeclarationNode {
  return {
    kind: "type_declaration",
    name,
    fields,
    span: spanOverride ?? createSpan(),
  };
}

function createWorkflow(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    kind: "workflow",
    name: "test",
    trigger: { kind: "trigger", events: ["push"], span: createSpan() },
    jobs: [],
    cycles: [],
    span: createSpan(0, 100),
    ...overrides,
  };
}

function createFile(
  types: TypeDeclarationNode[] = [],
  workflows: WorkflowNode[] = []
): WorkPipeFileNode {
  return {
    kind: "file",
    imports: [],
    types,
    workflows,
    span: createSpan(0, 200),
  };
}

function createJob(name: string, steps: JobNode["steps"] = []): JobNode {
  return {
    kind: "job",
    name,
    runsOn: "ubuntu-latest",
    needs: [],
    condition: null,
    outputs: [],
    steps:
      steps.length > 0
        ? steps
        : [{ kind: "run", command: "echo hello", span: createSpan() }],
    span: createSpan(),
  };
}

function createAgentJob(
  name: string,
  steps: AgentJobNode["steps"] = []
): AgentJobNode {
  return {
    kind: "agent_job",
    name,
    runsOn: "ubuntu-latest",
    needs: [],
    outputs: [],
    steps:
      steps.length > 0
        ? steps
        : [
            {
              kind: "agent_task",
              taskDescription: "Do something",
              consumes: [],
              span: createSpan(),
            },
          ],
    consumes: [],
    span: createSpan(),
  };
}

function createAgentTask(overrides: Partial<AgentTaskNode> = {}): AgentTaskNode {
  return {
    kind: "agent_task",
    taskDescription: "Do something",
    consumes: [],
    span: createSpan(),
    ...overrides,
  };
}

function createCycle(
  name: string,
  jobs: (JobNode | AgentJobNode)[]
): CycleNode {
  return {
    kind: "cycle",
    name,
    maxIters: 5,
    key: null,
    until: null,
    body: {
      kind: "cycle_body",
      jobs,
      span: createSpan(),
    },
    span: createSpan(),
  };
}

describe("createTypeRegistry", () => {
  it("creates an empty registry", () => {
    const registry = createTypeRegistry();
    expect(registry.types.size).toBe(0);
  });

  it("registers a type successfully", () => {
    const registry = createTypeRegistry();
    const type = createTypeDeclaration("BuildInfo", [
      createTypeField("version", createPrimitiveType("string")),
    ]);

    const error = registry.register(type);

    expect(error).toBeNull();
    expect(registry.has("BuildInfo")).toBe(true);
    expect(registry.resolve("BuildInfo")).toBe(type);
  });

  it("returns false for non-existent type", () => {
    const registry = createTypeRegistry();

    expect(registry.has("NonExistent")).toBe(false);
    expect(registry.resolve("NonExistent")).toBeUndefined();
  });

  it("registers multiple types", () => {
    const registry = createTypeRegistry();
    const type1 = createTypeDeclaration("BuildInfo", []);
    const type2 = createTypeDeclaration("DeployInfo", []);

    registry.register(type1);
    registry.register(type2);

    expect(registry.types.size).toBe(2);
    expect(registry.has("BuildInfo")).toBe(true);
    expect(registry.has("DeployInfo")).toBe(true);
  });
});

describe("buildTypeRegistry", () => {
  it("builds registry from file with no types", () => {
    const file = createFile([], [createWorkflow()]);

    const { registry, diagnostics } = buildTypeRegistry(file);

    expect(registry.types.size).toBe(0);
    expect(diagnostics).toHaveLength(0);
  });

  it("builds registry from file with types", () => {
    const file = createFile(
      [
        createTypeDeclaration("BuildInfo", [
          createTypeField("version", createPrimitiveType("string")),
        ]),
        createTypeDeclaration("DeployConfig", [
          createTypeField("env", createPrimitiveType("string")),
        ]),
      ],
      [createWorkflow()]
    );

    const { registry, diagnostics } = buildTypeRegistry(file);

    expect(registry.types.size).toBe(2);
    expect(registry.has("BuildInfo")).toBe(true);
    expect(registry.has("DeployConfig")).toBe(true);
    expect(diagnostics).toHaveLength(0);
  });

  describe("WP5001 - Duplicate type name", () => {
    it("returns error for duplicate type names", () => {
      const file = createFile(
        [
          createTypeDeclaration("BuildInfo", [], createSpan(0, 20)),
          createTypeDeclaration("BuildInfo", [], createSpan(30, 50)),
        ],
        []
      );

      const { registry, diagnostics } = buildTypeRegistry(file);

      expect(registry.types.size).toBe(1);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5001");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("BuildInfo");
      expect(diagnostics[0].message).toContain("already defined");
    });

    it("returns multiple errors for multiple duplicates", () => {
      const file = createFile(
        [
          createTypeDeclaration("BuildInfo", [], createSpan(0, 20)),
          createTypeDeclaration("BuildInfo", [], createSpan(30, 50)),
          createTypeDeclaration("BuildInfo", [], createSpan(60, 80)),
        ],
        []
      );

      const { diagnostics } = buildTypeRegistry(file);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP5001")).toBe(true);
    });

    it("handles different types with same name as duplicates", () => {
      const file = createFile(
        [
          createTypeDeclaration("Config", [
            createTypeField("version", createPrimitiveType("string")),
          ]),
          createTypeDeclaration("Config", [
            createTypeField("env", createPrimitiveType("string")),
          ]),
        ],
        []
      );

      const { diagnostics } = buildTypeRegistry(file);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5001");
    });
  });
});

describe("validateTypeReferences", () => {
  describe("type references in type field definitions", () => {
    it("validates type references in type fields", () => {
      const file = createFile(
        [
          createTypeDeclaration("Outer", [
            createTypeField("inner", createTypeReference("NonExistent")),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5002");
      expect(diagnostics[0].message).toContain("NonExistent");
    });

    it("allows references to existing types", () => {
      const file = createFile(
        [
          createTypeDeclaration("Inner", [
            createTypeField("value", createPrimitiveType("string")),
          ]),
          createTypeDeclaration("Outer", [
            createTypeField("inner", createTypeReference("Inner")),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });

    it("allows primitive types without defining them", () => {
      const file = createFile(
        [
          createTypeDeclaration("Config", [
            createTypeField("name", createPrimitiveType("string")),
            createTypeField("count", createPrimitiveType("int")),
            createTypeField("rate", createPrimitiveType("float")),
            createTypeField("enabled", createPrimitiveType("bool")),
            createTypeField("data", createPrimitiveType("json")),
            createTypeField("file", createPrimitiveType("path")),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });

    it("validates type references in array element types", () => {
      const file = createFile(
        [
          createTypeDeclaration("Container", [
            createTypeField("items", createArrayType(createTypeReference("Item"))),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5002");
      expect(diagnostics[0].message).toContain("Item");
    });

    it("validates type references in nested object types", () => {
      const file = createFile(
        [
          createTypeDeclaration("Parent", [
            createTypeField(
              "child",
              createObjectType([
                createTypeField("nested", createTypeReference("DeepType")),
              ])
            ),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5002");
      expect(diagnostics[0].message).toContain("DeepType");
    });

    it("validates type references in union types", () => {
      const file = createFile(
        [
          createTypeDeclaration("Result", [
            createTypeField(
              "value",
              createUnionType([
                createTypeReference("Success"),
                createTypeReference("Error"),
              ])
            ),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP5002")).toBe(true);
    });

    it("includes available types in hint", () => {
      const file = createFile(
        [
          createTypeDeclaration("TypeA", []),
          createTypeDeclaration("TypeB", []),
          createTypeDeclaration("Invalid", [
            createTypeField("ref", createTypeReference("Unknown")),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].hint).toContain("TypeA");
      expect(diagnostics[0].hint).toContain("TypeB");
      expect(diagnostics[0].hint).toContain("Invalid");
    });

    it("shows helpful message when no types are available", () => {
      const file = createFile(
        [
          createTypeDeclaration("OnlyType", [
            createTypeField("ref", createTypeReference("Missing")),
          ]),
        ],
        []
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].hint).toContain("OnlyType");
    });
  });

  describe("type references in agent task output_schema", () => {
    it("validates type reference in output_schema as string", () => {
      const file = createFile(
        [],
        [
          createWorkflow({
            jobs: [
              createAgentJob("review", [
                createAgentTask({
                  outputSchema: "ReviewResult",
                }),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5002");
      expect(diagnostics[0].message).toContain("ReviewResult");
    });

    it("allows valid type reference in output_schema", () => {
      const file = createFile(
        [createTypeDeclaration("ReviewResult", [])],
        [
          createWorkflow({
            jobs: [
              createAgentJob("review", [
                createAgentTask({
                  outputSchema: "ReviewResult",
                }),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });

    it("ignores JSON file paths in output_schema", () => {
      const file = createFile(
        [],
        [
          createWorkflow({
            jobs: [
              createAgentJob("review", [
                createAgentTask({
                  outputSchema: "schemas/review.json",
                }),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });

    it("ignores inline schema objects", () => {
      const file = createFile(
        [],
        [
          createWorkflow({
            jobs: [
              createAgentJob("review", [
                createAgentTask({
                  outputSchema: {
                    kind: "object",
                    fields: [
                      {
                        name: "approved",
                        type: { kind: "primitive", type: "bool", span: createSpan() },
                        span: createSpan(),
                      },
                    ],
                    span: createSpan(),
                  },
                }),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("type references in jobs inside cycles", () => {
    it("validates type references in agent tasks inside cycles", () => {
      const file = createFile(
        [],
        [
          createWorkflow({
            cycles: [
              createCycle("review_loop", [
                createAgentJob("review", [
                  createAgentTask({
                    outputSchema: "CycleResult",
                  }),
                ]),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP5002");
      expect(diagnostics[0].message).toContain("CycleResult");
    });

    it("allows valid type references in agent tasks inside cycles", () => {
      const file = createFile(
        [createTypeDeclaration("CycleResult", [])],
        [
          createWorkflow({
            cycles: [
              createCycle("review_loop", [
                createAgentJob("review", [
                  createAgentTask({
                    outputSchema: "CycleResult",
                  }),
                ]),
              ]),
            ],
          }),
        ]
      );
      const { registry } = buildTypeRegistry(file);

      const diagnostics = validateTypeReferences(file, registry);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty file", () => {
      const file = createFile([], []);
      const { registry, diagnostics: buildDiagnostics } = buildTypeRegistry(file);

      expect(registry.types.size).toBe(0);
      expect(buildDiagnostics).toHaveLength(0);

      const validateDiagnostics = validateTypeReferences(file, registry);
      expect(validateDiagnostics).toHaveLength(0);
    });

    it("handles file with only workflows, no types", () => {
      const file = createFile([], [createWorkflow()]);
      const { registry, diagnostics: buildDiagnostics } = buildTypeRegistry(file);

      expect(registry.types.size).toBe(0);
      expect(buildDiagnostics).toHaveLength(0);

      const validateDiagnostics = validateTypeReferences(file, registry);
      expect(validateDiagnostics).toHaveLength(0);
    });

    it("handles file with only types, no workflows", () => {
      const file = createFile(
        [
          createTypeDeclaration("StandaloneType", [
            createTypeField("value", createPrimitiveType("string")),
          ]),
        ],
        []
      );
      const { registry, diagnostics: buildDiagnostics } = buildTypeRegistry(file);

      expect(registry.types.size).toBe(1);
      expect(buildDiagnostics).toHaveLength(0);

      const validateDiagnostics = validateTypeReferences(file, registry);
      expect(validateDiagnostics).toHaveLength(0);
    });

    it("handles complex nested type structures", () => {
      const file = createFile(
        [
          createTypeDeclaration("Inner", [
            createTypeField("value", createPrimitiveType("string")),
          ]),
          createTypeDeclaration("Container", [
            createTypeField("items", createArrayType(createTypeReference("Inner"))),
            createTypeField(
              "nested",
              createObjectType([
                createTypeField("ref", createTypeReference("Inner")),
              ])
            ),
            createTypeField(
              "optional",
              createUnionType([
                createTypeReference("Inner"),
                { kind: "null_type", span: createSpan() },
              ])
            ),
          ]),
        ],
        []
      );
      const { registry, diagnostics: buildDiagnostics } = buildTypeRegistry(file);

      expect(buildDiagnostics).toHaveLength(0);

      const validateDiagnostics = validateTypeReferences(file, registry);
      expect(validateDiagnostics).toHaveLength(0);
    });
  });
});

describe("compile integration with type registry", () => {
  it("returns WP5001 error for duplicate type names via compile()", () => {
    const source = `
type BuildInfo {
  version: string
}

type BuildInfo {
  commit: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === "WP5001")).toBe(true);
    expect(errors.some((e) => e.message.includes("BuildInfo"))).toBe(true);
    expect(errors.some((e) => e.message.includes("already defined"))).toBe(true);
  });

  it("returns WP5002 error for unknown type reference via compile()", () => {
    const source = `
type Config {
  nested: UnknownType
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === "WP5002")).toBe(true);
    expect(errors.some((e) => e.message.includes("UnknownType"))).toBe(true);
  });

  it("compiles successfully with valid type declarations", () => {
    const source = `
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

type DeployConfig {
  env: string
  build: BuildInfo
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("compiles successfully with primitive types only", () => {
    const source = `
type AllPrimitives {
  name: string
  count: int
  rate: float
  enabled: bool
  data: json
  filepath: path
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
  });

  it("compiles successfully with nested array and object types", () => {
    const source = `
type Item {
  id: string
  value: int
}

type Container {
  items: [Item]
  metadata: { k: string c: int }
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
  });

  it("compiles successfully with union types", () => {
    const source = `
type Success {
  data: string
}

type Error {
  message: string
}

type Result {
  value: Success | Error | null
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
  });

  it("returns error for unknown type in array element", () => {
    const source = `
type Container {
  items: [Unknown]
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((e) => e.code === "WP5002")).toBe(true);
    expect(result.diagnostics.some((e) => e.message.includes("Unknown"))).toBe(true);
  });

  it("returns error for unknown type in union member", () => {
    const source = `
type Result {
  value: string | UnknownType
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((e) => e.code === "WP5002")).toBe(true);
    expect(result.diagnostics.some((e) => e.message.includes("UnknownType"))).toBe(true);
  });

  it("compiles successfully with no types defined", () => {
    const source = `
workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;

    const result = compile(source);

    expect(result.success).toBe(true);
  });
});
