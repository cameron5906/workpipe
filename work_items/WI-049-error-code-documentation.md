# WI-049: Create Error Code Documentation

**ID**: WI-049
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

WorkPipe has multiple diagnostic error codes (WP1xxx, WP2xxx, WP6xxx, WP7xxx) but they are not documented anywhere users can reference. When users see an error code like WP7002, they have no way to look up what it means or how to fix it.

**Source:** End-user acceptance review of WI-045

## Current State

Diagnostic codes exist in the codebase:
- WP1xxx: Parse errors (assumed, needs verification)
- WP2xxx: AST errors (assumed, needs verification)
- WP6001: Cycle without termination condition
- WP6005: Cycle with `until` but no `max_iters` safety
- WP7001: Job missing `runs_on`
- WP7002: Agent job missing `runs_on`
- WP7004: Workflow has no jobs or cycles

Note: WP7003 is not used (code gap - P4 issue noted but not critical).

## Acceptance Criteria

- [x] Create `docs/errors.md` with comprehensive error code documentation
- [x] Document all WP6xxx cycle validation codes
- [x] Document all WP7xxx semantic validation codes
- [x] For each code, include:
  - Error code and severity (error/warning)
  - Short description
  - Example that triggers the error
  - How to fix it
- [x] Add link to errors.md from docs/README.md
- [x] Consider adding error code to CLI `--help` output

## Deliverables Checklist

### Analysis
- [x] Grep codebase for all WPxxxx patterns to inventory all codes
- [x] Categorize codes by subsystem (parse, AST, semantic, cycle, etc.)

### Documentation
- [x] Create `docs/errors.md` with error code reference
- [x] Structure by code range (WP1xxx, WP6xxx, WP7xxx, etc.)
- [x] Include examples and solutions for each

### Integration
- [x] Link from docs/README.md
- [x] Consider linking from language-reference.md where relevant

## Technical Context

Error codes are defined in:
- `packages/compiler/src/semantics/required-fields.ts` (WP7001, WP7002, WP7004)
- `packages/compiler/src/semantics/cycle-validation.ts` (WP6001, WP6005)
- Possibly other files for parse errors

## Dependencies

None - documentation only.

## Notes

- Good developer experience requires discoverable error documentation
- Consider generating this documentation from code in the future (JSDoc or similar)
- Related: WI-051 will add error code links to language-reference.md
