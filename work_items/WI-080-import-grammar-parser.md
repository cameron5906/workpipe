# WI-080: Import System - Grammar and Parser

**ID**: WI-080
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Add import syntax to the WorkPipe Lezer grammar and parser. This is Phase 1 of the import system implementation (ADR-0012).

The Named Imports syntax to support:

```workpipe
// Named imports
import { BuildInfo, DeployResult } from "./types.workpipe"

// Aliased imports
import { BuildInfo as BI } from "./types.workpipe"

// Multiple imports from same file (multi-line)
import {
  BuildInfo,
  DeployResult,
  TestSummary
} from "./types.workpipe"
```

## Acceptance Criteria

- [ ] Grammar extended with `ImportDecl` production
- [ ] `import` keyword reserved
- [ ] `from` keyword reserved
- [ ] `as` keyword handling (may already exist)
- [ ] `ImportList` production for comma-separated import items
- [ ] `ImportItem` production with optional `as` alias
- [ ] `ImportPath` production for string literal paths
- [ ] Imports must appear before type and workflow declarations
- [ ] Parser error recovery for malformed imports
- [ ] Source spans preserved for all import nodes
- [ ] Grammar tests for valid import syntax
- [ ] Grammar tests for malformed imports (error recovery)
- [ ] Grammar tests for multi-line import lists

## Technical Context

**Grammar changes** (from ADR-0012):

```lezer
@top Workflow { ImportDecl* TypeDecl* WorkflowDecl* }

ImportDecl {
  kw<"import"> "{" ImportList "}" kw<"from"> ImportPath
}

ImportList {
  ImportItem ("," ImportItem)* ","?
}

ImportItem {
  Identifier (kw<"as"> Identifier)?
}

ImportPath {
  String  // Quoted path like "./types.workpipe"
}
```

**Files to modify**:
- `packages/lang/src/workpipe.grammar` - Add import productions
- `packages/lang/src/highlight.ts` - Ensure import keywords highlighted
- `packages/lang/src/__tests__/parser.test.ts` - Grammar tests

**References**:
- ADR-0012: Import System for Cross-File References (Section 7: Grammar Changes)
- ADR-0003: Lezer Grammar Design

## Dependencies

- None (first phase of import system)

## Notes

- This phase is grammar-only; no AST changes yet (WI-081 handles AST)
- Keep import syntax simple and close to JavaScript/TypeScript for familiarity
- Trailing comma in import list is optional but allowed for easier git diffs
