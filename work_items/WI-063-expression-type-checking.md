# Implement Expression Type Checking

**ID**: WI-063
**Status**: Completed
**Priority**: P1-High (USER ESCALATED - NEEDED NOW)
**Milestone**: Phase 3 (Types + Outputs)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Implement compile-time type checking for expressions that reference typed outputs. When output types are declared, the compiler could detect potential type mismatches in expressions:

- Comparing string output to number literal
- Performing arithmetic on non-numeric declared type
- Using boolean output in string concatenation

This would provide early feedback on likely bugs without runtime errors.

## Acceptance Criteria

- [x] WP2012 warning for type mismatch in comparisons (e.g., `${{ needs.job.outputs.count == 'hello' }}` when count is declared as `number`)
- [x] WP2013 info diagnostic for numeric operation on non-numeric declared type
- [x] Tests cover common type mismatch cases
- [x] `docs/errors.md` updated with WP2012 and WP2013 documentation

## Technical Context

This requires:
1. Expression parsing to identify output references within `${{ ... }}`
2. Type lookup for referenced outputs
3. Type inference for literals and operators
4. Diagnostic generation for mismatches

Complexity considerations:
- Expressions can be complex (nested, with functions)
- GitHub Actions has loose typing (most things coerce)
- False positives could be frustrating
- May want to make these warnings/info rather than errors

Related files:
- `packages/compiler/src/semantics/output-validation.ts` - existing output validation
- `packages/compiler/src/diagnostics/` - diagnostic infrastructure

## Dependencies

- None (standalone enhancement)

## Notes

- USER ESCALATED PRIORITY: Expression type checking is urgently needed per user request
- Originated from end-user acceptance review of custom type system
- Consider starting with simple cases (direct comparisons) before complex expressions
- May require expression parser infrastructure - this should be scoped carefully
