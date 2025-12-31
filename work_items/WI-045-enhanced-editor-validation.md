# WI-045: Enhanced Editor Validation and Required Field Diagnostics

**ID**: WI-045
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-30
**Updated**: 2025-12-30

## Description

Users expect the VS Code extension to show errors and warnings when required fields are missing from WorkPipe constructs. Currently, syntax highlighting works but semantic validation for required fields is not surfaced in the editor.

**User Feedback:**
> "When I'm in vscode I see the syntax highlighting, but im expecting there to be some kind of error or warning when i take out something that should be required"

The current VS Code extension (WI-038) provides:
- Syntax highlighting via TextMate grammar
- Real-time compiler diagnostics via `DiagnosticsProvider`

However, the compiler may need enhanced semantic validation to detect missing required fields, and the extension may need to better surface these diagnostics.

## Acceptance Criteria

- [ ] Missing required fields in workflow blocks produce clear error diagnostics
- [ ] Missing required fields in job blocks (e.g., `runs_on`) produce diagnostics
- [ ] Missing required fields in step blocks produce diagnostics
- [ ] Missing required fields in cycle blocks (e.g., termination conditions) produce diagnostics
- [ ] Diagnostics appear as red/yellow squiggles in VS Code in real-time
- [ ] Error messages clearly state what field is missing and where
- [ ] Tests verify all required field validation scenarios

## Deliverables Checklist

### Analysis Phase
- [ ] Audit current parser/AST for which fields are truly required vs optional
- [ ] Document required fields per construct (workflow, job, agent_job, cycle, step types)
- [ ] Review existing diagnostics to identify gaps in coverage

### Compiler Enhancements
- [ ] Add semantic validation pass for required field checking
- [ ] Create diagnostic codes for each missing required field type (e.g., WP7001, WP7002)
- [ ] Ensure diagnostics include precise source spans for the construct with missing field
- [ ] Add tests for each required field validation scenario

### VS Code Extension Verification
- [ ] Verify DiagnosticsProvider surfaces new validation errors correctly
- [ ] Test real-time updates when required fields are added/removed
- [ ] Consider adding quick-fix code actions to insert required fields (stretch goal)

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
