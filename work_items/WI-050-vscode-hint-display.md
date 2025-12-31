# WI-050: Surface Diagnostic Hints in VS Code Extension

**ID**: WI-050
**Status**: Completed
**Priority**: P3-Low
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

The WorkPipe compiler's `Diagnostic` type includes a `hint` field that provides actionable suggestions for fixing errors. However, this hint is not currently displayed in the VS Code extension - only the error message and code appear.

**Source:** End-user acceptance review of WI-045

## Current Behavior

When a diagnostic is shown in VS Code:
- The error message is displayed (e.g., "Agent job 'review_docs' is missing required 'runs_on' field")
- The error code is shown (e.g., WP7002)
- The hint is NOT shown (e.g., "Add 'runs_on: ubuntu-latest' or another runner to the agent job")

## Expected Behavior

Users should see the hint, which provides immediate guidance on how to fix the issue. VS Code diagnostics can include "related information" or the hint could be appended to the message.

## Acceptance Criteria

- [x] Investigate VS Code diagnostic API for displaying hints/related information
- [x] Update `DiagnosticsProvider` to include hints in diagnostic display
- [x] Verify hints appear in hover tooltip and Problems panel
- [x] Ensure hint formatting is readable and not cluttered
- [x] Test with multiple diagnostic types

## Technical Context

The `Diagnostic` type in `packages/compiler/src/diagnostic/types.ts` likely has:
```typescript
interface Diagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  span: Span;
  hint?: string;  // This is not being surfaced
}
```

The VS Code extension in `packages/vscode-extension/` has a `DiagnosticsProvider` that converts compiler diagnostics to VS Code diagnostics.

Options for displaying hints:
1. Append hint to message: `${message}\n\nHint: ${hint}`
2. Use `relatedInformation` in VS Code Diagnostic
3. Display in hover provider

## Dependencies

- WI-038: VS Code extension (complete) - provides foundation

## Notes

- This is a quality-of-life improvement for developers
- Consider whether hints should be opt-in (might be too verbose for some users)
- Related to potential quick-fix code actions (WI-045 stretch goal)
