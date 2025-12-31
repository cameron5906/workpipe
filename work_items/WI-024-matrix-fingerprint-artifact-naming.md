# Add Matrix Fingerprint to Artifact Naming

**ID**: WI-024
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: D (Matrices)
**Phase**: 6 (Matrices)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

When a matrix job produces artifacts, each matrix combination must upload to a unique artifact name. Otherwise, GitHub Actions' immutable artifact v4 semantics cause collisions when multiple matrix instances try to upload artifacts with the same name.

This work item adds a **matrix fingerprint** to artifact names for matrix jobs. The fingerprint is a hash or concatenation of the matrix axis values, ensuring unique artifact names per combination.

### Problem Statement

Currently, if a matrix job contains:
```workpipe
job test matrix {
  axes {
    os: [ubuntu-latest, macos-latest]
    node: [18, 20]
  }
  emits test_results: json
  // ...
}
```

All 4 matrix combinations would try to upload to the same artifact name `test_results`, causing failures.

### Solution

Inject a matrix fingerprint into artifact names:
- `test_results-ubuntu-latest-18`
- `test_results-macos-latest-20`
- etc.

The fingerprint can use GitHub Actions expressions like:
```yaml
name: test_results-${{ matrix.os }}-${{ matrix.node }}
```

Or a hash for cleaner names when axes are many:
```yaml
name: test_results-${{ hashFiles(toJSON(matrix)) }}
```

### Design Decision

Use **deterministic concatenation** of axis values in sorted key order:
- Simple, readable artifact names
- Easy to correlate with matrix combinations
- No hash ambiguity
- GitHub Actions expression: `${{ join(matrix.*, '-') }}` doesn't work directly; we need explicit axis references

## Acceptance Criteria

### Analysis (Pre-Implementation)
- [x] Review existing artifact naming in `transform.ts` (UploadArtifactStepIR, cycle artifacts)
- [x] Identify where matrix jobs emit artifacts (emits/consumes syntax vs agent task outputArtifact)
- [x] Determine if artifact syntax is already implemented or only in cycle context

### Grammar/AST Changes (if needed)
- [x] Verify `emits`/`consumes` syntax is parsed for matrix jobs
- [x] Confirm MatrixJobNode can carry artifact declarations

### Transform Changes (packages/compiler/src/codegen/transform.ts)
- [x] Create `generateMatrixFingerprint()` helper function
- [x] For matrix jobs with artifacts, append fingerprint to artifact names
- [x] Handle both `emits` artifacts and `outputArtifact` from agent tasks

### IR/Emit Changes (if needed)
- [x] Ensure artifact names with expressions render correctly in YAML

### Consumer Side (Cross-Job Download)
- [x] When a non-matrix job consumes from a matrix job, determine strategy:
  - Option A: Download all artifacts matching pattern (requires `download-artifact@v4` pattern matching)
  - Option B: Require explicit matrix combination reference in consumes
  - Option C: Generate multiple download steps
- [x] Document the chosen approach

### Tests
- [x] Unit test for `generateMatrixFingerprint()` function
- [x] Codegen test: matrix job with `emits` produces fingerprinted artifact names
- [x] Codegen test: agent task in matrix job with `outputArtifact` produces fingerprinted names
- [x] Golden test: Update or create example demonstrating matrix artifacts

### Documentation
- [x] Update `docs/language-reference.md` Artifacts section with matrix artifact naming
- [x] Add example showing matrix job with artifacts

## Technical Context

### Current Artifact Implementation

From `transform.ts`, artifacts are currently implemented in:
1. **Cycle state artifacts**: `${cycleName}-state` - single artifact per cycle
2. **Agent task outputArtifact**: `task.outputArtifact` - direct name from DSL

Neither currently handles matrix job context.

### Matrix Context Access

In GitHub Actions, matrix values are accessed via `${{ matrix.<axis> }}`. For a job like:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
    node: [18, 20]
```

The artifact name expression would be:
```yaml
name: artifact-${{ matrix.os }}-${{ matrix.node }}
```

### Files to Modify

1. `packages/compiler/src/codegen/transform.ts` - Add fingerprint generation
2. `packages/compiler/src/codegen/yaml-ir.ts` - Potentially extend UploadArtifactStepIR if needed
3. `packages/compiler/src/codegen/emit.ts` - Handle expression-containing artifact names
4. `packages/compiler/src/__tests__/codegen.test.ts` - Add tests
5. `docs/language-reference.md` - Document matrix artifact naming

### CLAUDE.md References

- Phase 6: Matrices
- Section 8.2: Matrix fingerprint for artifact uniqueness
- Milestone D: Matrices with full artifact support

## Dependencies

- **WI-022**: Implement matrix axes syntax and parsing - COMPLETED
- **WI-023**: Generate strategy.matrix with include/exclude - COMPLETED
- **WI-025**: Enforce 256-job matrix limit with diagnostics - COMPLETED

## Downstream Work Items

None identified. This completes core matrix artifact support.

## Completion Notes

**Completed 2025-12-31**

### Deliverables
- Created `generateMatrixFingerprint()` helper function in `transform.ts`
- Modified `transformMatrixJob` to pass `MatrixContext` through step transformation
- Artifact names in matrix jobs now include `${{ matrix.X }}-${{ matrix.Y }}` suffix
- 7 new tests added (509 total tests passing)

### Implementation Details
- Matrix fingerprint is generated by concatenating sorted axis names as GitHub Actions expressions
- Example: For axes `{os: [...], node: [...]}`, fingerprint is `${{ matrix.node }}-${{ matrix.os }}`
- Artifact names become: `artifact-name-${{ matrix.node }}-${{ matrix.os }}`
- This ensures unique artifact names per matrix combination, avoiding v4 artifact collisions

## Notes

- The `emits`/`consumes` syntax may not be fully implemented outside cycles. Need to verify scope.
- If general artifact syntax isn't ready, this work item may need scoping to agent task `outputArtifact` only.
- The consumer side (downloading from matrix job) is complex and may warrant a separate work item if scope grows.
