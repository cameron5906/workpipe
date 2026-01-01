# WI-094: VS Code Extension Updates for Step Syntax

**ID**: WI-094
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: Step Syntax Improvements (ADR-0013)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Update the VS Code extension to support the new step syntax from ADR-0013 (ACCEPTED). This includes:

1. **TextMate grammar updates** for `shell { }` blocks
2. **Embedded shell syntax highlighting** inside shell blocks
3. **Diagnostics** for new syntax errors
4. **Hover information** for new keywords
5. **Code actions/quick fixes** if applicable

### New Syntax to Support

```workpipe
steps {
  shell {
    pnpm install
    pnpm build
  }

  shell { echo "Single line" }

  uses("actions/checkout@v4") {
    with: { ref: "main" }
  }
}
```

## Acceptance Criteria

### TextMate Grammar

- [x] Add `shell` keyword highlighting
- [x] Add `steps` block pattern (not just `steps:` property)
- [x] Add embedded shell highlighting inside `shell { }` blocks
- [x] Add `uses() { }` block pattern with proper scoping

### Syntax Highlighting

- [x] `shell` keyword highlighted as keyword.control
- [x] Content inside `shell { }` highlighted as embedded shell (source.shell)
- [x] Braces of shell blocks highlighted appropriately
- [x] `with:` inside `uses() { }` highlighted as property

### Diagnostics

- [x] Diagnostics correctly report errors in new syntax
- [x] Source spans point to correct locations in shell blocks
- [x] Error messages are clear for malformed shell blocks

### Hover Provider

- [x] Hover on `shell` keyword shows documentation
- [x] Hover on `steps` block shows step count and types

### Tests

- [x] TextMate grammar tests for shell block highlighting
- [x] TextMate grammar tests for uses block highlighting
- [x] Diagnostic display tests for new syntax
- [x] Hover tests for new keywords

## Technical Context

### TextMate Grammar Updates

Add to `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json`:

```json
{
  "name": "meta.step.shell.workpipe",
  "begin": "\\b(shell)\\s*(\\{)",
  "beginCaptures": {
    "1": { "name": "keyword.control.shell.workpipe" },
    "2": { "name": "punctuation.definition.block.begin.workpipe" }
  },
  "end": "(\\})",
  "endCaptures": {
    "1": { "name": "punctuation.definition.block.end.workpipe" }
  },
  "contentName": "source.shell.embedded.workpipe",
  "patterns": [
    { "include": "source.shell" }
  ]
}
```

For proper embedded shell highlighting, the extension may need to:
1. Depend on a shell grammar extension
2. Or include basic shell patterns inline

### Brace Matching

The language configuration should already handle brace matching for `{ }`. Verify:

```json
{
  "brackets": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" }
  ]
}
```

### Hover Provider Updates

Add to `packages/vscode-extension/src/hover.ts`:

```typescript
const KEYWORD_DOCS: Record<string, string> = {
  // ... existing keywords ...
  shell: "Defines a shell command block. Content is executed as a shell script.",
  steps: "Contains the list of steps for a job. Can be an array or block syntax.",
};

// Handle shell keyword hover
if (word === "shell") {
  return new vscode.Hover([
    "**shell** - Shell Command Block",
    "",
    "Execute shell commands directly without string quoting.",
    "",
    "```workpipe",
    "shell {",
    "  pnpm install",
    "  pnpm build",
    "}",
    "```",
  ].join("\n"));
}
```

### Related Files

- `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json` - TextMate grammar
- `packages/vscode-extension/language-configuration.json` - Language config
- `packages/vscode-extension/src/hover.ts` - Hover provider
- `packages/vscode-extension/src/diagnostics.ts` - Diagnostic provider
- `packages/vscode-extension/src/__tests__/` - Extension tests

### Related ADRs

- ADR-0009: VS Code Extension Architecture
- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- **WI-091**: Grammar - Steps Block and Shell Keyword
- **WI-092**: AST and Parser Updates
- **WI-093**: Codegen - Indentation Stripping

Note: Extension updates can partially proceed in parallel with WI-093 since TextMate grammar is independent of codegen.

## Notes

### Embedded Shell Highlighting

VS Code TextMate grammars can include external grammars. For shell highlighting:

1. **Option A**: Use `"include": "source.shell"` if shellscript extension is installed
2. **Option B**: Include basic shell patterns inline in workpipe.tmLanguage.json
3. **Option C**: Use `embeddedLanguages` in package.json to request shell grammar

Recommend Option A with graceful fallback to plain text if shell grammar unavailable.

### Testing Embedded Highlighting

TextMate grammar testing is limited. Consider:
1. Visual verification with sample files
2. Token scope inspection via VS Code Developer Tools
3. Snapshot tests of tokenized output (if tooling supports)

### Scope Naming Conventions

Follow TextMate naming conventions:
- `keyword.control.shell.workpipe` for `shell` keyword
- `source.shell.embedded.workpipe` for shell content
- `meta.step.shell.workpipe` for the entire shell step block
