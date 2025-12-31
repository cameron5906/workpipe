# WI-046: Type System for Task/Job Data Flow

**ID**: WI-046
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: C+ (Future Enhancement)
**Phase**: 3+ (Types + Outputs - Extension)
**Created**: 2025-12-30
**Updated**: 2025-12-30

## Description

Introduce type declarations to the WorkPipe DSL to enable type safety when passing data between tasks and jobs. This would catch type mismatches at compile time rather than at runtime in GitHub Actions.

**User Feedback:**
> "This is such a cool concept, but I feel like it's lacking in some areas. Why not add type declaration so we can have type safety for passing stuff back and forth between tasks/jobs?"

Currently, WorkPipe compiles to GitHub Actions YAML where data flows between jobs via:
- Job outputs (strings)
- Artifacts (files)
- workflow_dispatch inputs

All of these are essentially untyped strings at the GitHub Actions level. Adding a type system would:
1. Validate that outputs match expected types at compile time
2. Ensure consumers of outputs expect the correct types
3. Provide better editor autocompletion and documentation
4. Catch errors before workflows run

## Acceptance Criteria

- [ ] Type declarations can be defined for job outputs
- [ ] Type declarations can be defined for workflow inputs
- [ ] Type declarations can be defined for artifact schemas
- [ ] Compiler validates type compatibility between producers and consumers
- [ ] Type mismatches produce clear diagnostic errors with suggestions
- [ ] Basic types supported: string, number, boolean, json (structured data)
- [ ] Optional: Array and object types with schemas
- [ ] Documentation covers type system usage
- [ ] Tests verify type checking scenarios

## Deliverables Checklist

### Design Phase
- [ ] ADR documenting type system design decisions
- [ ] Syntax proposal for type annotations (multiple options to evaluate)
- [ ] Mapping strategy: how types translate to GitHub Actions (always strings)
- [ ] Scope decision: job outputs, inputs, artifacts, or all three

### Grammar Extensions
- [ ] Type annotation syntax in Lezer grammar
- [ ] Type declaration blocks or inline annotations
- [ ] Generic/parameterized types (if supporting arrays/objects)

### AST Extensions
- [ ] TypeAnnotation AST node
- [ ] TypeDeclaration AST node (for named types)
- [ ] Extend OutputNode, InputNode with optional type

### Semantic Analysis
- [ ] Type inference pass (where types can be inferred)
- [ ] Type checking pass (validate compatibility)
- [ ] Diagnostic codes for type errors (WP8xxx range)
- [ ] Type coercion rules (string to number, etc.)

### Editor Support
- [ ] Type information in hover tooltips
- [ ] Autocompletion for typed outputs
- [ ] Type error squiggles in VS Code

## Syntax Proposals

### Option A: Inline Type Annotations
```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
    build_number: number
    success: boolean
    metadata: json
  }
  steps: [...]
}

job deploy {
  needs: [build]
  steps: [
    run("deploy version ${needs.build.outputs.version}")  // type-checked
  ]
}
```

### Option B: Separate Type Declarations
```workpipe
type BuildOutput {
  version: string
  build_number: number
}

job build {
  runs_on: ubuntu-latest
  outputs: BuildOutput
  steps: [...]
}
```

### Option C: Schema References (for artifacts)
```workpipe
schema ResultSchema {
  score: number
  passed: boolean
  details: string
}

job analyze {
  runs_on: ubuntu-latest
  emits: result(ResultSchema)  // typed artifact
}
```

## Technical Context

### Current State
- Phase 3 (Types + Outputs) is marked PARTIAL in the backlog
- WI-012, WI-013, WI-014 cover type-related work but are not started
- The compiler currently passes through expressions without type checking
- GitHub Actions fundamentally uses strings; type safety is a compile-time concern

### GitHub Actions Constraints
All job outputs and inputs in GitHub Actions are strings. Type safety means:
- Compiler validates types at compile time
- Generated YAML may include runtime validation (optional)
- Types are documentation/contracts, not runtime enforcement

### Related Work Items
- WI-012: Implement type system primitives (not started)
- WI-013: Handle workflow_dispatch inputs with type preservation (not started)
- WI-014: Generate job outputs and step outputs (not started)

## Dependencies

- WI-012: Type system primitives should be completed first or merged into this
- Core parser/AST infrastructure (complete)
- Diagnostic system (complete)

## Notes

- This is a significant feature requiring careful design
- Start with simple types (string, number, boolean) before complex schemas
- Consider incremental rollout: outputs first, then inputs, then artifacts
- Type inference could reduce annotation burden
- This could enable future features like IDE autocompletion for `needs.*.outputs.*`
- Consider compatibility with JSON Schema for artifact typing
