# Enhanced VS Code Diagnostics

**ID**: WI-039
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Enhance the existing VS Code extension with advanced diagnostic features: code actions (quick fixes) for common errors, hover information for keywords and constructs, and improved user experience when working with WorkPipe files.

The extension already has:
- Syntax highlighting via TextMate grammar
- Real-time diagnostics with error squiggles
- Hint display appended to diagnostic messages

This work item adds:
- Quick fix code actions for common errors
- Hover provider for keywords and constructs
- Error code links in diagnostics (clickable to docs)

## Acceptance Criteria

### Code Actions (Quick Fixes)
- [x] Implement CodeActionProvider for workpipe files
- [x] Quick fix for WP7001/WP7002: Add missing `runs_on: ubuntu-latest`
- [x] Quick fix for WP6001: Add `max_iters = 5` to cycle
- [x] Quick fix for WP6005: Add `max_iters = 10` safety rail
- [x] Quick fix suggestions only appear for diagnostics where a fix is appropriate
- [x] Unit tests for code action generation

### Hover Provider
- [x] Implement HoverProvider for workpipe files
- [x] Hover info for keywords: `workflow`, `job`, `agent_job`, `cycle`, `task`
- [x] Hover info for properties: `runs_on`, `needs`, `steps`, `outputs`, `prompt`, `max_iters`, `until`
- [x] Hover info shows brief description and link to documentation
- [x] Unit tests for hover provider

### Error Code Links
- [x] Diagnostics include code as clickable link to docs/errors.md#{code}
- [N/A] Update package.json with custom command for opening error docs (optional)

### Integration
- [x] All new providers registered in extension.ts
- [x] Package.json updated with any new contribution points
- [x] All existing tests continue to pass
- [x] At least 10 new tests for new functionality (23 new tests added, 35 total)

## Technical Context

### Current Extension Architecture

From `packages/vscode-extension/src/extension.ts`:
```typescript
export function activate(context: vscode.ExtensionContext): void {
  diagnosticsProvider = new DiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);
  // Event subscriptions for document changes...
}
```

From `packages/vscode-extension/src/diagnostics.ts`:
- `DiagnosticsProvider` class handles real-time compilation
- `toDiagnostic()` maps compiler Diagnostic to VS Code Diagnostic
- Hints are already appended to messages

### VS Code API for New Features

**CodeActionProvider:**
```typescript
vscode.languages.registerCodeActionsProvider('workpipe', {
  provideCodeActions(document, range, context, token): vscode.CodeAction[] {
    // context.diagnostics contains diagnostics at this location
    // Return CodeAction[] with WorkspaceEdit for quick fixes
  }
}, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] });
```

**HoverProvider:**
```typescript
vscode.languages.registerHoverProvider('workpipe', {
  provideHover(document, position, token): vscode.Hover {
    // Get word at position
    // Return Hover with MarkdownString content
  }
});
```

### Error Codes to Support Quick Fixes

| Code | Error | Quick Fix |
|------|-------|-----------|
| WP7001 | Job missing runs_on | Insert `runs_on: ubuntu-latest` |
| WP7002 | Agent job missing runs_on | Insert `runs_on: ubuntu-latest` |
| WP6001 | Cycle missing termination | Insert `max_iters = 5` |
| WP6005 | Cycle missing safety rail | Insert `max_iters = 10` |

### Keywords/Properties for Hover

| Keyword | Description |
|---------|-------------|
| workflow | Defines a GitHub Actions workflow |
| job | A regular job with shell steps |
| agent_job | A job that runs Claude Code as an agent |
| cycle | An iterative loop with termination conditions |
| task | An agent task within an agent_job |
| runs_on | GitHub Actions runner (e.g., ubuntu-latest) |
| needs | Job dependencies |
| steps | List of steps to execute |
| outputs | Job output declarations |
| prompt | Agent task prompt text |
| max_iters | Maximum cycle iterations |
| until | Guard condition for cycle termination |

## Dependencies

- WI-038: VS Code extension (complete) - foundation
- WI-050: Hint display (complete) - hints already surfaced
- WI-049: Error documentation (complete) - error codes documented

## Files to Create/Modify

### New Files
- `packages/vscode-extension/src/code-actions.ts` - CodeActionProvider
- `packages/vscode-extension/src/hover.ts` - HoverProvider
- `packages/vscode-extension/src/__tests__/code-actions.test.ts`
- `packages/vscode-extension/src/__tests__/hover.test.ts`

### Modified Files
- `packages/vscode-extension/src/extension.ts` - register new providers
- `packages/vscode-extension/package.json` - add contribution points if needed

## Implementation Notes

1. **Code Actions**: Use `vscode.WorkspaceEdit` to insert text at appropriate locations. For missing `runs_on`, insert after the job name brace. For missing `max_iters`, insert at the start of the cycle body.

2. **Hover Provider**: Use `document.getWordRangeAtPosition(position)` to get the hovered word. Match against keyword list and return appropriate markdown content.

3. **Error Code Links**: VS Code diagnostics support `codeDescription.href` for clickable links. This could link to the hosted docs or a local file.

4. **Testing**: Mock the vscode module as done in existing tests. Test code action generation for each supported error code.

## Notes

- This is the final tooling polish work item for Milestone E
- Consider adding a "Go to Definition" provider in a future work item (for job references in `needs`)
- Code actions should be conservative - only offer fixes when confident about the fix location
