# Implement Matrix Axes Syntax and Parsing

**ID**: WI-022
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: D (Matrices)
**Phase**: 6 (Matrices)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement the matrix syntax and parsing for WorkPipe. Matrix builds allow running the same job across multiple configurations (e.g., multiple Node.js versions, operating systems, or test shards). This is the foundational work item for Phase 6 (Matrices).

The syntax follows the pattern documented in `docs/language-reference.md` and the `examples/matrix-build/README.md`:

```workpipe
job test matrix {
  axes {
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
  }

  max_parallel = 4
  fail_fast = false

  runs_on: matrix.os
  steps: [
    uses("actions/setup-node@v4") {
      with: {
        node-version: matrix.node
      }
    },
    run("npm test")
  ]
}
```

## Acceptance Criteria

### Grammar Changes (packages/lang/src/workpipe.grammar)
- [x] Add `matrix` modifier to `JobDecl` production: `job <name> matrix { ... }`
- [x] Add `AxesBlock` production with axis declarations
- [x] Add `AxisDecl` production: `<name>: [<value>, <value>, ...]`
- [x] Support array values: numbers, strings, identifiers (like `ubuntu-latest`)
- [x] Add `MaxParallelProperty`: `max_parallel = <number>`
- [x] Add `FailFastProperty`: `fail_fast = <boolean>`
- [ ] Handle range syntax `[1..4]` for numeric sequences (stretch goal - deferred)

### AST Changes (packages/compiler/src/ast/types.ts)
- [x] Add `MatrixJobNode` type extending job properties with matrix config
- [x] Add `AxesConfig` interface with axis name -> values mapping
- [x] Add `MatrixConfig` interface with axes, maxParallel, failFast
- [x] Update `AnyJobNode` union to include `MatrixJobNode`

### AST Builder Changes (packages/compiler/src/ast/builder.ts)
- [x] Parse `JobDecl` with `matrix` modifier into `MatrixJobNode`
- [x] Extract axes declarations into `AxesConfig`
- [x] Handle mixed value types in axis arrays (numbers, strings, identifiers)
- [x] Extract `max_parallel` and `fail_fast` properties

### Codegen Support (packages/compiler/src/codegen/)
- [x] Transform MatrixJobNode to JobIR with strategy block
- [x] Emit strategy.matrix with axes configuration
- [x] Emit strategy.max-parallel and strategy.fail-fast when specified

### Tests
- [x] Grammar tests for matrix job syntax (packages/lang) - 21 new tests
- [x] AST tests for MatrixJobNode construction (packages/compiler)
- [x] Error recovery tests for malformed matrix blocks
- [x] Update `examples/matrix-build/` with working example file

## Deliverables Summary

**Completed 2025-12-31:**
- Extended grammar with MatrixModifier, AxesProperty, MaxParallelProperty, FailFastProperty
- Added MatrixJobNode to AST types
- Implemented AST builder for matrix jobs
- Added codegen support with strategy block generation
- 21 new tests (385 total - 71 lang + 314 compiler)

## Technical Context

### Current State
- The grammar (`packages/lang/src/workpipe.grammar`) has `JobDecl` but no matrix support
- AST types (`packages/compiler/src/ast/types.ts`) have `JobNode` and `AgentJobNode` but no matrix variant
- The language reference already documents the planned syntax
- Example placeholder exists at `examples/matrix-build/`

### Design Considerations

1. **Matrix Modifier Pattern**: Follow the `job <name> matrix { ... }` pattern, similar to how `agent_job` is a variant of `job`. The `matrix` keyword acts as a modifier.

2. **Axes Block**: The `axes { ... }` block contains axis declarations. Each axis has a name and an array of values.

3. **Value Types in Axes**: Axis values can be:
   - Numbers: `[18, 20, 22]`
   - Strings: `["ubuntu-latest", "macos-latest"]`
   - Bare identifiers (convenience for runner names): `[ubuntu-latest, macos-latest]`

4. **Matrix References**: Values like `matrix.os` and `matrix.node` are property access expressions that get special treatment in codegen (WI-023).

5. **Related GitHub Actions Output**:
```yaml
jobs:
  test:
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, macos-latest]
      max-parallel: 4
      fail-fast: false
    runs-on: ${{ matrix.os }}
```

### CLAUDE.md References
- Phase 6: Matrices (Phase overview)
- Milestone D: Matrices

### Files Modified
- `packages/lang/src/workpipe.grammar` - Grammar productions
- `packages/compiler/src/ast/types.ts` - Type definitions
- `packages/compiler/src/ast/builder.ts` - AST construction
- `packages/compiler/src/codegen/transform.ts` - Transform to IR
- `packages/compiler/src/codegen/emit.ts` - YAML emission
- `packages/lang/src/__tests__/parser.test.ts` - Grammar tests
- `packages/compiler/src/__tests__/ast.test.ts` - AST tests
- `examples/matrix-build/` - Example file and expected YAML

## Dependencies

- None (first item in Phase 6)

## Downstream Work Items

- WI-023: Generate strategy.matrix with include/exclude (depends on this)
- WI-024: Add matrix fingerprint to artifact naming (depends on WI-023)
- WI-025: Enforce 256-job matrix limit with diagnostics (depends on this)

## Notes

- The `include` and `exclude` syntax for matrix combinations is out of scope for this work item (covered in WI-023)
- Range syntax `[1..4]` is a stretch goal; deferred to future work item
- Semantic validation (e.g., verifying matrix.* references match declared axes) can be a separate work item
