# VS Code Extension Missing Fragment Syntax Support

**ID**: WI-107
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

The VS Code extension is showing invalid syntax error diagnostics for valid WorkPipe files because the TextMate grammar is out of sync with the compiler's Lezer grammar. Specifically, the fragment syntax added in WI-106 (Fragment System) is not recognized by the VS Code extension.

**User Report**: `workpipe/ci.workpipe` and other files show syntax error diagnostics that shouldn't be there.

**Root Cause Analysis**:

1. **TextMate Grammar Missing Keywords**: The VS Code extension's `workpipe.tmLanguage.json` does not include:
   - `job_fragment` keyword
   - `steps_fragment` keyword
   - `params` keyword
   - `...` spread operator for fragment spreading

2. **Possible Stale Extension Build**: User may have an older `.vsix` installed that predates fragment support.

3. **Diagnostics Provider**: The diagnostics provider in the extension uses the compiler's parser, so if the extension is rebuilt, diagnostics should work correctly. However, TextMate highlighting will still be broken without grammar updates.

## Acceptance Criteria

- [ ] TextMate grammar updated with `job_fragment` keyword (keyword.control.workflow.workpipe)
- [ ] TextMate grammar updated with `steps_fragment` keyword (keyword.control.workflow.workpipe)
- [ ] TextMate grammar updated with `params` keyword (keyword.other.property.workpipe)
- [ ] TextMate grammar handles `...` spread operator (keyword.operator.spread.workpipe or similar)
- [ ] Extension rebuilt and new `.vsix` generated
- [ ] All existing examples with fragments compile without diagnostics
- [ ] Files in `examples/fragment-basics/` and `examples/agent-task-fragments/` display correctly
- [ ] `workpipe/ci.workpipe` displays without spurious errors
- [ ] Tests added/updated for new syntax highlighting patterns

## Technical Context

### Files to Modify

1. **`packages/vscode-extension/syntaxes/workpipe.tmLanguage.json`**
   - Add `job_fragment` and `steps_fragment` to `keyword.control.workflow.workpipe` pattern (line 40)
   - Add `params` to `keyword.other.property.workpipe` pattern (line 52)
   - Add spread operator pattern for `...`

### Current Grammar Gap

**Compiler Lezer Grammar** (`packages/lang/src/workpipe.grammar` lines 33-52):
```
FragmentDecl {
  JobFragmentDecl | StepsFragmentDecl
}

JobFragmentDecl {
  kw<"job_fragment"> Identifier "{" ParamsBlock? JobBody "}"
}

StepsFragmentDecl {
  kw<"steps_fragment"> Identifier "{" ParamsBlock? BlockStep* "}"
}

ParamsBlock {
  kw<"params"> "{" ParamDecl* "}"
}

StepsFragmentSpread {
  "..." Identifier "{" ParamAssignment* "}"
}
```

**VS Code TextMate Grammar** (current - missing fragment support):
```json
{
  "name": "keyword.control.workflow.workpipe",
  "match": "\\b(workflow|job|agent_job|cycle|type)\\b"
}
```

**VS Code TextMate Grammar** (needed):
```json
{
  "name": "keyword.control.workflow.workpipe",
  "match": "\\b(workflow|job|job_fragment|steps_fragment|agent_job|cycle|type)\\b"
}
```

### Verification Steps

1. Rebuild extension: `cd packages/vscode-extension && pnpm build`
2. Generate VSIX: `pnpm package` (or equivalent)
3. Install fresh VSIX in VS Code
4. Open `examples/fragment-basics/fragment-basics.workpipe`
5. Verify no red squiggles on `job_fragment`, `steps_fragment`, `params`, or `...`
6. Verify syntax highlighting colors keywords correctly

## Dependencies

- **WI-106** (Fragment System) - COMPLETED - This work item addresses the VS Code tooling gap that remained after fragment implementation

## Related Work Items

- WI-038: Build VS Code extension with syntax highlighting (original extension creation)
- WI-094: VS Code Extension Updates (step syntax TextMate updates)

## Notes

This is a high-priority bug fix because it causes user confusion - the compiler accepts the syntax but VS Code shows errors, making it appear the files are invalid when they are not.

The diagnostics provider in the VS Code extension actually uses the compiler's Lezer parser for validation, so the real issue is:
1. TextMate grammar for syntax highlighting is out of sync
2. Users may have stale extension builds

### Quick Workaround for Users

Until this is fixed, users can:
1. Rebuild the extension locally: `cd packages/vscode-extension && pnpm build && pnpm package`
2. Install the fresh `.vsix` file
3. If errors persist, check if it's TextMate highlighting (cosmetic) vs actual diagnostics (real parsing errors)
