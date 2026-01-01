# WI-086: Import System - VS Code Extension

**ID**: WI-086
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Update VS Code extension for cross-file diagnostics and file watching with imports. This is Phase 7 of the import system implementation (ADR-0012).

## Acceptance Criteria

- [x] Cross-file diagnostics (import errors reference other files)
- [x] File watching for dependents (recompile when imported file changes)
- [x] Reverse dependency tracking (know which files import a changed file)
- [x] Diagnostics show correct file paths for cross-file errors
- [ ] Import path completion (stretch goal)
- [ ] Go-to-definition for imported types (stretch goal)
- [x] Hover shows import source on imported types
- [x] Tests for cross-file diagnostic display
- [x] Tests for file watching behavior

## Technical Context

**VS Code extension impact** (from ADR-0012):

Diagnostics scope:
- Currently: diagnostics per-file, no cross-file awareness
- With imports: diagnostics may reference other files

File watching:
- Currently: recompile only the saved file
- With imports: recompile files that import the changed file
- Build reverse dependency graph
- Invalidate and recompile dependents

Go-to-definition (stretch):
- Jump to type definition in imported file
- Requires tracking definition locations across files

Hover information:
- Show import source on hover over imported type
- "BuildInfo (from ./types.workpipe)"

**Implementation approach**:

```typescript
class ImportAwareCompilation {
  private dependencyGraph: ImportGraph;
  private fileCache: Map<string, ParseResult>;

  async onFileChanged(uri: vscode.Uri): Promise<void> {
    const path = uri.fsPath;

    // Invalidate this file
    this.fileCache.delete(path);

    // Find all files that import this file
    const dependents = this.dependencyGraph.getDependentsOf(path);

    // Recompile this file and all dependents
    await this.compileFile(path);
    for (const dependent of dependents) {
      await this.compileFile(dependent);
    }
  }
}
```

**Files to modify**:
- `packages/vscode-extension/src/extension.ts`
- `packages/vscode-extension/src/diagnostics.ts`
- `packages/vscode-extension/src/hover.ts`
- `packages/vscode-extension/src/import-watcher.ts` (new)

## Dependencies

- WI-080: Import System - Grammar and Parser
- WI-081: Import System - Path Resolution
- WI-082: Import System - Dependency Graph
- WI-083: Import System - Type Registry Merging
- WI-084: Import System - Diagnostics
- WI-085: Import System - CLI Integration

## Notes

- Performance is critical for large workspaces
- Consider debouncing file change events
- Go-to-definition is valuable but can be Phase 2 if time-constrained
- Import path completion would be excellent UX but is not required for MVP
