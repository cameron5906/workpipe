# WI-083: Import System - Type Registry Merging

**ID**: WI-083
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement cross-file type resolution and type registry merging. This is Phase 4 of the import system implementation (ADR-0012).

When a file imports types from another file, those types must be resolved and made available for validation and code generation.

## Acceptance Criteria

- [ ] Extend `TypeRegistry` to support multi-file type sources
- [ ] `importTypes(fromRegistry: TypeRegistry, names: ImportItem[])` method
- [ ] Type alias resolution (`import { Foo as Bar }` maps `Bar` to `Foo`'s definition)
- [ ] Name collision detection (error if importing name that already exists)
- [ ] Validate requested types exist in source file (WP7003)
- [ ] Track type provenance (which file each type came from)
- [ ] Non-transitive imports (imported types are not re-exportable)
- [ ] Update `compile()` to accept multi-file compilation context
- [ ] Integration tests for single import
- [ ] Integration tests for multiple imports
- [ ] Integration tests for aliased imports
- [ ] Integration tests for name collision detection

## Technical Context

**Type Registry merging** (from ADR-0012):

Each imported file produces a `TypeRegistry`. The main file's registry merges in imported types, respecting:
1. Only explicitly named types are imported
2. Aliasing maps the local name to the source type definition
3. Name collisions produce an error

**Non-transitive imports**:
If `a.workpipe` imports `BuildInfo` from `types.workpipe`, and `b.workpipe` imports from `a.workpipe`, `b.workpipe` does NOT automatically get `BuildInfo`. It must import directly from `types.workpipe`.

**API changes**:

```typescript
interface ImportContext {
  fileResolver: FileResolver;
  projectRoot: string;
  parsedFiles: Map<string, WorkPipeFileNode>;  // Cache
  registries: Map<string, TypeRegistry>;        // Cache
}

interface CompileOptions {
  source: string;
  filePath: string;  // Required for relative path resolution
  importContext?: ImportContext;  // For multi-file compilation
}

// TypeRegistry extension
class TypeRegistry {
  importTypes(
    sourceRegistry: TypeRegistry,
    imports: Array<{ name: string; alias?: string }>,
    sourceFile: string
  ): Diagnostic[];

  getTypeProvenance(typeName: string): string | undefined;
}
```

**Files to modify**:
- `packages/compiler/src/semantics/type-registry.ts`
- `packages/compiler/src/compile.ts`
- `packages/compiler/src/imports/index.ts`

## Dependencies

- WI-080: Import System - Grammar and Parser
- WI-081: Import System - Path Resolution
- WI-082: Import System - Dependency Graph

## Notes

- Type registry caching is important for performance in large projects
- Consider lazy parsing/registry building (parse only when needed)
- Provenance tracking enables "go to definition" in VS Code
