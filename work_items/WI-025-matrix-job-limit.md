# Enforce 256-Job Matrix Limit with Diagnostics

**ID**: WI-025
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: D (Matrices)
**Phase**: 6 (Matrices)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

GitHub Actions enforces a 256-job maximum for matrix expansions per workflow run. WorkPipe should validate matrix configurations at compile time and emit helpful diagnostics when the limit is exceeded or approached.

This work item implements:
1. **WP4001 (Error)**: Matrix expansion exceeds 256-job limit
2. **WP4002 (Warning)**: Matrix expansion is large (approaching limit, e.g., > 200 jobs)

The validation must calculate the total job count by:
- Computing the Cartesian product of all axes
- Adding `include` combinations that add new jobs
- Subtracting `exclude` combinations that remove jobs

### Example Cases

```workpipe
# This produces 3 * 3 * 3 = 27 jobs (OK)
job test matrix {
  axes {
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [18, 20, 22]
    browser: [chrome, firefox, safari]
  }
  runs_on: matrix.os
  steps: [run("npm test")]
}

# This produces 10 * 10 * 10 = 1000 jobs (ERROR: exceeds 256)
job test matrix {
  axes {
    a: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    c: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  }
  runs_on: ubuntu-latest
  steps: [run("echo test")]
}
```

## Acceptance Criteria

### Diagnostic Implementation (packages/compiler/src/semantics/)
- [x] Create `matrix-validation.ts` with `validateMatrixJobs(workflow: WorkflowNode): Diagnostic[]`
- [x] Calculate Cartesian product size: product of axis array lengths
- [x] Add jobs from `include` that add new combinations (axis value not in base matrix)
- [x] Subtract jobs from `exclude` that remove existing combinations
- [x] Emit WP4001 (error) when total > 256
- [x] Emit WP4002 (warning) when total > 200 (configurable threshold)
- [x] Include calculated job count in diagnostic message
- [x] Provide hint with formula: "Matrix produces {N} jobs ({axis1} x {axis2} = {N})"

### Error Code Documentation (docs/errors.md)
- [x] Add WP4xxx - Matrix Validation section header
- [x] Document WP4001: Matrix exceeds 256-job limit
- [x] Document WP4002: Matrix job count is large (warning)

### Integration (packages/compiler/src/index.ts)
- [x] Add `validateMatrixJobs` to semantic validation pipeline
- [x] Ensure diagnostics surface via compile() result

### Tests (packages/compiler/src/__tests__/)
- [x] Create `matrix-validation.test.ts`
- [x] Test: 3x3 axes = 9 jobs (no diagnostic)
- [x] Test: 10x10x10 axes = 1000 jobs (WP4001 error)
- [x] Test: 16x16 axes = 256 jobs (exactly at limit, no error)
- [x] Test: 17x16 axes = 272 jobs (exceeds limit, WP4001)
- [x] Test: 15x15 axes = 225 jobs (WP4002 warning for large matrix)
- [x] Test: include adds jobs to count
- [x] Test: exclude subtracts jobs from count
- [x] Test: diagnostic message includes calculated count
- [x] Test: multiple matrix jobs validated independently
- [x] Test: non-matrix jobs ignored (no false positives)

## Technical Context

### Current State
- Matrix job parsing and codegen complete (WI-022, WI-023)
- Semantic validation infrastructure exists in `packages/compiler/src/semantics/`
- Pattern to follow: `cycle-validation.ts`, `required-fields.ts`, `output-validation.ts`
- Diagnostic types in `packages/compiler/src/diagnostic/types.ts`
- Error code range WP4xxx is unused (available for matrix validation)

### GitHub Actions Limit Reference
- GitHub Actions hard limit: 256 jobs per matrix strategy
- Workflows with larger matrices fail at runtime with unclear errors
- Catching this at compile time provides better developer experience

### Matrix Job Count Calculation

```
baseCount = product(axis.length for each axis)
includeAdditions = count of include entries that add NEW combinations
excludeRemovals = count of exclude entries that match existing combinations
finalCount = baseCount + includeAdditions - excludeRemovals
```

Note: An `include` entry that only adds extra properties to existing combinations does NOT increase job count. Only `include` entries with axis values not in the Cartesian product add new jobs.

### Files to Create/Modify

1. **Create**: `packages/compiler/src/semantics/matrix-validation.ts`
   - `calculateMatrixJobCount(job: MatrixJobNode): number`
   - `validateMatrixJobs(workflow: WorkflowNode): Diagnostic[]`

2. **Modify**: `packages/compiler/src/semantics/index.ts`
   - Export new validation function

3. **Modify**: `packages/compiler/src/index.ts`
   - Add matrix validation to semantic pipeline

4. **Modify**: `docs/errors.md`
   - Add WP4xxx section

5. **Create**: `packages/compiler/src/__tests__/matrix-validation.test.ts`
   - Comprehensive test coverage

### CLAUDE.md References
- PROJECT.md Section 8.2: "enforce job-count limits and warn on 'too large' expansions"
- Phase 6: Matrices
- Milestone D: Matrices
- Error code pattern: WP{category}{number} (WP4xxx for matrix validation)

## Dependencies

- **WI-022**: Matrix axes syntax and parsing - COMPLETED
- **WI-023**: Include/exclude support - COMPLETED

## Downstream Work Items

- None (this completes the Matrix validation chain)

## Notes

- The 200-job warning threshold is a reasonable default but could be made configurable in future
- Consider that users may have valid use cases for large matrices, so warning is appropriate over error for the "approaching limit" case
- The diagnostic should help users understand the math: show the expansion formula
- Future enhancement: suggest using `max_parallel` to limit concurrent jobs even with large matrices
