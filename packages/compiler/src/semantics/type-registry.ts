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
import { isConcreteJob } from "../ast/types.js";

export interface ImportItem {
  name: string;
  alias?: string;
}

export interface TypeRegistry {
  readonly types: Map<string, TypeDeclarationNode>;
  register(type: TypeDeclarationNode): Diagnostic | null;
  resolve(name: string): TypeDeclarationNode | undefined;
  has(name: string): boolean;
  importTypes(
    sourceRegistry: TypeRegistry,
    imports: ImportItem[],
    sourceFile: string,
    span?: Span
  ): Diagnostic[];
  getTypeProvenance(typeName: string): string | undefined;
  isExportable(typeName: string): boolean;
}

const PRIMITIVE_TYPES = new Set(["string", "int", "float", "bool", "json", "path"]);

function isPrimitiveType(name: string): boolean {
  return PRIMITIVE_TYPES.has(name);
}

export function createTypeRegistry(): TypeRegistry {
  const types = new Map<string, TypeDeclarationNode>();
  const provenance = new Map<string, string>();
  const exportable = new Set<string>();

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
      exportable.add(type.name);
      return null;
    },

    resolve(name: string): TypeDeclarationNode | undefined {
      return types.get(name);
    },

    has(name: string): boolean {
      return types.has(name);
    },

    importTypes(
      sourceRegistry: TypeRegistry,
      imports: ImportItem[],
      sourceFile: string,
      span?: Span
    ): Diagnostic[] {
      const diagnostics: Diagnostic[] = [];
      const errorSpan = span ?? { start: 0, end: 0 };

      for (const importItem of imports) {
        const sourceName = importItem.name;
        const localName = importItem.alias ?? importItem.name;

        const sourceType = sourceRegistry.resolve(sourceName);
        if (!sourceType) {
          const availableTypes = Array.from(sourceRegistry.types.keys())
            .filter(name => sourceRegistry.isExportable(name));
          const hint = availableTypes.length > 0
            ? `Available types in '${sourceFile}': ${availableTypes.join(", ")}`
            : `No exportable types are available in '${sourceFile}'`;

          diagnostics.push(
            semanticError(
              "WP7003",
              `Type '${sourceName}' does not exist in '${sourceFile}'`,
              errorSpan,
              hint
            )
          );
          continue;
        }

        if (!sourceRegistry.isExportable(sourceName)) {
          diagnostics.push(
            semanticError(
              "WP7003",
              `Type '${sourceName}' is not exportable from '${sourceFile}' (it was imported from another file)`,
              errorSpan,
              "Types are not transitive; import directly from the original source file"
            )
          );
          continue;
        }

        if (types.has(localName)) {
          const existingType = types.get(localName)!;
          const existingProvenance = provenance.get(localName);
          const existingSource = existingProvenance
            ? `imported from '${existingProvenance}'`
            : `defined at position ${existingType.span.start}`;

          diagnostics.push(
            semanticError(
              "WP7005",
              `Name collision: '${localName}' already exists (${existingSource})`,
              errorSpan,
              importItem.alias
                ? `Consider using a different alias`
                : `Use 'import { ${sourceName} as <different_name> }' to avoid collision`
            )
          );
          continue;
        }

        types.set(localName, sourceType);
        provenance.set(localName, sourceFile);
      }

      return diagnostics;
    },

    getTypeProvenance(typeName: string): string | undefined {
      return provenance.get(typeName);
    },

    isExportable(typeName: string): boolean {
      return exportable.has(typeName);
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
      if (isConcreteJob(job)) {
        diagnostics.push(...validateTypeReferencesInJob(job, registry));
      }
    }

    for (const cycle of workflow.cycles) {
      for (const job of cycle.body.jobs) {
        if (isConcreteJob(job)) {
          diagnostics.push(...validateTypeReferencesInJob(job, registry));
        }
      }
    }
  }

  return diagnostics;
}
