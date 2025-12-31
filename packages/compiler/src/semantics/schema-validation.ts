import { semanticError, type Diagnostic } from "../diagnostic/index.js";
import type {
  WorkflowNode,
  AnyJobNode,
  StepNode,
  SchemaTypeNode,
  SchemaObjectNode,
  SchemaFieldNode,
  Span,
} from "../ast/types.js";

const VALID_PRIMITIVE_TYPES = new Set(["string", "int", "float", "bool"]);

function validatePrimitiveType(
  node: SchemaTypeNode,
  diagnostics: Diagnostic[]
): void {
  if (node.kind === "primitive") {
    if (!VALID_PRIMITIVE_TYPES.has(node.type)) {
      diagnostics.push(
        semanticError(
          "WP3001",
          `Unknown primitive type '${node.type}'`,
          node.span,
          `Valid primitive types are: ${Array.from(VALID_PRIMITIVE_TYPES).join(", ")}`
        )
      );
    }
  }
}

function validateEmptyObject(
  node: SchemaObjectNode,
  diagnostics: Diagnostic[]
): void {
  if (node.fields.length === 0) {
    diagnostics.push(
      semanticError(
        "WP3002",
        "Empty object schema",
        node.span,
        "Add at least one property to the output_schema, or remove it if not needed"
      )
    );
  }
}

function validateUnionType(
  node: SchemaTypeNode,
  diagnostics: Diagnostic[]
): void {
  if (node.kind !== "union") {
    return;
  }

  const types = node.types;

  if (types.length < 2) {
    diagnostics.push(
      semanticError(
        "WP3003",
        "Union type must have at least two types",
        node.span,
        "Add more types to the union or use a single type instead"
      )
    );
    return;
  }

  const primitiveTypes = types.filter((t) => t.kind === "primitive");
  const hasPrimitives = primitiveTypes.length > 0;
  const hasNull = types.some((t) => t.kind === "null");
  const hasStringLiterals = types.some((t) => t.kind === "stringLiteral");
  const hasObjects = types.some((t) => t.kind === "object");
  const hasArrays = types.some((t) => t.kind === "array");

  if (hasPrimitives && primitiveTypes.length >= 2) {
    const primitiveTypeNames = primitiveTypes
      .map((t) => (t.kind === "primitive" ? t.type : ""))
      .filter(Boolean);

    const hasNumericMix =
      (primitiveTypeNames.includes("int") ||
        primitiveTypeNames.includes("float")) &&
      (primitiveTypeNames.includes("string") ||
        primitiveTypeNames.includes("bool"));

    if (hasNumericMix) {
      diagnostics.push(
        semanticError(
          "WP3003",
          `Invalid union of primitive types: ${primitiveTypeNames.join(" | ")}`,
          node.span,
          "Consider using a more specific union type or a single type that can represent all values"
        )
      );
    }
  }

  if (hasPrimitives && hasObjects) {
    diagnostics.push(
      semanticError(
        "WP3003",
        "Invalid union mixing primitive types with object types",
        node.span,
        "Separate primitive and object types, or use a discriminated union"
      )
    );
  }

  if (hasPrimitives && hasArrays) {
    diagnostics.push(
      semanticError(
        "WP3003",
        "Invalid union mixing primitive types with array types",
        node.span,
        "Separate primitive and array types"
      )
    );
  }

  if (hasStringLiterals && primitiveTypes.some((t) => t.kind === "primitive" && t.type === "string")) {
    diagnostics.push(
      semanticError(
        "WP3003",
        "Invalid union: string literal types with string primitive type",
        node.span,
        "Remove the string primitive type when using string literals in a union"
      )
    );
  }
}

function validateDuplicateProperties(
  node: SchemaObjectNode,
  diagnostics: Diagnostic[]
): void {
  const seen = new Map<string, SchemaFieldNode>();

  for (const field of node.fields) {
    const existing = seen.get(field.name);
    if (existing) {
      diagnostics.push(
        semanticError(
          "WP3004",
          `Duplicate property name '${field.name}' in schema`,
          field.span,
          `Remove or rename one of the duplicate properties named '${field.name}'`
        )
      );
    } else {
      seen.set(field.name, field);
    }
  }
}

function validateSchemaNode(
  node: SchemaTypeNode,
  diagnostics: Diagnostic[]
): void {
  switch (node.kind) {
    case "primitive":
      validatePrimitiveType(node, diagnostics);
      break;

    case "object":
      validateEmptyObject(node, diagnostics);
      validateDuplicateProperties(node, diagnostics);
      for (const field of node.fields) {
        validateSchemaNode(field.type, diagnostics);
      }
      break;

    case "array":
      validateSchemaNode(node.elementType, diagnostics);
      break;

    case "union":
      validateUnionType(node, diagnostics);
      for (const type of node.types) {
        validateSchemaNode(type, diagnostics);
      }
      break;

    case "stringLiteral":
    case "null":
      break;
  }
}

function extractSchemaFromStep(step: StepNode): SchemaObjectNode | null {
  if (step.kind === "agent_task" && step.outputSchema) {
    if (typeof step.outputSchema === "object") {
      return step.outputSchema;
    }
  }
  return null;
}

function validateJobSchemas(job: AnyJobNode, cycleName?: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const step of job.steps) {
    const schema = extractSchemaFromStep(step);
    if (schema) {
      validateSchemaNode(schema, diagnostics);
    }
  }

  return diagnostics;
}

export function validateSchemas(ast: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const job of ast.jobs) {
    diagnostics.push(...validateJobSchemas(job));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      diagnostics.push(...validateJobSchemas(job, cycle.name));
    }
  }

  return diagnostics;
}
