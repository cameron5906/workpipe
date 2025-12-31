# ADR-0010: Type System for Task/Job Data Flow

**Date**: 2025-12-31
**Status**: Proposed
**Deciders**: Architecture Team

## Context

User feedback has identified a gap in WorkPipe's current design: "Why not add type declaration so we can have type safety for passing stuff back and forth between tasks/jobs?"

Currently, WorkPipe has:
- **Primitive type annotations** in the language reference (string, int, float, bool, json, path, secret<string>) used primarily for workflow dispatch inputs
- **Artifact type declarations** via `emits`/`consumes` with basic type hints (`emits build_output: json`)
- **Job outputs** accessed via `needs.<job>.outputs.<name>` with no type information

However, the type system is incomplete:
1. Job outputs have no declared types - they are inferred as strings (GitHub Actions runtime constraint)
2. No compile-time validation that consumed artifacts match producer types
3. No structured way to declare output schemas for regular jobs (only agent tasks have `output_schema`)
4. Template interpolations (`{{variable}}`) have no type checking

### GitHub Actions Runtime Constraints

A critical constraint shapes this design: **GitHub Actions passes all job outputs as strings at runtime**. The `$GITHUB_OUTPUT` mechanism serializes everything to string format. This means:
- Type annotations are compile-time only (documentation + validation)
- Runtime type coercion happens automatically (numbers become strings)
- Complex types (objects, arrays) must be JSON-serialized as strings

### Current Grammar and AST State

The grammar (`packages/lang/src/workpipe.grammar`) has no type annotation syntax for job outputs. The AST (`packages/compiler/src/ast/types.ts`) includes:
- `JobNode` with `steps` but no `outputs` field
- `AgentTaskNode` with `outputSchema` (file reference) but no inline type

The language reference (docs/language-reference.md lines 472-504) documents primitive types but does not show how to apply them to job outputs.

### Design Goals

1. **Type safety at compile time**: Validate that consumers expect the types producers emit
2. **Developer experience**: IDE support (completion, hover, validation) for typed outputs
3. **Backward compatibility**: Types must be optional - existing workflows must continue to work
4. **Simplicity**: Avoid over-engineering; start with what provides immediate value
5. **GitHub Actions alignment**: Types are compile-time contracts, not runtime enforcement

## Decision

### 1. Inline Type Annotations for Job Outputs (Recommended Approach)

**Decision**: Introduce optional inline type annotations for job outputs using a structured block syntax.

**Syntax**:
```workpipe
job build {
  runs_on: ubuntu-latest

  outputs: {
    version: string
    build_number: int
    success: bool
    metadata: json
  }

  steps: [
    run("echo version=1.2.3 >> $GITHUB_OUTPUT"),
    run("echo build_number=42 >> $GITHUB_OUTPUT")
  ]
}

job deploy {
  runs_on: ubuntu-latest
  needs: [build]

  steps: [
    run("echo Deploying version ${needs.build.outputs.version}")
  ]
}
```

**Type checking behavior**:
- When `deploy` references `needs.build.outputs.version`, the compiler validates that `build` declares a `version` output
- If `build` has an `outputs:` block, references to undeclared outputs produce a warning (WP2xxx)
- If `build` has no `outputs:` block, output references are unchecked (backward compatibility)

**Rationale**:
- Inline annotations are concise and co-located with the job definition
- The `outputs:` block mirrors GitHub Actions workflow syntax, reducing cognitive load
- Optional typing preserves backward compatibility
- Type names align with existing primitive types in the language reference

### 2. Supported Type Vocabulary

**Decision**: Support the following types for job outputs, aligned with the existing type vocabulary:

| Type | Description | Runtime Representation |
|------|-------------|------------------------|
| `string` | Text value | String (native) |
| `int` | Integer number | String (e.g., "42") |
| `float` | Floating-point number | String (e.g., "3.14") |
| `bool` | Boolean value | String ("true" or "false") |
| `json` | Structured JSON data | String (JSON-serialized) |

**Not included in initial scope**:
- `path` - semantically meaningful only for artifacts, not outputs
- `secret<T>` - outputs should never contain secrets
- Optional types (`string?`) - outputs are either declared or not
- Array types (`string[]`) - use `json` for arrays
- Union types (`string | int`) - adds complexity without clear benefit
- Generic types - unnecessary for output typing

**Rationale**:
- Minimal type vocabulary covers 95% of use cases
- Complex structured data uses `json` type with optional schema validation
- Avoiding generics and unions keeps the type system simple and teachable

### 3. Type Checking Scope

**Decision**: Implement compile-time type checking for the following scenarios:

**Checked**:
1. **Output reference existence**: `needs.build.outputs.foo` warns if `build` declares outputs but not `foo`
2. **Type compatibility in expressions**: `needs.build.outputs.count > 10` warns if `count` is declared as `string` (not numeric)
3. **Artifact type flow**: `consumes` declarations must match `emits` type (existing behavior, enhanced)

**Not checked (deferred)**:
1. **Template interpolation types**: `${needs.build.outputs.version}` - string coercion is always valid
2. **Cross-workflow references**: Types flow within a single workflow only
3. **Runtime value validation**: The compiler cannot verify that `echo 42` produces a valid int

**Rationale**:
- Focus on high-value validations that catch real bugs
- Template strings are inherently string-typed; checking them adds noise without value
- Runtime validation is impossible given GitHub Actions' architecture

### 4. Grammar Extensions

**Decision**: Extend the grammar with `OutputsProperty` for job declarations.

**Grammar additions**:
```
JobProperty {
  RunsOnProperty |
  NeedsProperty |
  IfProperty |
  StepsProperty |
  OutputsProperty        // NEW
}

OutputsProperty {
  kw<"outputs"> ":" OutputsBlock
}

OutputsBlock {
  "{" OutputDecl* "}"
}

OutputDecl {
  Identifier ":" TypeName
}

TypeName {
  kw<"string"> |
  kw<"int"> |
  kw<"float"> |
  kw<"bool"> |
  kw<"json">
}
```

**Reserved keywords to add**: None required. `outputs` is already reserved. Type keywords (`string`, `int`, `float`, `bool`, `json`) are added as contextual keywords within `TypeName`.

**Rationale**:
- Block syntax (`outputs: { ... }`) is consistent with existing property blocks
- Colon-based type annotations (`name: type`) are familiar from TypeScript/Python
- Type keywords are only recognized in type position, avoiding identifier conflicts

### 5. AST Extensions

**Decision**: Extend AST types to capture output declarations.

**New types in `ast/types.ts`**:
```typescript
export interface OutputDeclaration {
  readonly kind: "output_declaration";
  readonly name: string;
  readonly type: OutputType;
  readonly span: Span;
}

export type OutputType = "string" | "int" | "float" | "bool" | "json";

// Updated JobNode
export interface JobNode {
  readonly kind: "job";
  readonly name: string;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly condition: ExpressionNode | null;
  readonly outputs: readonly OutputDeclaration[];  // NEW - empty array if not declared
  readonly steps: readonly StepNode[];
  readonly span: Span;
}
```

**Rationale**:
- Explicit `OutputDeclaration` type enables type-safe handling in semantic analysis
- `outputs` array defaults to empty for backward compatibility
- `OutputType` as string literal union is simple and exhaustive

### 6. Diagnostic Codes

**Decision**: Introduce new diagnostic codes for type-related errors and warnings.

| Code | Severity | Message Template |
|------|----------|------------------|
| WP2010 | Warning | Output '{name}' referenced but not declared in job '{job}' outputs |
| WP2011 | Warning | Job '{job}' has no outputs block; output references are unchecked |
| WP2012 | Error | Type mismatch: expected '{expected}', found '{actual}' |
| WP2013 | Warning | Numeric comparison on non-numeric output '{name}' (declared as '{type}') |
| WP2014 | Info | Output '{name}' declared but never referenced |

**Rationale**:
- Warnings for missing declarations allow gradual adoption
- Errors reserved for provable type mismatches
- Info-level diagnostics for unused declarations (can be filtered in CI)

### 7. Code Generation Behavior

**Decision**: Type annotations are documentation only; generated YAML is unchanged.

The `outputs:` block in WorkPipe does NOT generate GitHub Actions `outputs:` declarations. GitHub Actions job outputs are declared implicitly via `$GITHUB_OUTPUT` writes. WorkPipe's type annotations exist purely for:
- Compile-time validation
- IDE tooling (hover, completion)
- Documentation

**Future option**: Generate YAML comments documenting output types:
```yaml
jobs:
  build:
    # WorkPipe outputs: version (string), build_number (int)
    runs-on: ubuntu-latest
```

**Rationale**:
- GitHub Actions has no native output typing; generating `outputs:` would be misleading
- Type annotations serve the developer at write-time, not GitHub Actions at runtime
- Comments preserve type information without affecting workflow behavior

### 8. Migration and Backward Compatibility

**Decision**: Types are fully optional. Existing workflows require no changes.

**Compatibility guarantees**:
1. Jobs without `outputs:` block compile and run identically to today
2. Output references to jobs without `outputs:` produce no warnings (opt-in typing)
3. Adding `outputs:` to a job is an additive, non-breaking change
4. Removing `outputs:` from a job is safe (reverts to unchecked mode)

**Gradual adoption path**:
1. Start by adding types to new jobs
2. Add types to existing jobs incrementally
3. Enable stricter checking via config (future: `strict_outputs: true`)

**Rationale**:
- Zero friction for existing users
- Teams can adopt typing at their own pace
- Strict mode can be a future enhancement for teams wanting enforcement

## Alternatives Considered

### Alternative 1: Named Type Declarations (Rejected)

**Approach**: Allow separate type definitions referenced by name.

```workpipe
type BuildOutput {
  version: string
  build_number: int
}

job build {
  outputs: BuildOutput
  ...
}
```

**Pros**:
- Reusable type definitions
- More expressive for complex schemas
- Familiar from TypeScript/Go

**Cons**:
- Adds significant grammar complexity
- Requires type resolution pass in compiler
- Overkill for typical job outputs (1-5 simple values)
- Creates a separate "type language" to maintain

**Decision**: Rejected for initial implementation. Named types can be added later if inline annotations prove insufficient. Most job outputs are simple enough that inline declarations suffice.

### Alternative 2: JSON Schema References (Rejected)

**Approach**: Reference JSON Schema files for output typing.

```workpipe
job build {
  outputs: schema("schemas/build-output.json")
  ...
}
```

**Pros**:
- Full expressiveness of JSON Schema
- Consistent with `output_schema` for agent tasks
- External schema files are already supported

**Cons**:
- Verbose for simple outputs
- Requires managing separate schema files
- JSON Schema is complex; primitive types suffice for outputs
- Schema files aren't available at IDE analysis time without file I/O

**Decision**: Rejected. JSON Schema is appropriate for agent task output (complex structured data) but overkill for job outputs (typically a few scalars). Inline primitive types are simpler and more ergonomic.

### Alternative 3: TypeScript-Style Inline Objects (Rejected)

**Approach**: Use TypeScript-inspired inline type syntax.

```workpipe
job build {
  outputs: { version: string; build_number: number }
  ...
}
```

**Pros**:
- Familiar to TypeScript users
- Compact single-line format

**Cons**:
- Semicolons as separators are inconsistent with WorkPipe style
- Single-line format is hard to read with many outputs
- Inline objects suggest runtime structure, not just type annotations

**Decision**: Rejected. The block syntax with one declaration per line is more readable and consistent with WorkPipe's existing style.

### Alternative 4: Prefix Type Syntax (Rejected)

**Approach**: Type precedes name (C-style).

```workpipe
job build {
  outputs: {
    string version
    int build_number
  }
}
```

**Pros**:
- Familiar from C/Java
- Aligns types visually

**Cons**:
- Inconsistent with most modern DSLs
- WorkPipe's existing type usage (inputs) uses postfix
- Less natural for IDE completion (type before name)

**Decision**: Rejected. Postfix type annotations (`name: type`) are more consistent with WorkPipe's existing style and modern DSL conventions.

### Alternative 5: No Type Annotations (Defer Indefinitely)

**Approach**: Continue without explicit output typing.

**Pros**:
- No implementation effort
- Simpler language
- Runtime is untyped anyway

**Cons**:
- No compile-time validation of output references
- Poor IDE experience (no completion for outputs)
- Common source of runtime errors goes undetected

**Decision**: Rejected. The user feedback and developer experience benefits justify the implementation effort.

## Consequences

### Positive

1. **Compile-time validation**: Catch output reference typos and mismatches before workflow execution

2. **IDE support**: Enable autocomplete for `needs.<job>.outputs.`, hover documentation showing output types

3. **Self-documenting workflows**: Output declarations serve as inline documentation for job contracts

4. **Gradual adoption**: Optional typing allows teams to adopt at their own pace

5. **Foundation for stricter checking**: Enables future enhancements like strict mode, cross-workflow typing

### Negative

1. **Grammar complexity**: New grammar rules for `outputs:` block and type annotations

2. **Compiler work**: Requires new AST nodes, semantic analysis, and diagnostic reporting

3. **Documentation overhead**: Language reference, tutorials, and error messages need updates

4. **Runtime disconnect**: Types are compile-time only; runtime errors still possible if `$GITHUB_OUTPUT` writes don't match declarations

### Neutral

1. **No YAML output change**: Generated workflows are identical; types are compiler-internal

2. **Partial coverage**: Only job outputs are typed; environment variables, secrets remain untyped

3. **Primitive types only**: Complex schemas require `json` type; no object/array type syntax

## Implementation Notes

### Phase 1: Grammar and Parser
- Add `OutputsProperty` to grammar
- Update parser to emit `OutputsBlock` CST nodes
- Reserved keyword handling (type keywords in context)

### Phase 2: AST Builder
- Add `OutputDeclaration` interface
- Update `JobNode` with `outputs` array
- CST-to-AST transformation for output declarations

### Phase 3: Semantic Analysis
- Build output type map per job
- Validate `needs.<job>.outputs.<name>` references
- Emit WP2010-WP2014 diagnostics

### Phase 4: IDE Integration
- VS Code extension updates for output completion
- Hover information showing output types
- Go-to-definition from output reference to declaration

## References

- PROJECT.md Section 5: Language overview (syntax + semantics)
- docs/language-reference.md lines 472-504: Existing type vocabulary
- ADR-0003: Lezer grammar design and expression language
- ADR-0005: Agent task design (output_schema handling)
- ADR-0006: Diagnostic system design and error reporting strategy
- [GitHub Actions: Defining outputs for jobs](https://docs.github.com/en/actions/using-jobs/defining-outputs-for-jobs)
- [GitHub Actions: Setting an output parameter](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-output-parameter)
