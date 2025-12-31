# WI-046: Type System for Task/Job Data Flow (Phase 1: Job Outputs)

**ID**: WI-046
**Status**: Completed
**Priority**: P1-High
**Milestone**: C+ (Future Enhancement)
**Phase**: 3+ (Types + Outputs - Extension)
**Created**: 2025-12-30
**Updated**: 2025-12-31 (Completed)
**Unblocked**: WI-052 completed - documentation gap resolved

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

**Phase 1 Scope:** Job outputs with type annotations (completed core implementation)

## Acceptance Criteria

### Phase 1: Job Outputs (Current Focus)
- [x] Type declarations can be defined for job outputs
- [x] Compiler validates duplicate output names (WP2010)
- [x] Basic types supported: string, number, boolean, json (structured data)
- [x] Tests verify output scenarios (27 new tests, 367 total passing)
- [x] ADR documenting design decisions (ADR-0010)
- [x] Documentation covers type system usage (language-reference.md)
- [x] Error code documentation (errors.md with WP2010)
- [x] End-user acceptance review (new DSL syntax requires review)

**COMPLETE:** WI-052 resolved documentation gap (how to SET outputs)

### Future Phases (Not Yet Started)
- [ ] Type declarations can be defined for workflow inputs
- [ ] Type declarations can be defined for artifact schemas
- [ ] Compiler validates type compatibility between producers and consumers
- [ ] Type mismatches produce clear diagnostic errors with suggestions
- [ ] Optional: Array and object types with schemas

## Deliverables Checklist

### Design Phase
- [x] ADR documenting type system design decisions (ADR-0010)
- [x] Syntax proposal for type annotations (Option A: inline annotations selected)
- [x] Mapping strategy: how types translate to GitHub Actions (always strings)
- [x] Scope decision: job outputs first, then inputs, then artifacts

### Grammar Extensions
- [x] Type annotation syntax in Lezer grammar (outputs block with typed fields)
- [x] OutputDeclaration and OutputType grammar rules
- [ ] Generic/parameterized types (if supporting arrays/objects) - future

### AST Extensions
- [x] OutputDeclaration AST node
- [x] OutputType enum (string, number, boolean, json)
- [x] Extend JobNode and AgentJobNode with outputs property

### Semantic Analysis
- [x] WP2010 diagnostic for duplicate output names
- [ ] Type inference pass (where types can be inferred) - future
- [ ] Type checking pass (validate compatibility) - future
- [ ] Additional diagnostic codes for type errors - future
- [ ] Type coercion rules (string to number, etc.) - future

### Code Generation
- [x] Emit outputs in generated YAML workflow files
- [x] Outputs block maps to GitHub Actions job outputs

### Documentation
- [x] Update language-reference.md with outputs syntax
- [x] Update errors.md with WP2010 diagnostic code
- [x] End-user acceptance review for new syntax

### Editor Support
- [ ] Type information in hover tooltips - future
- [ ] Autocompletion for typed outputs - future
- [ ] Type error squiggles in VS Code - future (WP2010 already works)

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

## End-User Acceptance Review Findings (2025-12-31)

### P1-Critical (Blocks completion)
- **Documentation gap**: Explains how to DECLARE outputs but not how to SET them
- Users don't know they need `echo "name=value" >> $GITHUB_OUTPUT`
- **Resolution**: WI-052 created to fix documentation

### P2-High (New work items created)
- No example files demonstrate outputs feature -> WI-053
- No validation for referencing non-existent outputs (WP2011) -> WI-054

### P3-Medium (Future consideration)
- Type semantics not fully explained (what does `int` mean at runtime?)
- ADR-0010 missing `path` type (listed in language-reference.md but not in ADR)
- Consider adding these to documentation in WI-052 or future enhancement
