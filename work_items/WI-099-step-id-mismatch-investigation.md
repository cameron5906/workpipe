# Step ID Mismatch in Generated YAML

**ID**: WI-099
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: G (Step Syntax Improvements)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

Generated YAML may have step IDs that do not match what users expect. This can cause runtime failures in GitHub Actions when users try to reference step outputs using `steps.<id>.outputs.<name>`. The issue was identified during end-user acceptance review.

This requires investigation into the codegen for step ID generation to ensure:
1. Step IDs are predictable and documented
2. Step IDs match any user-specified identifiers
3. Auto-generated step IDs follow a consistent pattern

## Solution Implemented

Auto-generate sequential step IDs (`step_0`, `step_1`, etc.) for all steps when a job has outputs. This ensures:
- Predictable, consistent step IDs across all job types
- Correct output references using `steps.step_N.outputs.X` where N is the step index
- Step IDs are only generated when needed (jobs with outputs)

## Acceptance Criteria

- [x] Investigate current step ID generation logic in `packages/compiler/src/codegen/transform.ts`
- [x] Document current step ID generation behavior
- [x] Identify any cases where step IDs may be unexpected or inconsistent
- [x] If issues found: fix the codegen to ensure consistent step ID generation
- [x] Add tests for step ID consistency across compilation
- [x] Regenerate all expected.yml files if codegen changes (job-outputs example updated)
- [x] User-specified step IDs: N/A - WorkPipe DSL does not support user-specified step IDs; auto-generation is the only path
- [ ] Update `docs/language-reference.md` with step ID behavior documentation (optional - internal implementation detail)

## Files Modified

1. `packages/compiler/src/codegen/yaml-ir.ts` - Added `id?: string` to step IR types
2. `packages/compiler/src/codegen/transform.ts` - Added `assignStepIds()` helper, updated all job transformers
3. `packages/compiler/src/codegen/emit.ts` - Updated to emit step IDs
4. `packages/compiler/src/__tests__/codegen.test.ts` - Added 4 new tests for step ID consistency
5. `examples/job-outputs/expected.yml` - Updated with new step ID format

## Test Results

All 976 tests pass (972 baseline + 4 new step ID tests).

## Technical Context

- Step codegen is in `packages/compiler/src/codegen/transform.ts`
- YAML IR types are in `packages/compiler/src/codegen/yaml-ir.ts`
- Step types include: ShellStepIR, UsesWithStepIR, ClaudeCodeStepIR, etc.
- GitHub Actions requires unique step IDs within a job for output references

## Dependencies

- None

## Notes

The investigation found that step IDs were not being generated at all for most step types. The fix ensures all steps in jobs with outputs get sequential IDs (`step_0`, `step_1`, etc.) and output references correctly use the last step's ID.

Documentation update for step ID behavior is optional since this is an internal implementation detail - users don't specify step IDs in the DSL, they are auto-generated.
