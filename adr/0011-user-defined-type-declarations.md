# ADR-0011: User-Defined Type Declarations

**Date**: 2025-12-31
**Status**: Proposed
**Deciders**: Architecture Team

## Context

User feedback has established a clear requirement for user-defined types in WorkPipe:

> "Define complex JSON shapes that matter when using them in job scripts or passing to agent_task. Compiler automatically generates JSON schema FROM type definitions. More reusable, brings clarity and protection. No generics needed. VS Code extension must support diagnostics so users can't reference non-existent properties."

Currently, WorkPipe has:
- **Primitive type annotations** for job outputs (`string`, `int`, `float`, `bool`, `json`, `path`) per ADR-0010
- **Inline schema syntax** for agent task `output_schema` with object/array/union types (WI-056)
- **No named type declarations** - complex types must be duplicated wherever used

### Gap Analysis

1. **No reusability**: A complex type like `BuildInfo { version: string, commit: string, artifacts: [...] }` must be duplicated in every job output that uses it
2. **No cross-reference validation**: When job A outputs typed data and job B consumes it, property access (`needs.A.outputs.info.version`) is not validated against the type structure
3. **Duplicate schema definitions**: Agent tasks needing the same schema must each define it inline or reference separate JSON files

### Design Goals

1. **Single source of truth**: Define a type once, use it in outputs and schemas
2. **Compile-time property validation**: Catch `needs.build.outputs.info.nonexistent` before runtime
3. **JSON Schema generation**: Compiler generates valid JSON Schema from type definitions
4. **Backward compatibility**: Existing workflows without types must continue to work
5. **Simplicity**: No generics, no advanced type operations - just structural definitions

### Key Design Questions

Two architectural decisions require resolution:

1. **Type declaration placement**: Where should types be declared?
2. **Type compatibility model**: Structural vs nominal typing?

## Decision

### 1. Type Declaration Placement: File Level, Before Workflow

**Decision**: Type declarations appear at file level, before the `workflow` block(s).

**Syntax**:
```workpipe
// Types are declared at file level
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

type ReviewResult {
  approved: bool
  rating: int
  comments: [{
    file: string
    line: int
    severity: "error" | "warning" | "info"
    message: string
  }]
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo  // Reference by name
    }
    steps: [...]
  }

  agent_job review {
    runs_on: ubuntu-latest
    agent_task "analyze" {
      prompt: "Review the code"
      output_schema: ReviewResult  // Reference by name
    }
  }
}
```

**Alternatives considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| Before workflow (chosen) | Types at file level before `workflow` | Clear separation, familiar from C/Go/Rust, easy to find | Must scroll past types to see workflow |
| Inside workflow | Types declared inside workflow block | Scoped to workflow | Nesting complexity, unclear why types need workflow scope |
| Either position | Allow both locations | Flexibility | Confusing, harder to find definitions |
| Separate file | Types in `*.workpipe-types` files | Clean separation | Import syntax needed, more files to manage |

**Rationale**:
- File-level placement matches expectations from TypeScript, Go, and other typed languages
- Types are logically "definitions" that the workflow "uses" - they belong before the workflow
- Single location makes types easy to find without search
- No scoping complexity - all types visible to all workflows in the file

### 2. Type Compatibility Model: Structural Typing

**Decision**: Types use **structural typing** - two types are compatible if they have the same shape.

**Example**:
```workpipe
type Point2D {
  x: int
  y: int
}

type Coordinate {
  x: int
  y: int
}

// These are compatible - same structure
```

**Implications**:
- A job declaring `outputs: { pos: Point2D }` can be consumed by code expecting `Coordinate`
- Named type references are validated, but compatibility is based on structure
- This matches TypeScript's model (and differs from Java/C# nominal typing)

**Rationale**:
- Structural typing is simpler to implement and reason about
- Reduces coupling between type definitions
- Familiar to TypeScript users (WorkPipe's primary audience)
- Nominal typing would require explicit conversions, adding complexity without clear benefit
- The primary goal is property validation, not type branding

### 3. Type Reference Syntax

**Decision**: Types are referenced by identifier name, not quoted strings.

**In job outputs**:
```workpipe
outputs: {
  info: BuildInfo      // Named type reference
  count: int           // Primitive type (unchanged)
}
```

**In agent task schemas**:
```workpipe
agent_task "analyze" {
  output_schema: ReviewResult   // Named type reference
  // OR inline (still supported)
  output_schema: { approved: bool, rating: int }
}
```

**Coexistence with existing syntax**:
- Inline schemas (`output_schema: { ... }`) remain valid
- File references (`output_schema: "path/to/schema.json"`) remain valid
- Named type references add a third option

**Type resolution priority**:
1. Check if identifier matches a declared type name -> resolve to type definition
2. Check if identifier matches a primitive type -> use primitive
3. Otherwise -> emit diagnostic "undefined type"

### 4. Grammar Extensions

**Decision**: Extend the grammar with `TypeDecl` at the top level.

**Grammar additions** (to `packages/lang/src/workpipe.grammar`):
```lezer
@top Workflow { (TypeDecl | WorkflowDecl)* }

TypeDecl {
  kw<"type"> Identifier TypeBody
}

TypeBody {
  "{" TypeField* "}"
}

TypeField {
  Identifier ":" SchemaType
}

// SchemaType already exists and handles:
// - primitives: string, int, float, bool
// - arrays: [type]
// - objects: { field: type }
// - unions: type | type
// - string literals: "value"
// - null: null
```

**Key insight**: The existing `SchemaType` production from inline schemas (WI-056) is reused for type body fields. No new type syntax is needed - `TypeDecl` simply wraps existing schema type syntax with a name.

**Reserved keyword**: `type` is added to the reserved keyword list.

### 5. AST Extensions

**Decision**: Add `TypeDeclarationNode` to the AST.

**New types** (in `packages/compiler/src/ast/types.ts`):
```typescript
export interface TypeDeclarationNode {
  readonly kind: "type_declaration";
  readonly name: string;
  readonly body: SchemaObjectNode;  // Reuses existing schema object type
  readonly span: Span;
}

// Updated WorkflowNode to include file-level types
export interface WorkPipeFileNode {
  readonly kind: "file";
  readonly types: readonly TypeDeclarationNode[];
  readonly workflows: readonly WorkflowNode[];
  readonly span: Span;
}

// Type reference for outputs and schemas
export interface TypeReferenceNode {
  readonly kind: "type_reference";
  readonly name: string;
  readonly span: Span;
}

// Updated OutputDeclaration to accept type reference
export interface OutputDeclaration {
  readonly name: string;
  readonly type: OutputType | TypeReferenceNode;
  readonly span: Span;
}
```

**Reuse of existing types**:
- `SchemaObjectNode`, `SchemaFieldNode`, `SchemaTypeNode` are reused
- Type bodies have the same structure as inline schemas
- This reduces code duplication and ensures consistent JSON Schema generation

### 6. Type Registry and Resolution

**Decision**: Implement a `TypeRegistry` for name resolution.

**Type registry responsibilities**:
```typescript
export interface TypeRegistry {
  // Register a type from AST
  register(decl: TypeDeclarationNode): void;

  // Check if name is defined
  has(name: string): boolean;

  // Resolve name to definition
  resolve(name: string): TypeDeclarationNode | undefined;

  // Get all registered types
  all(): readonly TypeDeclarationNode[];
}
```

**Resolution algorithm**:
1. Parse all type declarations before workflows
2. Build registry with all declared types
3. When encountering a type reference:
   - If name is in registry -> resolve to definition
   - If name is a primitive (`string`, `int`, etc.) -> use primitive
   - Otherwise -> emit diagnostic WP5001

**Scope rules**:
- Types are file-scoped (visible to all workflows in the same file)
- No cross-file type imports in initial implementation
- No shadowing of primitive type names (error WP5002)

### 7. JSON Schema Generation

**Decision**: Reuse and extend the existing `schemaTypeToJsonSchema` function.

**Current implementation** (in `packages/compiler/src/codegen/transform.ts`):
```typescript
function schemaTypeToJsonSchema(schemaType: SchemaTypeNode): JsonSchema {
  // Already handles primitives, arrays, objects, unions, null, string literals
}
```

**Extension for type references**:
```typescript
function schemaTypeToJsonSchema(
  schemaType: SchemaTypeNode | TypeReferenceNode,
  registry: TypeRegistry
): JsonSchema {
  if (schemaType.kind === "type_reference") {
    const resolved = registry.resolve(schemaType.name);
    if (!resolved) {
      throw new Error(`Unresolved type: ${schemaType.name}`);
    }
    return inlineSchemaToJsonSchema(resolved.body, registry);
  }
  // ... existing logic
}
```

**Key principle**: Type references are expanded during JSON Schema generation. The output is a self-contained JSON Schema with no references.

### 8. Property Access Validation

**Decision**: Validate property access on typed outputs during semantic analysis.

**Validation scope**:
- Expressions like `needs.build.outputs.info.version` are validated
- The path is decomposed: job=`build`, output=`info`, property=`version`
- If `info` has a type reference, resolve it and check `version` exists

**Diagnostic**: WP5003 - Property does not exist on type
```
error[WP5003]: Property 'timestamp' does not exist on type 'BuildInfo'
  --> ci.workpipe:25:40
   |
25 |       run("echo ${{ needs.build.outputs.info.timestamp }}")
   |                                              ^^^^^^^^^ unknown property
   |
   = Available properties: version, commit
```

**Implementation approach**:
1. Extract output references from expressions (reuse expression analysis from WI-063)
2. For each reference with a typed output, resolve the type
3. For each property access beyond the output, validate against type structure
4. Emit WP5003 for invalid properties with suggestions

### 9. Diagnostic Codes

**Decision**: Introduce new diagnostic codes for type-related errors.

| Code | Severity | Message Template |
|------|----------|------------------|
| WP5001 | Error | Undefined type '{name}' |
| WP5002 | Error | Type name '{name}' shadows built-in type |
| WP5003 | Error | Property '{prop}' does not exist on type '{type}' |
| WP5004 | Warning | Type '{name}' is declared but never used |
| WP5005 | Error | Duplicate type declaration '{name}' |

### 10. Backward Compatibility

**Decision**: Types are fully optional. Existing workflows compile unchanged.

**Compatibility guarantees**:
1. Files without type declarations compile identically to today
2. Jobs without typed outputs work as before (output references unchecked)
3. Inline schemas in `output_schema` work as before
4. File path references in `output_schema` work as before
5. Adding types to a file is an additive, non-breaking change

**Migration path**:
1. Define types for complex data structures
2. Replace inline schemas with type references
3. Add type annotations to job outputs
4. Get property validation for free

## Alternatives Considered

### Alternative 1: Types Inside Workflow Block

```workpipe
workflow ci {
  types {
    BuildInfo { ... }
  }

  job build { ... }
}
```

**Rejected because**:
- Creates unnecessary nesting
- Types are logically file-level definitions, not workflow-specific
- Other languages place type definitions at module/file level

### Alternative 2: Import Syntax for Cross-File Types

```workpipe
import { BuildInfo, DeployConfig } from "./types.workpipe"
```

**Deferred because**:
- Adds significant complexity (file resolution, import cycles)
- Initial implementation focuses on single-file type definitions
- Can be added later if needed (would require new ADR)

### Alternative 3: Nominal Typing

Types match by name, not structure.

**Rejected because**:
- Requires explicit conversions between structurally identical types
- More complex to implement and reason about
- Structural typing is sufficient for property validation use case
- TypeScript uses structural typing - familiar to target audience

### Alternative 4: Generic Types

```workpipe
type Result<T> {
  success: bool
  data: T
  error: string | null
}
```

**Rejected because**:
- User explicitly stated "no generics needed"
- Adds significant complexity to type system
- Most use cases are covered by concrete types
- Can be considered for future enhancement if clear demand emerges

### Alternative 5: Type Aliases for Primitives

```workpipe
type Timestamp = int
type Version = string
```

**Deferred because**:
- Initial implementation focuses on object types (complex shapes)
- Primitive aliases add little value for property validation
- Can be added later if useful

## Consequences

### Positive

1. **Single source of truth**: Define types once, use everywhere
2. **Compile-time safety**: Property access errors caught before runtime
3. **Better IDE experience**: Type-aware completion and hover (future)
4. **JSON Schema generation**: No external schema files needed for agent tasks
5. **Self-documenting workflows**: Types serve as inline documentation
6. **Gradual adoption**: Optional types allow incremental migration

### Negative

1. **Learning curve**: New syntax to learn
2. **Grammar complexity**: Additional productions and AST nodes
3. **Compiler work**: Type registry, resolution, and validation phases
4. **Maintenance burden**: Types must be kept in sync with actual data

### Neutral

1. **No runtime impact**: Types are compile-time only
2. **Structural typing**: Familiar to TypeScript users, may surprise Java users
3. **File-scoped**: No cross-file imports initially

## Implementation Notes

### Phase 1: Grammar and Parser (WI-065)
- Add `TypeDecl` production
- Reserve `type` keyword
- Update parser tests

### Phase 2: AST Types (WI-066)
- Add `TypeDeclarationNode`
- Add `TypeReferenceNode`
- Update `OutputDeclaration` to accept references
- Create `WorkPipeFileNode` wrapper

### Phase 3: Type Registry (WI-067)
- Implement `TypeRegistry` class
- Wire into compile pipeline
- Add duplicate detection (WP5005)
- Add undefined type detection (WP5001)

### Phase 4: Output Type References (WI-068)
- Allow type references in `outputs:` blocks
- Update AST builder
- Validate references during semantic analysis

### Phase 5: Agent Schema References (WI-069)
- Allow type references in `output_schema:`
- Update JSON Schema generation
- Pass registry to schema functions

### Phase 6: Property Validation (WI-070)
- Extract output references from expressions
- Resolve types for typed outputs
- Validate property access paths
- Emit WP5003 diagnostics

### Phase 7: VS Code Integration (WI-071)
- Surface type diagnostics in editor
- Hover shows resolved type (stretch goal)
- Completion suggests properties (stretch goal)

### Phase 8: Documentation (WI-072)
- Update language reference
- Add type system tutorial
- Document new diagnostics

## References

- [WI-064: User-Defined Type System](../work_items/WI-064-user-defined-type-system.md) - Parent work item
- [ADR-0010: Type System for Task/Job Data Flow](0010-type-system-for-data-flow.md) - Foundation for primitive types
- [WI-056: JSON Schema Type Definitions](../work_items/WI-056-json-schema-inline-types.md) - Inline schema implementation
- [WI-063: Expression Type Checking](../work_items/WI-063-expression-type-checking.md) - Expression analysis foundation
- PROJECT.md Section 5: Language overview
- TypeScript Handbook: Structural Type System - https://www.typescriptlang.org/docs/handbook/type-compatibility.html
