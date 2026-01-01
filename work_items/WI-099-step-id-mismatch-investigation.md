# Step ID Mismatch in Generated YAML

**ID**: WI-099
**Status**: Backlog
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

## Acceptance Criteria

- [ ] Investigate current step ID generation logic in `packages/compiler/src/codegen/transform.ts`
- [ ] Document current step ID generation behavior
- [ ] Identify any cases where step IDs may be unexpected or inconsistent
- [ ] If issues found: fix the codegen to ensure consistent step ID generation
- [ ] If user-specified step IDs are supported: ensure they are honored in output
- [ ] Add tests for step ID consistency across compilation
- [ ] Update `docs/language-reference.md` with step ID behavior documentation
- [ ] Regenerate all expected.yml files if codegen changes

## Technical Context

- Step codegen is in `packages/compiler/src/codegen/transform.ts`
- YAML IR types are in `packages/compiler/src/codegen/yaml-ir.ts`
- Step types include: ShellStepIR, UsesWithStepIR, ClaudeCodeStepIR, etc.
- GitHub Actions requires unique step IDs within a job for output references

## Dependencies

- None

## Notes

This may be a bug or a documentation gap. Investigation will determine which.

Potential issues to look for:
1. Step IDs being sanitized in unexpected ways
2. Step IDs not matching DSL names
3. Auto-generated IDs not being predictable
4. Collision handling for duplicate step names

If this turns out to be a documentation issue only (step IDs work correctly but aren't documented), scope can be reduced to documentation updates.
