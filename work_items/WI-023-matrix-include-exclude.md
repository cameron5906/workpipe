# Generate strategy.matrix with include/exclude

**ID**: WI-023
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: D (Matrices)
**Phase**: 6 (Matrices)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Extend the matrix job syntax and codegen to support `include` and `exclude` clauses. These allow users to:
- **include**: Add specific matrix combinations that may include extra variables not in the base axes
- **exclude**: Remove specific combinations from the Cartesian product

This builds directly on WI-022 which established the basic matrix axes syntax and parsing.

### GitHub Actions Reference

GitHub Actions supports this in `strategy.matrix`:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
    node: [18, 20]
    include:
      - os: ubuntu-latest
        node: 22
        experimental: true
    exclude:
      - os: macos-latest
        node: 18
```

### WorkPipe Syntax Design

```workpipe
job test matrix {
  axes {
    os: [ubuntu-latest, macos-latest]
    node: [18, 20]
  }

  include [
    { os: ubuntu-latest, node: 22, experimental: true }
  ]

  exclude [
    { os: macos-latest, node: 18 }
  ]

  runs_on: matrix.os
  steps: [...]
}
```

## Acceptance Criteria

### Grammar Changes (packages/lang/src/workpipe.grammar)
- [x] Add `IncludeProperty` production: `include [ { <key>: <value>, ... }, ... ]`
- [x] Add `ExcludeProperty` production: `exclude [ { <key>: <value>, ... }, ... ]`
- [x] Support object syntax in include/exclude arrays
- [x] Support mixed value types (strings, numbers, booleans) in include/exclude objects

### AST Changes (packages/compiler/src/ast/types.ts)
- [x] Add `include?: MatrixCombination[]` to `MatrixJobNode`
- [x] Add `exclude?: MatrixCombination[]` to `MatrixJobNode`
- [x] Define `MatrixCombination` type: `Record<string, string | number | boolean>`

### AST Builder Changes (packages/compiler/src/ast/builder.ts)
- [x] Parse `IncludeProperty` into `include` array
- [x] Parse `ExcludeProperty` into `exclude` array
- [x] Handle nested object parsing for matrix combinations

### IR Changes (packages/compiler/src/codegen/yaml-ir.ts)
- [x] Add `include?: MatrixCombination[]` to `MatrixStrategyIR`
- [x] Add `exclude?: MatrixCombination[]` to `MatrixStrategyIR`

### Codegen Changes (packages/compiler/src/codegen/transform.ts)
- [x] Transform `include` from AST to IR
- [x] Transform `exclude` from AST to IR

### Emitter Changes (packages/compiler/src/codegen/emit.ts)
- [x] Emit `include` array in strategy.matrix block
- [x] Emit `exclude` array in strategy.matrix block

### Tests
- [x] Grammar tests for include/exclude syntax
- [x] AST tests for MatrixJobNode with include/exclude
- [x] Codegen tests for strategy.matrix with include/exclude
- [x] Update or create example in `examples/matrix-build/`
- [x] Error recovery tests for malformed include/exclude

### Documentation
- [x] Update `docs/language-reference.md` Matrices section with include/exclude syntax

## Technical Context

### Current State (from WI-022)

The grammar already supports:
```workpipe
job test matrix {
  axes {
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
  }
  max_parallel = 4
  fail_fast = false
  runs_on: matrix.os
  steps: [...]
}
```

The AST `MatrixJobNode` has:
```typescript
export interface MatrixJobNode {
  readonly kind: "matrix_job";
  readonly name: string;
  readonly axes: Record<string, readonly (string | number)[]>;
  readonly maxParallel?: number;
  readonly failFast?: boolean;
  // ... other fields
}
```

The IR `MatrixStrategyIR` has:
```typescript
export interface MatrixStrategyIR {
  readonly matrix: Record<string, readonly (string | number)[]>;
  readonly "max-parallel"?: number;
  readonly "fail-fast"?: boolean;
}
```

### Design Decisions

1. **Array of Objects Syntax**: The `include` and `exclude` properties take arrays of objects. Each object specifies key-value pairs that identify a matrix combination.

2. **Include Semantics**: Objects in `include` can:
   - Add new combinations to the matrix
   - Add extra variables to existing combinations (matched by existing axis values)

3. **Exclude Semantics**: Objects in `exclude` remove matching combinations from the Cartesian product.

4. **Value Types**: Values in include/exclude objects can be strings, numbers, or booleans.

### Files to Modify

1. `packages/lang/src/workpipe.grammar` - Add IncludeProperty, ExcludeProperty productions
2. `packages/compiler/src/ast/types.ts` - Extend MatrixJobNode
3. `packages/compiler/src/ast/builder.ts` - Parse include/exclude
4. `packages/compiler/src/codegen/yaml-ir.ts` - Extend MatrixStrategyIR
5. `packages/compiler/src/codegen/transform.ts` - Transform include/exclude
6. `packages/compiler/src/codegen/emit.ts` - Emit include/exclude
7. `packages/lang/src/__tests__/parser.test.ts` - Grammar tests
8. `packages/compiler/src/__tests__/ast.test.ts` - AST tests
9. `packages/compiler/src/__tests__/codegen.test.ts` - Codegen tests
10. `docs/language-reference.md` - Documentation update

### CLAUDE.md References
- Phase 6: Matrices (axes, include/exclude)
- Milestone D: Matrices
- Section 8.2: generate GitHub's `strategy.matrix` with `include`/`exclude` as needed

## Dependencies

- **WI-022**: Implement matrix axes syntax and parsing - COMPLETED

## Downstream Work Items

- **WI-024**: Add matrix fingerprint to artifact naming (can proceed in parallel)
- **WI-025**: Enforce 256-job matrix limit with diagnostics (can proceed in parallel)

## Notes

- The syntax `include [{ ... }]` uses square brackets for arrays and curly braces for objects
- This follows the existing WorkPipe pattern for array properties
- Semantic validation (e.g., warning about exclude patterns that don't match any combinations) could be a future enhancement
