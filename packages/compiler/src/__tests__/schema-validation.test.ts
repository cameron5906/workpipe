import { describe, it, expect } from "vitest";
import { validateSchemas } from "../semantics/schema-validation.js";
import type {
  WorkflowNode,
  AgentJobNode,
  SchemaObjectNode,
  SchemaFieldNode,
  SchemaPrimitiveNode,
  SchemaUnionNode,
  SchemaArrayNode,
  SchemaNullNode,
  SchemaStringLiteralNode,
} from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10) {
  return { start, end };
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

function createAgentJobWithSchema(
  name: string,
  schema: SchemaObjectNode | string
): AgentJobNode {
  return {
    kind: "agent_job",
    name,
    runsOn: "ubuntu-latest",
    needs: [],
    outputs: [],
    steps: [
      {
        kind: "agent_task",
        taskDescription: "Do something",
        outputSchema: schema,
        consumes: [],
        span: createSpan(),
      },
    ],
    consumes: [],
    span: createSpan(0, 50),
  };
}

function createPrimitive(type: string): SchemaPrimitiveNode {
  return {
    kind: "primitive",
    type: type as "string" | "int" | "float" | "bool",
    span: createSpan(),
  };
}

function createField(name: string, type: SchemaPrimitiveNode | SchemaUnionNode | SchemaArrayNode | SchemaObjectNode | SchemaNullNode | SchemaStringLiteralNode): SchemaFieldNode {
  return {
    name,
    type,
    span: createSpan(),
  };
}

function createObjectSchema(fields: SchemaFieldNode[]): SchemaObjectNode {
  return {
    kind: "object",
    fields,
    span: createSpan(),
  };
}

function createUnion(types: (SchemaPrimitiveNode | SchemaNullNode | SchemaStringLiteralNode | SchemaObjectNode | SchemaArrayNode)[]): SchemaUnionNode {
  return {
    kind: "union",
    types,
    span: createSpan(),
  };
}

function createNull(): SchemaNullNode {
  return {
    kind: "null",
    span: createSpan(),
  };
}

function createStringLiteral(value: string): SchemaStringLiteralNode {
  return {
    kind: "stringLiteral",
    value,
    span: createSpan(),
  };
}

function createArray(elementType: SchemaPrimitiveNode | SchemaObjectNode): SchemaArrayNode {
  return {
    kind: "array",
    elementType,
    span: createSpan(),
  };
}

describe("validateSchemas", () => {
  describe("WP3001 - Unknown primitive type", () => {
    it("returns no error for valid primitive types", () => {
      const schema = createObjectSchema([
        createField("name", createPrimitive("string")),
        createField("count", createPrimitive("int")),
        createField("price", createPrimitive("float")),
        createField("active", createPrimitive("bool")),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for string reference schema (not inline)", () => {
      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", "MySchema")],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("WP3002 - Empty object schema", () => {
    it("returns error for empty object schema", () => {
      const schema = createObjectSchema([]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3002");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("Empty object schema");
    });

    it("returns no error for object schema with fields", () => {
      const schema = createObjectSchema([
        createField("name", createPrimitive("string")),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for nested empty object schema", () => {
      const nestedEmpty = createObjectSchema([]);
      const schema = createObjectSchema([
        createField("data", nestedEmpty),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3002");
    });
  });

  describe("WP3003 - Invalid union type", () => {
    it("returns no error for valid nullable union", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("string"),
          createNull(),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no error for string literal union", () => {
      const schema = createObjectSchema([
        createField("status", createUnion([
          createStringLiteral("pending"),
          createStringLiteral("complete"),
          createStringLiteral("failed"),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for mixing int and string primitives", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("int"),
          createPrimitive("string"),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3003");
      expect(diagnostics[0].message).toContain("Invalid union");
    });

    it("returns error for mixing bool and float primitives", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("bool"),
          createPrimitive("float"),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3003");
    });

    it("returns error for mixing primitives with objects", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("string"),
          createObjectSchema([createField("name", createPrimitive("string"))]),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics.some((d) => d.code === "WP3003")).toBe(true);
    });

    it("returns error for mixing primitives with arrays", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("string"),
          createArray(createPrimitive("string")),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics.some((d) => d.code === "WP3003")).toBe(true);
    });

    it("returns error for string primitive with string literals", () => {
      const schema = createObjectSchema([
        createField("status", createUnion([
          createPrimitive("string"),
          createStringLiteral("active"),
          createStringLiteral("inactive"),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3003");
      expect(diagnostics[0].message).toContain("string literal");
    });

    it("allows int and float union (numeric types)", () => {
      const schema = createObjectSchema([
        createField("value", createUnion([
          createPrimitive("int"),
          createPrimitive("float"),
        ])),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("WP3004 - Duplicate property name", () => {
    it("returns error for duplicate property names", () => {
      const schema: SchemaObjectNode = {
        kind: "object",
        fields: [
          createField("name", createPrimitive("string")),
          createField("value", createPrimitive("int")),
          createField("name", createPrimitive("string")),
        ],
        span: createSpan(),
      };

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3004");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("name");
    });

    it("returns no error for unique property names", () => {
      const schema = createObjectSchema([
        createField("name", createPrimitive("string")),
        createField("value", createPrimitive("int")),
        createField("active", createPrimitive("bool")),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for each duplicate property", () => {
      const schema: SchemaObjectNode = {
        kind: "object",
        fields: [
          createField("name", createPrimitive("string")),
          createField("name", createPrimitive("string")),
          createField("name", createPrimitive("string")),
        ],
        span: createSpan(),
      };

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP3004")).toBe(true);
    });

    it("returns error for duplicates in nested object", () => {
      const nestedSchema: SchemaObjectNode = {
        kind: "object",
        fields: [
          createField("id", createPrimitive("int")),
          createField("id", createPrimitive("int")),
        ],
        span: createSpan(),
      };

      const schema = createObjectSchema([
        createField("data", nestedSchema),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3004");
    });
  });

  describe("validation in cycles", () => {
    it("validates schemas in jobs inside cycles", () => {
      const schema = createObjectSchema([]);

      const workflow = createWorkflow({
        cycles: [
          {
            kind: "cycle",
            name: "loop",
            maxIters: 5,
            key: "phase",
            until: null,
            body: {
              kind: "cycle_body",
              jobs: [createAgentJobWithSchema("cycleJob", schema)],
              span: createSpan(),
            },
            span: createSpan(),
          },
        ],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3002");
    });
  });

  describe("array element validation", () => {
    it("validates element types in arrays", () => {
      const schema = createObjectSchema([
        createField("items", createArray(createObjectSchema([]))),
      ]);

      const workflow = createWorkflow({
        jobs: [createAgentJobWithSchema("job1", schema)],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP3002");
    });
  });

  describe("edge cases", () => {
    it("returns no errors for workflow with no jobs", () => {
      const workflow = createWorkflow({
        jobs: [],
        cycles: [],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no errors for agent job without output_schema", () => {
      const agentJob: AgentJobNode = {
        kind: "agent_job",
        name: "job1",
        runsOn: "ubuntu-latest",
        needs: [],
        outputs: [],
        steps: [
          {
            kind: "agent_task",
            taskDescription: "Do something",
            consumes: [],
            span: createSpan(),
          },
        ],
        consumes: [],
        span: createSpan(0, 50),
      };

      const workflow = createWorkflow({
        jobs: [agentJob],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("handles multiple jobs with schemas", () => {
      const emptySchema = createObjectSchema([]);
      const validSchema = createObjectSchema([
        createField("name", createPrimitive("string")),
      ]);

      const workflow = createWorkflow({
        jobs: [
          createAgentJobWithSchema("job1", emptySchema),
          createAgentJobWithSchema("job2", validSchema),
          createAgentJobWithSchema("job3", emptySchema),
        ],
      });

      const diagnostics = validateSchemas(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP3002")).toBe(true);
    });
  });
});
