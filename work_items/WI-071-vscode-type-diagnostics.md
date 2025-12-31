# WI-071: VS Code Diagnostics for Type Errors

**ID**: WI-071
**Status**: Completed
**Priority**: P1-High
**Milestone**: A++ (Type System Enhancement)
**Phase**: 9 (Tooling)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)
**Parent**: WI-064 (User-Defined Type System)

## Description

Ensure type-related diagnostics from the compiler surface properly in the VS Code extension with appropriate severity, messages, and quick fixes where applicable.

## User Requirement

> "VS Code extension must support diagnostics so users can't reference non-existent properties"

## Acceptance Criteria

### Diagnostic Display
- [ ] WP5001 (duplicate type) shows as error with red squiggle
- [ ] WP5002 (undefined type) shows as error with red squiggle
- [ ] WP5003 (property not found) shows as error with red squiggle
- [ ] All diagnostics include helpful messages and hints

### Quick Fixes (Code Actions)
- [ ] WP5002: Suggest similar type names if available
- [ ] WP5003: Suggest similar property names if available

### Hover Information
- [ ] Hover on type name shows type definition
- [ ] Hover on type reference shows "Type: X" with definition
- [ ] Hover on typed output shows type information

### Tests
- [ ] Diagnostics surface correctly for all type errors
- [ ] Code actions provide relevant suggestions
- [ ] Hover provider shows type information

## Technical Context

### Current VS Code Extension

The extension already supports:
- Real-time diagnostics from compiler
- Hover provider for keywords and properties (WI-039)
- Code actions for quick fixes (WI-039)

### New Diagnostics

| Code | Severity | Message Pattern |
|------|----------|----------------|
| WP5001 | Error | Type 'X' is already defined at line Y |
| WP5002 | Error | Unknown type 'X'. Did you mean 'Y'? |
| WP5003 | Error | Property 'X' does not exist on type 'Y' |

### Code Action Implementation

For WP5002 (undefined type):
```typescript
if (diagnostic.code === 'WP5002' && suggestions.length > 0) {
  const action = new vscode.CodeAction(
    `Did you mean '${suggestions[0]}'?`,
    vscode.CodeActionKind.QuickFix
  );
  action.edit = new vscode.WorkspaceEdit();
  action.edit.replace(document.uri, diagnostic.range, suggestions[0]);
  actions.push(action);
}
```

For WP5003 (property not found):
```typescript
if (diagnostic.code === 'WP5003' && suggestions.length > 0) {
  const action = new vscode.CodeAction(
    `Did you mean '${suggestions[0]}'?`,
    vscode.CodeActionKind.QuickFix
  );
  action.edit = new vscode.WorkspaceEdit();
  // Replace the property name in the expression
  actions.push(action);
}
```

### Hover Enhancement

Extend hover provider to show type definitions:
```typescript
// On type name in declaration
type BuildInfo { ... }
// Hover: "Type declaration: BuildInfo"

// On type reference in output
outputs: { info: BuildInfo }
// Hover: "Type: BuildInfo\n{ version: string, commit: string }"

// On typed output in expression
${{ needs.build.outputs.info.version }}
// Hover: "Property 'version' (string) of type BuildInfo"
```

### Files to Modify
- `packages/vscode-extension/src/diagnostics.ts` - Handle new codes
- `packages/vscode-extension/src/code-actions.ts` - Add quick fixes
- `packages/vscode-extension/src/hover.ts` - Add type hovers
- `packages/vscode-extension/src/__tests__/` - Add tests

## Dependencies

- WI-067: Type registry and resolver (for diagnostic codes)
- WI-070: Property access validation (for WP5003)
- WI-039: Enhanced VS Code diagnostics (complete) - foundation

## Notes

- All diagnostics should include hints when available
- Code actions should only appear when relevant suggestions exist
- Hover information helps users understand types without jumping to definition
- Consider "Go to Definition" for type references (stretch goal)
