import { semanticError, type Diagnostic } from "../diagnostic/index.js";
import type {
  WorkPipeFileNode,
  TypeDeclarationNode,
  TypeExpressionNode,
  TypeFieldNode,
  AnyJobNode,
  StepNode,
  AgentTaskNode,
  Span,
} from "../ast/types.js";

export interface TypeRegistry {
  readonly types: Map<string, TypeDeclarationNode>;
  register(type: TypeDeclarationNode): Diagnostic | null;
  resolve(name: string): TypeDeclarationNode | undefined;
  has(name: string): boolean;
}

const PRIMITIVE_TYPES = new Set(["string", "int", "float", "bool", "json", "path"]);

function isPrimitiveType(name: string): boolean {
  return PRIMITIVE_TYPES.has(name);
}

export function createTypeRegistry(): TypeRegistry {
  const types = new Map<string, TypeDeclarationNode>();

  return {
    types,

    register(type: TypeDeclarationNode): Diagnostic | null {
      const existing = types.get(type.name);
      if (existing) {
        return semanticError(
          "WP5001",
          `Type '${type.name}' is already defined`,
          type.span,
          `First defined at position ${existing.span.start}`
        );
      }
      types.set(type.name, type);
      return null;
    },

    resolve(name: string): TypeDeclarationNode | undefined {
      return types.get(name);
    },

    has(name: string): boolean {
      return types.has(name);
    },
  };
}

export function buildTypeRegistry(file: WorkPipeFileNode): {
  registry: TypeRegistry;
  diagnostics: Diagnostic[];
} {
  const registry = createTypeRegistry();
  const diagnostics: Diagnostic[] = [];

  for (const typeDecl of file.types) {
    const error = registry.register(typeDecl);
    if (error) {
      diagnostics.push(error);
    }
  }

  return { registry, diagnostics };
}

function collectTypeReferencesFromExpression(
  expr: TypeExpressionNode,
  references: Array<{ name: string; span: Span }>
): void {
  switch (expr.kind) {
    case "type_reference":
      references.push({ name: expr.name, span: expr.span });
      break;
    case "array_type":
      collectTypeReferencesFromExpression(expr.elementType, references);
      break;
    case "object_type":
      for (const field of expr.fields) {
        collectTypeReferencesFromExpression(field.type, references);
      }
      break;
    case "union_type":
      for (const member of expr.members) {
        collectTypeReferencesFromExpression(member, references);
      }
      break;
    case "primitive_type":
    case "string_literal_type":
    case "null_type":
      break;
  }
}

function collectTypeReferencesFromFields(
  fields: readonly TypeFieldNode[]
): Array<{ name: string; span: Span }> {
  const references: Array<{ name: string; span: Span }> = [];
  for (const field of fields) {
    collectTypeReferencesFromExpression(field.type, references);
  }
  return references;
}

function validateTypeReferencesInTypeDeclarations(
  file: WorkPipeFileNode,
  registry: TypeRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const availableTypes = Array.from(registry.types.keys());

  for (const typeDecl of file.types) {
    const references = collectTypeReferencesFromFields(typeDecl.fields);
    for (const ref of references) {
      if (!isPrimitiveType(ref.name) && !registry.has(ref.name)) {
        const hint =
          availableTypes.length > 0
            ? `Available types: ${availableTypes.join(", ")}`
            : "No user-defined types are available";
        diagnostics.push(
          semanticError(
            "WP5002",
            `Unknown type '${ref.name}'`,
            ref.span,
            hint
          )
        );
      }
    }
  }

  return diagnostics;
}

function validateTypeReferencesInAgentTask(
  task: AgentTaskNode,
  registry: TypeRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const availableTypes = Array.from(registry.types.keys());

  if (
    task.outputSchema &&
    typeof task.outputSchema === "string" &&
    !task.outputSchema.endsWith(".json")
  ) {
    const schemaName = task.outputSchema;
    if (!isPrimitiveType(schemaName) && !registry.has(schemaName)) {
      const hint =
        availableTypes.length > 0
          ? `Available types: ${availableTypes.join(", ")}`
          : "No user-defined types are available";
      diagnostics.push(
        semanticError(
          "WP5002",
          `Unknown type '${schemaName}'`,
          task.span,
          hint
        )
      );
    }
  }

  return diagnostics;
}

function validateTypeReferencesInStep(
  step: StepNode,
  registry: TypeRegistry
): Diagnostic[] {
  if (step.kind === "agent_task") {
    return validateTypeReferencesInAgentTask(step, registry);
  }
  return [];
}

function validateTypeReferencesInJob(
  job: AnyJobNode,
  registry: TypeRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const step of job.steps) {
    diagnostics.push(...validateTypeReferencesInStep(step, registry));
  }

  return diagnostics;
}

export function validateTypeReferences(
  file: WorkPipeFileNode,
  registry: TypeRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...validateTypeReferencesInTypeDeclarations(file, registry));

  for (const workflow of file.workflows) {
    for (const job of workflow.jobs) {
      diagnostics.push(...validateTypeReferencesInJob(job, registry));
    }

    for (const cycle of workflow.cycles) {
      for (const job of cycle.body.jobs) {
        diagnostics.push(...validateTypeReferencesInJob(job, registry));
      }
    }
  }

  return diagnostics;
}
