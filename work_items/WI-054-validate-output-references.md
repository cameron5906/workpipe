# WI-054: Validate Output References (WP2011)

**ID**: WI-054
**Status**: Backlog
**Priority**: P2-High
**Milestone**: C+ (Type System)
**Phase**: 3+ (Types + Outputs)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

End-user acceptance review for WI-046 identified that there's no validation when referencing non-existent outputs. Users can write `needs.build.outputs.foo` where `foo` was never declared, and the compiler silently generates invalid YAML.

This work item adds semantic validation to detect references to undeclared outputs.

## Acceptance Criteria

- [ ] WP2011 diagnostic code for referencing non-existent output
- [ ] Compiler detects `needs.<job>.outputs.<name>` references
- [ ] Compiler validates `<name>` exists in the referenced job's outputs
- [ ] Clear error message with:
  - The invalid reference
  - The job being referenced
  - Available outputs on that job (if any)
- [ ] Tests for valid and invalid output references
- [ ] errors.md updated with WP2011 documentation

## Deliverables Checklist

### Semantic Analysis
- [ ] Parse expressions to identify `needs.*.outputs.*` patterns
- [ ] Build map of declared outputs per job
- [ ] Validate references against declared outputs
- [ ] Create WP2011 diagnostic with helpful hints

### Code Changes
- [ ] `packages/compiler/src/semantics/output-validation.ts` - extended or new
- [ ] Wire validation into compile pipeline
- [ ] Add diagnostic code WP2011 to diagnostic constants

### Tests
- [ ] Test: valid output reference passes
- [ ] Test: reference to non-existent output produces WP2011
- [ ] Test: reference to non-existent job produces appropriate error
- [ ] Test: helpful hints list available outputs

### Documentation
- [ ] Update `docs/errors.md` with WP2011

## Technical Context

Currently WI-046 implements:
- WP2010: Duplicate output name (implemented)
- Output declaration parsing and codegen (implemented)

Missing:
- WP2011: Reference to non-existent output (this work item)

Expression analysis requires parsing `${{ needs.X.outputs.Y }}` patterns in:
- String literals in run commands
- Template expressions
- Step with expressions

This is more complex than WP2010 because it requires:
1. Expression parsing (not just AST node inspection)
2. Cross-job analysis (output declarations in one job, references in another)
3. Understanding the `needs` relationship

## Example

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
  }
  steps: [...]
}

job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.typo }}")  // WP2011: 'typo' not found
                                                  // Hint: available outputs: version
  ]
}
```

## Dependencies

- WI-046: Job outputs feature must be complete
- Expression parsing infrastructure (may need enhancement)

## Notes

- This is a significant enhancement requiring expression analysis
- Consider incremental approach: detect obvious patterns first
- May not catch all cases (computed expressions, etc.)
- Similar pattern needed later for step outputs validation
