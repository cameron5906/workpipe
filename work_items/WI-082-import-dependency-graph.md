# WI-082: Import System - Dependency Graph

**ID**: WI-082
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Build import dependency graph and implement cycle detection. This is Phase 3 of the import system implementation (ADR-0012).

The dependency graph enables:
1. Detecting circular imports (which are rejected)
2. Determining compilation order
3. Invalidation tracking for VS Code extension

## Acceptance Criteria

- [ ] Create `packages/compiler/src/imports/dependency-graph.ts`
- [ ] `ImportGraph` class to represent file dependencies
- [ ] `addFile(path: string, imports: string[])` method
- [ ] `hasCycle(): boolean` method
- [ ] `getCycle(): string[] | null` method (returns files in cycle)
- [ ] `getTopologicalOrder(): string[]` method for compilation order
- [ ] `getDependentsOf(path: string): string[]` for invalidation
- [ ] Cycle detection algorithm (Tarjan's SCC or DFS with coloring)
- [ ] Path normalization before graph insertion (dedupe same file)
- [ ] Unit tests for acyclic graphs
- [ ] Unit tests for direct cycles (A -> B -> A)
- [ ] Unit tests for transitive cycles (A -> B -> C -> A)
- [ ] Unit tests for complex multi-file scenarios
- [ ] Unit tests for topological order correctness

## Technical Context

**Circular import detection** (from ADR-0012):

```workpipe
// a.workpipe
import { TypeB } from "./b.workpipe"
type TypeA { ref: TypeB }

// b.workpipe
import { TypeA } from "./a.workpipe"  // ERROR: Circular import
type TypeB { ref: TypeA }
```

Detection algorithm options:
1. Tarjan's SCC algorithm (already implemented in WI-031 for job cycles)
2. DFS with color marking (white/gray/black)

**API design**:

```typescript
interface ImportEdge {
  from: string;  // Importing file (normalized path)
  to: string;    // Imported file (normalized path)
  importedNames: string[];  // What was imported
}

class ImportGraph {
  addFile(filePath: string, imports: ImportEdge[]): void;
  hasCycle(): boolean;
  getCycle(): string[] | null;
  getTopologicalOrder(): string[];
  getDependentsOf(filePath: string): Set<string>;
  getDependenciesOf(filePath: string): Set<string>;
}
```

**Files to create/modify**:
- `packages/compiler/src/imports/dependency-graph.ts` (new)
- Consider reusing `packages/compiler/src/analysis/graph.ts` (Tarjan from WI-031)

## Dependencies

- WI-080: Import System - Grammar and Parser
- WI-081: Import System - Path Resolution

## Notes

- Can potentially reuse/adapt the graph analysis code from WI-031 (cycle detection)
- Graph must handle incremental updates for VS Code performance
- Keep cycle error messages clear with full path listing
