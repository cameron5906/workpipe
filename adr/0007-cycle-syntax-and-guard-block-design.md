# ADR-0007: Cycle Syntax and Guard Block Design

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WI-030 introduces cycle support to WorkPipe, enabling iterative workflows that span multiple GitHub Actions runs. This is a key differentiator for WorkPipe, as GitHub Actions job graphs must be acyclic - cycles are impossible to express in native GHA YAML.

WorkPipe's Strategy B compilation model (documented in PROJECT.md Section 10) transforms cycle blocks into phased workflow execution via `workflow_dispatch` self-dispatch. Each workflow run equals one iteration; at the end of each iteration, the workflow dispatches itself with updated loop state until a termination condition is met.

This ADR establishes the syntax and AST design for cycles. The actual lowering to phased workflows is covered by subsequent work items (WI-031 through WI-037).

**Key design tensions to resolve:**

1. **Syntax structure**: How to visually distinguish cycle configuration from cycle body (jobs)?
2. **Property syntax**: Use `:` (like job properties) or `=` (like assignments) for configuration?
3. **Guard blocks**: How to handle embedded JavaScript for termination predicates?
4. **Safety rails**: What compile-time guarantees prevent infinite loops?
5. **Nesting**: Can cycles contain cycles?
6. **String handling**: How to capture multi-line guard code?

## Decision

### 1. Cycle Block Structure

**Decision**: Cycles use a two-part structure separating configuration from body.

```workpipe
cycle refine {
  // Configuration section (properties)
  max_iters = 10
  key = "refinement-${github.run_id}"

  until guard_js """
    return state.quality_score > 0.95;
  """

  // Body section (jobs to execute per iteration)
  body {
    job analyze { ... }
    agent_job improve { ... }
    job evaluate { ... }
  }
}
```

**Structure rules:**
- Configuration properties appear before the `body` block
- The `body` block is required and must contain at least one job
- Jobs inside `body` follow the same syntax as top-level jobs
- Cycles appear at workflow level alongside top-level jobs

**Rationale:**
- Clear visual separation between "how the cycle runs" (config) and "what the cycle does" (body)
- The `body` keyword makes parsing unambiguous
- Mirrors common patterns in other DSLs (e.g., Terraform's `dynamic` blocks)

### 2. Assignment Syntax for Cycle Configuration

**Decision**: Use `=` for cycle configuration properties, not `:`.

```workpipe
// Cycle configuration uses =
cycle loop {
  max_iters = 10
  key = "loop-key"
}

// Job properties use :
job build {
  runs_on: ubuntu-latest
  needs: setup
}
```

**Rationale:**
- Visual distinction between "configuration/settings" (`=`) and "structural properties" (`:`)
- Cycle properties are values being assigned, not structural declarations
- Reduces ambiguity when reading mixed workflow/cycle code
- Aligns with configuration patterns in other tools (e.g., Terraform, HCL)

**Consistency note:** This creates two property syntaxes in the language. The trade-off is worthwhile because:
- Cycles are a distinct construct (multi-run iteration) with distinct semantics
- The visual break helps readers understand they're in a different context
- Future configuration blocks (if any) can follow the same `=` pattern

### 3. Guard JS as Opaque Triple-Quoted String

**Decision**: Treat `guard_js """..."""` content as an opaque string, consistent with ADR-0003 Section 4.

```workpipe
until guard_js """
  // This JavaScript is captured verbatim
  const score = state.outputs.quality_score;
  return score > 0.95 || state.iteration > 5;
"""
```

**Grammar representation:**
```lezer
UntilProperty {
  kw<"until"> GuardJs
}

GuardJs {
  kw<"guard_js"> TripleQuotedString
}

TripleQuotedString {
  tripleString
}
```

**AST representation:**
```typescript
export interface GuardJsNode {
  readonly kind: "guard_js";
  readonly code: string;  // Raw content, verbatim
  readonly span: Span;
}
```

**Rationale** (from ADR-0003):
- JavaScript is a complex language; embedding a JS parser adds significant complexity
- Guard scripts are executed at runtime by Node.js, not by the WorkPipe compiler
- The compiler's responsibility is to correctly delimit the block and emit it into generated YAML
- Runtime errors in guard JS surface at GitHub Actions execution time

**Constraints:**
- Guard blocks must use triple-quoted strings (single-line guards are error-prone)
- Content is emitted as-is into generated workflow YAML
- The semantic phase may perform basic validation (e.g., checking for `return` statement)

### 4. Safety Rail: Require max_iters or until

**Decision**: Every cycle must define `max_iters`, `until`, or both. Missing both is a compile-time error.

**Error code**: `WP6001`

**Diagnostic message:**
```
error[WP6001]: cycle has no termination condition

   12 | cycle infinite {
      | ^^^^^^^^^^^^^^ this cycle may run forever

hint: Add `max_iters = N` for a hard iteration limit,
      or `until guard_js """..."""` for a convergence condition.
      Both can be specified for defense in depth.
```

**Validation logic:**
```typescript
if (cycle.maxIters === null && cycle.until === null) {
  emit(WP6001, cycle.span, "cycle has no termination condition");
}
```

**Rationale:**
- Prevents "CI infinity machine" scenarios (PROJECT.md Section 10.3)
- Defense in depth: `max_iters` as hard stop, `until` as convergence check
- Explicit termination makes cycle behavior predictable and auditable
- Aligns with safety-first design philosophy

**Recommended pattern:**
```workpipe
cycle refine {
  max_iters = 10                    // Hard stop (always)
  until guard_js """                // Early exit (when converged)
    return state.quality > 0.95;
  """
  body { ... }
}
```

### 5. Key Property: Optional with Warning

**Decision**: The `key` property is optional. If omitted, the compiler emits a warning and derives a default.

**Warning code**: `WP4001`

**Default derivation**: `${workflow_name}-${cycle_name}`

**Diagnostic message:**
```
warning[WP4001]: cycle has no explicit key

   12 | cycle refine {
      |       ^^^^^^ no key specified

hint: Add `key = "..."` to control concurrency grouping.
      Defaulting to "my_workflow-refine".
```

**Rationale:**
- The key controls GitHub Actions concurrency grouping, preventing overlapping runs
- Explicit keys are preferred for predictable behavior
- A warning (not error) allows quick prototyping while encouraging best practices
- The derived default is deterministic and usually sufficient

**Usage of key in lowering:**
```yaml
concurrency:
  group: ${{ inputs.wp_cycle_key }}
  cancel-in-progress: false
```

### 6. Nested Cycles: Explicitly Disallowed

**Decision**: Cycles cannot contain other cycles. This is a compile-time error.

**Error code**: `WP6002`

**Diagnostic message:**
```
error[WP6002]: nested cycles are not supported

   15 |     cycle inner {
      |     ^^^^^^^^^^^ cycle cannot be nested inside another cycle

   12 | cycle outer {
      | ------------ outer cycle defined here

hint: Flatten the iteration structure or use separate workflows.
```

**Grammar enforcement:**
The `BodyBlock` rule only allows `JobDecl` and `AgentJobDecl`, not `CycleDecl`:
```lezer
BodyBlock {
  kw<"body"> "{" (JobDecl | AgentJobDecl)* "}"
}
```

**Rationale:**
- Nested cycles would require complex multi-dimensional state tracking
- The Strategy B lowering model assumes a single iteration dimension
- Use cases for nested cycles can be addressed with:
  - Sequential cycles at workflow level
  - Separate workflows with dispatch chains
  - Matrix jobs within a cycle (future enhancement)
- Explicit prohibition prevents confusing error cascades

### 7. Triple-Quoted Strings: Raw Capture, Deferred Dedent

**Decision**: Triple-quoted strings capture content verbatim in the AST. Dedentation (stripping common leading whitespace) is deferred to the semantic phase or code generation.

**Token definition:**
```lezer
@tokens {
  tripleString { '"""' tripleStringContent* '"""' }
  tripleStringContent { !["] | '"' !["] | '""' !["] }
}
```

**AST storage:**
```typescript
// GuardJsNode stores raw content including leading whitespace
{
  kind: "guard_js",
  code: "\n  const score = state.quality;\n  return score > 0.95;\n",
  span: { start: 150, end: 220 }
}
```

**Rationale:**
- Preserves source fidelity for error reporting and formatting
- Allows different consumers (codegen, formatter) to apply different transformations
- Matches ADR-0003's approach for other string blocks
- Dedent logic is straightforward to apply later if needed

**Dedent algorithm (for codegen):**
1. Split content by newlines
2. Find minimum non-zero leading whitespace across non-empty lines
3. Strip that amount from each line
4. Join with newlines

## Alternatives Considered

### Alternative 1: Inline Cycle Syntax

**Approach**: Express cycles as job modifiers rather than separate blocks.

```workpipe
job refine iterates(max: 10, until: "state.done") {
  steps: [ ... ]
}
```

**Pros:**
- Fewer new constructs
- Compact for simple cases

**Cons:**
- Unclear how to express multi-job iteration
- Mixing iteration semantics with job definition
- Hard to visually parse iteration configuration
- Unclear boundaries when jobs have dependencies

**Decision**: Rejected. Separate `cycle` blocks provide clearer boundaries and support multi-job iteration naturally.

### Alternative 2: Implicit Iteration Detection

**Approach**: Detect cycles automatically via dependency graph analysis (SCC detection) without explicit `cycle` blocks.

```workpipe
// No cycle keyword - compiler detects A->B->C->A cycle
job A { needs: C; ... }
job B { needs: A; ... }
job C { needs: B; ... }
```

**Pros:**
- No new syntax needed
- "Just works" for existing mental models

**Cons:**
- Implicit behavior is harder to reason about
- No clear place to specify termination conditions
- Unclear which jobs are "in" vs "out" of the cycle
- Error messages for cycle issues become cryptic
- Violates "explicit is safer" principle

**Decision**: Rejected. Explicit `cycle` blocks make iteration boundaries and termination conditions clear.

### Alternative 3: Separate Workflow Files Per Phase

**Approach**: Instead of cycle blocks, require users to write separate workflow files for each phase.

```
workflows/
  refine-phase-0.workpipe   # Bootstrap
  refine-phase-n.workpipe   # Iteration
  refine-finalize.workpipe  # Completion
```

**Pros:**
- Each file is simple and self-contained
- No new syntax needed
- Maximum flexibility

**Cons:**
- Poor developer experience (DX)
- Duplication of job definitions across files
- Manual coordination of dispatch logic
- Hard to see the overall flow
- Defeats the purpose of WorkPipe's abstractions

**Decision**: Rejected. Single-file cycle definition with automatic lowering is the core value proposition.

### Alternative 4: Use `:` Instead of `=` for Cycle Properties

**Approach**: Keep consistent `:` syntax for all properties.

```workpipe
cycle refine {
  max_iters: 10
  key: "refine-key"
  body {
    job analyze { runs_on: ubuntu-latest }
  }
}
```

**Pros:**
- Syntactic consistency
- One fewer token to learn

**Cons:**
- Harder to visually distinguish configuration from structure
- Cycle configuration has different semantics than job properties
- Mixed code becomes harder to scan
- Missed opportunity for semantic signaling

**Decision**: Rejected. The visual distinction of `=` for configuration aids readability and signals different semantics.

## Consequences

### Positive

1. **Clear iteration boundaries**: Explicit `cycle` blocks make it obvious which jobs iterate together and where configuration lives.

2. **Safety by default**: Mandatory termination conditions (WP6001) prevent runaway CI costs and infinite loops.

3. **Readable syntax**: The `=` vs `:` distinction helps readers quickly identify configuration vs. structure.

4. **IDE support enabled**: Structured AST for cycles enables go-to-definition, hover, and completion for cycle names and references.

5. **Future-proof grammar**: The `body {}` structure allows future additions (e.g., `init {}`, `finally {}` blocks) without breaking changes.

6. **Predictable behavior**: Explicit `key` warnings (WP4001) encourage concurrency group configuration for reliable execution.

### Negative

1. **Two property syntaxes**: Having both `=` and `:` adds learning overhead, though the semantic distinction justifies it.

2. **No nested cycles**: Some complex iteration patterns require workarounds (sequential cycles, separate workflows).

3. **Guard JS runtime errors**: Opaque JavaScript means errors only surface at GitHub Actions runtime, not compile time.

4. **Verbose for simple cases**: A single-job cycle still requires full `cycle { body { job {} } }` structure.

### Neutral

1. **New error codes**: WP6001 and WP6002 join the diagnostic system (WP6xxx category for cycles).

2. **Grammar complexity**: Adding cycles increases grammar size but follows established patterns.

3. **AST growth**: Three new node types (`CycleNode`, `CycleBodyNode`, `GuardJsNode`) are manageable additions.

## References

- PROJECT.md Section 10: Cycles (Strategy B) - canonical specification
- ADR-0003: Lezer Grammar Design - guard JS treatment, reserved keywords
- ADR-0006: Diagnostic System - error code conventions (WP6xxx for cycles)
- [ADR-0008: Strategy B Cycle Lowering and Phased Execution](0008-strategy-b-cycle-lowering-and-phased-execution.md) - Lowering implementation (extends this ADR)
- WI-030: Implement Cycle Syntax and AST - implementation work item
- WI-032 (combined): Cycle Codegen - implementation work item for lowering
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)
- [GitHub Actions workflow_dispatch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch)
