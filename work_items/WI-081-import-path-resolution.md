# WI-081: Import System - Path Resolution

**ID**: WI-081
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement relative path resolution for imports. This is Phase 2 of the import system implementation (ADR-0012).

Path resolution must work correctly across CLI and VS Code extension contexts, handling cross-platform differences.

## Acceptance Criteria

- [ ] Create `packages/compiler/src/imports/path-resolver.ts`
- [ ] `resolvePath(importPath: string, fromFile: string): string` function
- [ ] Relative path resolution (`./`, `../`)
- [ ] Path normalization (collapse `..`, remove redundant `.`)
- [ ] Cross-platform support (Unix `/` and Windows `\`)
- [ ] Validate `.workpipe` extension is present (no implicit extensions)
- [ ] `FileResolver` interface abstraction for file reading
- [ ] CLI implementation of `FileResolver` (filesystem reads)
- [ ] VS Code extension implementation of `FileResolver` (workspace reads)
- [ ] Detect absolute paths and warn (WP7006 preparation)
- [ ] Detect paths escaping project root (WP7007 preparation)
- [ ] Unit tests for path resolution
- [ ] Unit tests for normalization edge cases
- [ ] Unit tests for cross-platform paths

## Technical Context

**Path resolution strategy** (from ADR-0012):

Relative paths:
- Resolved from the directory containing the importing file
- `./types.workpipe` -> same directory
- `../shared/types.workpipe` -> parent directory's `shared` folder

Extension handling:
- `.workpipe` extension is required
- No implicit extension resolution

Path normalization:
- `./foo/../bar/types.workpipe` normalizes to `./bar/types.workpipe`
- Prevents duplicate imports of same file via different paths

**API design**:

```typescript
interface FileResolver {
  resolve(path: string): Promise<string | null>;  // null = not found
  exists(path: string): Promise<boolean>;
}

interface PathResolutionResult {
  resolvedPath: string;
  normalizedPath: string;  // For deduplication
  warnings: Diagnostic[];  // WP7006, WP7007 etc.
}

function resolvePath(
  importPath: string,
  fromFile: string,
  projectRoot?: string
): PathResolutionResult;
```

**Files to create/modify**:
- `packages/compiler/src/imports/path-resolver.ts` (new)
- `packages/compiler/src/imports/file-resolver.ts` (new)
- `packages/compiler/src/imports/index.ts` (new)

## Dependencies

- WI-080: Import System - Grammar and Parser

## Notes

- Keep synchronous option available for simpler test scenarios
- Project root detection could use marker file (e.g., `workpipe.config.js`) in future
- For now, project root is inferred from CLI cwd or VS Code workspace root
