# ADR-0004: YAML IR Design and Emission Strategy

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WI-008 requires implementing the code generation phase of the WorkPipe compiler: transforming the typed AST into GitHub Actions workflow YAML files. This is the final stage needed to complete Milestone A's vertical slice (parse-to-output).

The existing infrastructure provides:
- **AST types** (`packages/compiler/src/ast/types.ts`): `WorkflowNode`, `JobNode`, `StepNode`, `TriggerNode`, `ExpressionNode` with source spans
- **AST builder** (`packages/compiler/src/ast/builder.ts`): CST-to-AST transformation using Lezer tree cursors
- **Golden test framework** (`packages/compiler/src/testing/golden.ts`): Placeholder awaiting `compile()` implementation
- **Dependencies**: The `yaml` package (v2.7.0) is already declared

Key design questions:
1. Should the compiler transform AST directly to YAML strings, or use an intermediate representation?
2. When should expression nodes be serialized to GitHub Actions expression strings?
3. How should trigger format vary (scalar vs. array) based on event count?
4. How do we ensure deterministic, reproducible YAML output?
5. How do we design for extensibility toward Milestone B features (matrix, artifacts, cycles)?

The target outputs are defined by the fixtures:
- `examples/minimal/expected.yml`: Single-event trigger, one job, one step
- `examples/simple-job/expected.yml`: Multi-event trigger, two jobs with dependencies and conditions

## Decision

### 1. Three-Layer Codegen Architecture

**Decision**: Implement code generation as three distinct layers: Transform, IR, and Emit.

```
AST (WorkflowNode)
        |
        v
   [Transform]    AST -> IR conversion, expression serialization
        |
        v
   YAML IR        Intermediate representation mirroring GHA structure
        |
        v
     [Emit]       IR -> YAML string serialization
        |
        v
   YAML String
```

**Rationale**:
- **Separation of concerns**: Transform handles semantic mapping; Emit handles serialization details
- **Testability**: IR can be inspected and tested independently of YAML serialization
- **Extensibility**: Milestone B features (cycle lowering, matrix expansion) can inject transformations between AST and IR
- **Debugging**: IR provides a clear intermediate state for troubleshooting compilation issues

The alternative (direct AST-to-YAML) would conflate semantic decisions with serialization details, making both harder to test and extend.

### 2. YAML IR Type Definitions

**Decision**: Define IR types that closely mirror GitHub Actions workflow schema while remaining serialization-agnostic.

```typescript
// packages/compiler/src/codegen/yaml-ir.ts

export interface WorkflowIR {
  readonly name: string;
  readonly on: TriggerIR;
  readonly jobs: Map<string, JobIR>;  // Preserves insertion order
}

export interface TriggerIR {
  readonly events: readonly string[];
}

export interface JobIR {
  readonly runsOn: string;
  readonly needs?: readonly string[];
  readonly condition?: string;  // Serialized GHA expression
  readonly steps: readonly StepIR[];
}

export type StepIR = RunStepIR | UsesStepIR;

export interface RunStepIR {
  readonly kind: "run";
  readonly run: string;
}

export interface UsesStepIR {
  readonly kind: "uses";
  readonly uses: string;
}
```

**Key design choices**:

1. **`Map<string, JobIR>` for jobs**: ES2015+ guarantees Map iteration order equals insertion order. This ensures jobs appear in source order in the output.

2. **`condition` as string**: Expression nodes are serialized during transform, not emit. The IR stores the final GitHub Actions expression string.

3. **Immutable (`readonly`)**: IR nodes are immutable, matching AST convention. Any transformations produce new IR nodes.

4. **Minimal representation**: IR only includes fields that appear in output. Optional fields (`needs`, `condition`) are omitted when undefined.

### 3. Expression Serialization During Transform

**Decision**: Serialize AST expression nodes to GitHub Actions expression strings during the transform phase, not during emit.

**Transform phase responsibility**:
```typescript
// Transform converts ExpressionNode to string
function serializeExpression(expr: ExpressionNode): string {
  switch (expr.kind) {
    case "property":
      return expr.path.join(".");
    case "string":
      return `'${escapeGHAString(expr.value)}'`;
    case "boolean":
      return expr.value ? "true" : "false";
    case "binary":
      return `${serializeExpression(expr.left)} ${expr.operator} ${serializeExpression(expr.right)}`;
  }
}
```

**Rationale**:
- Expression serialization requires semantic knowledge (quoting rules, operator mapping)
- Emit phase should only handle structural YAML concerns, not expression semantics
- Keeps IR types simple (strings vs. recursive expression trees)
- Future diagnostics can report serialized form in error messages

**Quoting convention**: String literals within expressions use single quotes (`'refs/heads/main'`) per GitHub Actions convention. Double quotes in the source are converted during serialization.

### 4. Trigger Normalization Rules

**Decision**: Store triggers uniformly as arrays in IR; emit phase decides scalar vs. array YAML form based on count.

**IR representation**: Always `events: readonly string[]`

**Emit logic**:
```typescript
function emitTrigger(trigger: TriggerIR): string | string[] {
  return trigger.events.length === 1
    ? trigger.events[0]      // Scalar: on: push
    : trigger.events;        // Array:  on: [push, pull_request]
}
```

**Rationale**:
- Uniform IR representation simplifies transform logic
- Emit phase has full context to make formatting decisions
- Single-event scalar form (`on: push`) is more readable than array form (`on: [push]`)
- Multi-event array form (`on: [push, pull_request]`) is idiomatic GHA syntax

**Expected outputs**:
- `minimal.workpipe`: `on: push` (scalar)
- `simple-job.workpipe`: `on: [push, pull_request]` (array, flow style)

### 5. Deterministic YAML Emission

**Decision**: Use the `yaml` package with specific options to guarantee deterministic, reproducible output.

**Stringify configuration**:
```typescript
import { stringify } from "yaml";

export function emit(ir: WorkflowIR): string {
  const doc = buildDocument(ir);
  return stringify(doc, {
    lineWidth: 0,           // Disable line wrapping
    defaultKeyType: "PLAIN",
    defaultStringType: "PLAIN",
    sortMapEntries: false,  // Preserve insertion order
  }) + "\n";  // Trailing newline
}
```

**Key options**:

| Option | Value | Purpose |
|--------|-------|---------|
| `lineWidth` | `0` | Prevents automatic line wrapping that could vary by content |
| `sortMapEntries` | `false` | Preserves job order, step order, key order as defined in IR |
| `defaultStringType` | `PLAIN` | Uses plain scalars where possible (cleaner output) |

**Rationale**:
- Deterministic output enables reliable golden tests and git diffs
- Preserving insertion order matches user's mental model of source structure
- Plain scalars are more readable than quoted scalars for most values

### 6. Trailing Newline Convention

**Decision**: All emitted YAML files end with exactly one trailing newline (`\n`).

**Implementation**: Emit function appends `\n` after `stringify()` output.

**Rationale**:
- POSIX convention: text files end with newline
- Git friendliness: avoids "No newline at end of file" warnings
- Editor compatibility: most editors expect and preserve trailing newlines
- Consistency: all WorkPipe output follows the same convention

### 7. Plain Scalar Style for Commands

**Decision**: Use plain scalar style for `run:` commands and other string values where valid.

**Expected output**:
```yaml
steps:
  - run: echo Hello, WorkPipe!
  - run: npm install
```

**Not**:
```yaml
steps:
  - run: "echo Hello, WorkPipe!"
  - run: 'npm install'
```

**Rationale**:
- Plain scalars are more readable and idiomatic in YAML
- The `yaml` package's `defaultStringType: "PLAIN"` achieves this
- Quoting is applied automatically only when required (special characters, reserved indicators)

**Exception**: Strings containing YAML special characters (`:`, `#`, `{`, etc.) will be automatically quoted by the `yaml` package.

### 8. No Comment Preservation (Milestone A)

**Decision**: Comments in WorkPipe source are not preserved in emitted YAML output for Milestone A.

**Rationale**:
- Comments are stripped during Lezer parsing (not represented in CST)
- Preserving comments requires significant complexity (comment attachment heuristics)
- Generated YAML is a build artifact, not a source file to be edited
- Users who need comments can use `raw_yaml` escape hatch in future milestones

**Future consideration**: Milestone B or later may add comment preservation for documentation purposes, requiring AST changes to carry comment nodes.

### 9. Error Handling: Exception-Based for Milestone A

> **Note**: This section has been **superseded by [ADR-0006](0006-diagnostic-system-design-and-error-reporting-strategy.md)**, which introduces a `CompileResult` pattern with diagnostic collection instead of exception-based error handling.

**Decision**: The `compile()` function throws exceptions for compilation errors in Milestone A.

**API**:
```typescript
export function compile(source: string): string {
  // Throws CompileError on failure
  // Returns YAML string on success
}
```

**Exception types**:
- `ParseError`: Lezer parsing failed (syntax errors)
- `TransformError`: AST-to-IR transformation failed (semantic errors)
- `CompileError`: Base class for all compilation errors

**Rationale**:
- Simpler API for initial milestone
- Matches common compiler CLI patterns (non-zero exit on error)
- Golden tests can use `expect(() => compile(src)).toThrow()`

**Future evolution**: ~~Milestone B may introduce a result type with structured diagnostics~~ See ADR-0006 for the adopted `CompileResult<T>` pattern.

### 10. Extensibility for Milestone B

**Decision**: Design IR and transform architecture to accommodate future features without breaking changes.

**Extensibility points**:

1. **JobIR extension**: Add optional fields for matrix, outputs, env
   ```typescript
   interface JobIR {
     // ... existing fields
     readonly matrix?: MatrixIR;
     readonly outputs?: Record<string, string>;
     readonly env?: Record<string, string>;
   }
   ```

2. **StepIR extension**: Add additional step types
   ```typescript
   type StepIR = RunStepIR | UsesStepIR | CheckoutStepIR | UploadArtifactStepIR;
   ```

3. **Transform pipeline**: Design allows inserting transformation passes
   ```typescript
   // Future: AST -> IR -> CycleLoweredIR -> MatrixExpandedIR -> YAML
   ```

4. **Workflow-level additions**: Concurrency, permissions, defaults
   ```typescript
   interface WorkflowIR {
     // ... existing fields
     readonly concurrency?: ConcurrencyIR;
     readonly permissions?: PermissionsIR;
   }
   ```

**Rationale**:
- IR is additive: new fields don't break existing transform/emit code
- Transform can be decomposed into passes as complexity grows
- Emit handles unknown fields gracefully (ignores undefined optionals)

## Alternatives Considered

### Alternative 1: Direct AST-to-YAML Serialization

**Approach**: Skip IR; serialize AST nodes directly to YAML.

```typescript
function compileWorkflow(node: WorkflowNode): string {
  return stringify({
    name: node.name,
    on: serializeTrigger(node.trigger),
    jobs: Object.fromEntries(node.jobs.map(j => [j.name, serializeJob(j)])),
  });
}
```

**Pros**:
- Fewer layers, less code
- No IR type definitions to maintain

**Cons**:
- Mixes semantic logic (expression serialization) with formatting logic
- Harder to test: must parse YAML output to verify correctness
- Difficult to insert transformations (cycle lowering, matrix expansion)
- AST structure doesn't match YAML structure (e.g., AST has job list, YAML has job map)

**Decision**: Rejected. The IR layer provides clear separation and future extensibility.

### Alternative 2: Expression Serialization During Emit

**Approach**: Store expression AST nodes in IR; serialize to strings during emit.

```typescript
interface JobIR {
  condition?: ExpressionNode;  // AST node, not string
}
```

**Pros**:
- Preserves full expression structure in IR
- Could enable IR-level expression manipulation

**Cons**:
- Emit phase must understand expression semantics
- IR becomes coupled to AST types
- Expression manipulation is better done at AST level, before IR

**Decision**: Rejected. Transform phase is the right place for semantic operations like expression serialization.

### Alternative 3: YAML AST Instead of Plain Objects

**Approach**: Build `yaml` package's Document/Node AST explicitly.

```typescript
import { Document, YAMLMap, YAMLSeq } from "yaml";

function emit(ir: WorkflowIR): string {
  const doc = new Document();
  const root = new YAMLMap();
  root.add({ key: "name", value: ir.name });
  // ...
  return doc.toString();
}
```

**Pros**:
- Fine-grained control over YAML formatting
- Can add comments to specific nodes

**Cons**:
- Significantly more verbose
- Over-engineering for Milestone A requirements
- Plain objects with `stringify()` options achieve needed determinism

**Decision**: Rejected for Milestone A. May revisit if comment preservation or advanced formatting is needed.

### Alternative 4: Result Type Instead of Exceptions

**Approach**: Return a discriminated union instead of throwing.

```typescript
type CompileResult =
  | { ok: true; value: string }
  | { ok: false; errors: Diagnostic[] };

export function compile(source: string): CompileResult;
```

**Pros**:
- Explicit error handling
- Can return multiple diagnostics
- Aligns with functional programming patterns

**Cons**:
- More complex API for simple use cases
- Requires callers to handle result type
- Overkill for Milestone A's simple error cases

**Decision**: Deferred to Milestone B. Exceptions are sufficient for the current vertical slice.

### Alternative 5: No Trailing Newline

**Approach**: Emit YAML without trailing newline; let consumers add if needed.

**Pros**:
- Slightly smaller output
- Consumer controls final formatting

**Cons**:
- POSIX non-compliance
- Git complaints on every file
- Most text processing tools expect trailing newlines

**Decision**: Rejected. Trailing newline is industry standard for text files.

## Consequences

### Positive

1. **Clear separation of concerns**: Transform handles semantics; Emit handles formatting. Each layer is testable in isolation.

2. **Deterministic output**: Strict stringify options ensure identical input always produces identical output, enabling reliable golden tests and clean git diffs.

3. **Readable output**: Plain scalar style and preserved ordering produce YAML that matches hand-written conventions.

4. **Extensible architecture**: IR design accommodates matrix, artifacts, cycles, and other Milestone B features without breaking changes.

5. **Simple initial API**: Exception-based `compile()` function is easy to use in CLI and tests.

6. **POSIX compliance**: Trailing newline follows text file conventions.

### Negative

1. **Additional layer**: IR adds types and transformation code that wouldn't exist with direct AST-to-YAML approach.

2. **No comment preservation**: Users cannot add documentation comments to generated workflows.

3. **Exception-only errors**: Cannot return multiple diagnostics; must fail on first error.

4. **Expression quoting change**: Double quotes in source become single quotes in output, which may surprise users.

### Neutral

1. **Trigger format variance**: Output format differs based on event count (scalar vs. array), which is intentional for readability.

2. **IR mutability**: Choosing immutable IR types aligns with AST but requires creating new objects for transformations.

## References

- PROJECT.md Section 5: Language overview (workflow structure)
- PROJECT.md Section 11: Implementation concerns
- ADR-0001: Monorepo structure (`@workpipe/compiler` package)
- ADR-0003: Expression language design (expression AST node types)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [yaml package documentation](https://eemeli.org/yaml/)
- `examples/minimal/minimal.workpipe`: Target fixture for single-event trigger
- `examples/simple-job/simple-job.workpipe`: Target fixture for multi-job workflow with conditions
