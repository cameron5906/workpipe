# WI-045: Enhanced Editor Validation and Required Field Diagnostics

**ID**: WI-045
**Status**: Completed
**Priority**: P1-High
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-30
**Updated**: 2025-12-31

## Description

Users expect the VS Code extension to show errors and warnings when required fields are missing from WorkPipe constructs. Currently, syntax highlighting works but semantic validation for required fields is not surfaced in the editor.

**User Feedback:**
> "When I'm in vscode I see the syntax highlighting, but im expecting there to be some kind of error or warning when i take out something that should be required"

The current VS Code extension (WI-038) provides:
- Syntax highlighting via TextMate grammar
- Real-time compiler diagnostics via `DiagnosticsProvider`

However, the compiler may need enhanced semantic validation to detect missing required fields, and the extension may need to better surface these diagnostics.

## Acceptance Criteria

- [x] Missing required fields in workflow blocks produce clear error diagnostics
- [x] Missing required fields in job blocks (e.g., `runs_on`) produce diagnostics
- [x] Missing required fields in step blocks produce diagnostics
- [x] Missing required fields in cycle blocks (e.g., termination conditions) produce diagnostics
- [x] Diagnostics appear as red/yellow squiggles in VS Code in real-time
- [x] Error messages clearly state what field is missing and where
- [x] Tests verify all required field validation scenarios

## Deliverables Checklist

### Analysis Phase
- [x] Audit current parser/AST for which fields are truly required vs optional
- [x] Document required fields per construct (workflow, job, agent_job, cycle, step types)
- [x] Review existing diagnostics to identify gaps in coverage

### Compiler Enhancements
- [x] Add semantic validation pass for required field checking
- [x] Create diagnostic codes for each missing required field type (WP7001, WP7002, WP7004)
- [x] Ensure diagnostics include precise source spans for the construct with missing field
- [x] Add tests for each required field validation scenario (14 test cases)

### VS Code Extension Verification
- [x] Verify DiagnosticsProvider surfaces new validation errors correctly
- [x] Test real-time updates when required fields are added/removed
- [ ] Consider adding quick-fix code actions to insert required fields (stretch goal - deferred)

## Implementation Summary

**Files Created:**
- `packages/compiler/src/semantics/required-fields.ts` - validation logic
- `packages/compiler/src/__tests__/required-fields.test.ts` - 14 test cases

**Files Modified:**
- `packages/compiler/src/semantics/index.ts` - export
- `packages/compiler/src/index.ts` - wired validation into compile()
- `examples/cycle-basic/cycle-basic.workpipe` - fixed example missing runs_on

**New Diagnostic Codes:**
- WP7001: Missing runs_on in job
- WP7002: Missing prompt in agent_task
- WP7004: Missing command in run step

**Verification:**
- All 340 tests pass
- Build succeeds

## Technical Context

### Current Diagnostic System
The compiler has a robust diagnostic system (WI-044):
- `Diagnostic` type with code, message, severity, and span
- `SourceMap` for line/column computation
- `CompileResult<T>` that carries diagnostics

### Current VS Code Extension
The extension (WI-038) already subscribes to document changes and calls `compile()`:
- `DiagnosticsProvider.updateDiagnostics()` compiles on every change
- Diagnostics are converted to VS Code squiggles with correct ranges

### Required Fields by Construct (To Be Validated)
| Construct | Required Fields |
|-----------|----------------|
| `workflow` | `name` (implicit from block), at least one trigger or job |
| `job` | `runs_on` |
| `agent_job` | `runs_on` |
| `cycle` | termination condition (`until` or `max_iters`) |
| `run()` step | command string |
| `uses()` step | action reference |
| `agent_task` | `prompt` |

### Relevant Error Codes
- Existing: WP1xxx (parse), WP2xxx (AST), WP6xxx (cycle validation)
- New: WP7xxx suggested for semantic/required field validation

## Dependencies

- WI-044: Diagnostic system (complete) - provides foundation
- WI-038: VS Code extension (complete) - already wired for diagnostics

## Notes

- This directly addresses user feedback requesting better validation feedback
- The VS Code extension infrastructure is already in place; this is primarily a compiler semantic validation enhancement
- Consider progressive disclosure: errors for truly required fields, warnings for recommended fields
- This overlaps with but extends beyond WI-039 which focused on code actions and hover info
