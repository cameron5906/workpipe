# Quick Reference Audit

**ID**: WI-103
**Status**: Completed
**Priority**: P1-High
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

The quick reference or cheat sheet may have outdated syntax that does not reflect the current state of WorkPipe. End-user review identified that this document needs auditing to ensure all syntax examples are current and correct.

This is especially important after the step syntax changes (ADR-0013) which changed `run()` to `shell {}` and `uses()` to `uses() {}`.

## Acceptance Criteria

- [x] Audit `docs/quick-reference.md` for accuracy
- [x] Verify all syntax examples compile successfully
- [x] Update any outdated syntax to current form:
  - [x] Steps use block syntax (`steps { }` not `steps: [...]`)
  - [x] Shell steps use `shell { }` not `run("...")`
  - [x] Uses steps have trailing `{}` when no with block
- [x] Verify all construct names match current grammar
- [x] Verify all property names match current schema
- [x] Cross-reference with `docs/language-reference.md` for consistency
- [x] Add any missing common patterns (added Imports section)

## Technical Context

- Quick reference: `docs/quick-reference.md`
- Language reference: `docs/language-reference.md`
- Step syntax changes: ADR-0013, WI-090 through WI-097
- Current grammar: `packages/lang/src/workpipe.grammar`

## Dependencies

- None

## Notes

The quick reference is often the first document users consult when writing WorkPipe code. Outdated examples here will cause immediate frustration.

Key areas to verify:
1. Workflow declaration syntax
2. Job declaration syntax
3. Agent job/task syntax
4. Cycle syntax
5. Matrix syntax
6. Guard syntax
7. Type declaration syntax
8. Import syntax
9. Step syntax (most likely to be outdated)
10. Trigger syntax

## Completion Notes

**Completed**: 2026-01-01

Work completed:
- Added missing Imports section with syntax examples
- Converted all step examples from array syntax to block syntax
- Replaced unimplemented `emit`/`emits`/`consumes` artifact syntax with supported `output_artifact` approach
- Updated Matrix Builds, Agent Jobs, User-Defined Types, and Escape Hatch examples

**Follow-up Finding**: The documentation-steward found that `docs/language-reference.md` (lines 1436-1463) has the same unimplemented `emit`/`emits`/`consumes` artifact syntax. This needs to be updated to match the corrected quick-reference.md. Added as checklist item to WI-104.
