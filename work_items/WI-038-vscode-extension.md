# Build VS Code Extension with Syntax Highlighting

**ID**: WI-038
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Build a VS Code extension for WorkPipe that provides syntax highlighting and real-time diagnostics. This is the first step in Milestone E (Tooling) and enables a proper developer experience for writing WorkPipe specs.

## Acceptance Criteria

- [x] VS Code extension package structure created
- [x] TextMate grammar for syntax highlighting covering all WorkPipe constructs
- [x] Language configuration for bracket matching and auto-closing
- [x] Real-time compiler diagnostics displayed as editor squiggles
- [x] Support for `.workpipe` and `.wp` file extensions
- [x] Extension tests with vscode module mocking
- [x] ADR documenting extension architecture

## Deliverables

### Documentation
- ADR-0009: VS Code Extension Architecture
- ARCHITECTURE.md updated with Editor Integration section

### Package Structure
- `packages/vscode-extension/` - Full extension package
- `package.json` - Extension manifest with language contribution
- `tsconfig.json`, `esbuild.mjs`, `vitest.config.ts`

### Language Support
- `syntaxes/workpipe.tmLanguage.json` - TextMate grammar covering:
  - All keywords (workflow, job, agent_job, cycle, etc.)
  - Double-quoted and triple-quoted strings
  - Numbers, booleans
  - Line and block comments
  - Punctuation and operators
- `language-configuration.json` - Bracket matching, auto-closing

### Extension Source
- `src/extension.ts` - Activation with document event subscriptions
- `src/diagnostics.ts` - Real-time compiler diagnostics

### Tests
- Extension tests with vscode module mocking
- 9 new tests for extension functionality

## Technical Context

The extension leverages:
- Diagnostic system (WI-044) for error/warning reporting
- Compiler's `compile()` function for real-time validation
- TextMate grammar (separate from Lezer for VS Code compatibility)

## Dependencies

- WI-044: Diagnostic system (complete) - provides CompileResult with diagnostics
- WI-004: Lezer grammar (complete) - reference for language constructs

## Files Created

- `packages/vscode-extension/package.json`
- `packages/vscode-extension/tsconfig.json`
- `packages/vscode-extension/esbuild.mjs`
- `packages/vscode-extension/vitest.config.ts`
- `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json`
- `packages/vscode-extension/language-configuration.json`
- `packages/vscode-extension/src/extension.ts`
- `packages/vscode-extension/src/diagnostics.ts`
- `packages/vscode-extension/src/__tests__/extension.test.ts`

## Notes

- TextMate grammar is used instead of Lezer because VS Code's native syntax highlighting uses TextMate
- Real-time diagnostics update on document change with debouncing
- Extension can be published to VS Code Marketplace when ready
- This is the foundation for WI-039 (additional diagnostics display features)
