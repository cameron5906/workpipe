# WI-088: VS Code Hover Hints Enhancement

**ID**: WI-088
**Status**: Completed
**Priority**: P3-Low
**Milestone**: E (Tooling)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Enhance VS Code extension with hover hints that show information when hovering over keywords and symbols in WorkPipe files.

This improves the developer experience by providing inline documentation and context without leaving the editor.

## Acceptance Criteria

- [x] Hover over `workflow` keyword shows workflow documentation
- [x] Hover over `job` keyword shows job documentation
- [x] Hover over `agent_job` shows agent job documentation
- [x] Hover over `agent_task` shows agent task documentation
- [x] Hover over `cycle` shows cycle documentation
- [x] Hover over `type` shows type declaration documentation
- [x] Hover over type references shows type definition
- [x] Hover over job names shows job details (runs_on, needs, etc.)
- [x] Hover over output references shows output type info
- [x] Hover over `needs` shows dependency job information
- [x] Hover over imported types shows source file
- [x] Tests for hover provider functionality

## Technical Context

**Current state**:
- `packages/vscode-extension/src/hover.ts` exists with basic keyword hovers
- HoverProvider registered in extension.ts

**Enhancements needed**:
- Richer markdown content in hovers
- Context-aware hovers (job name hovers show that specific job's config)
- Type information in hovers
- Import provenance in hovers

**Example hover content**:

```markdown
**job** `build`

Runs on: `ubuntu-latest`
Needs: `lint`, `test`
Outputs: `version` (string), `artifacts` (BuildInfo)

[View documentation](docs/language-reference.md#jobs)
```

**Files to modify**:
- `packages/vscode-extension/src/hover.ts`
- `packages/vscode-extension/src/__tests__/hover.test.ts`

## Dependencies

- None (enhancement to existing functionality)
- Would benefit from WI-083 (Type Registry Merging) for type info
- Would benefit from WI-086 (VS Code Import Support) for import provenance

## Notes

- This is a UX polish item, not blocking any other work
- Can be implemented incrementally (keywords first, then context-aware)
- Consider linking to online documentation in hover content
- VSCode markdown supports syntax highlighting in code blocks
