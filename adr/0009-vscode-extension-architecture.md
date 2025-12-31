# ADR-0009: VS Code Extension Architecture

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WorkPipe is a DSL that compiles to GitHub Actions workflow YAML. To provide a productive authoring experience, we need editor support with syntax highlighting and diagnostic display. VS Code is the primary target editor due to its market share and the team's familiarity.

The project already has:
- A Lezer grammar (`packages/lang/src/workpipe.grammar`) with 70+ token types
- A diagnostic system with span-precise error reporting (`packages/compiler/src/diagnostic/`)
- A format function (`packages/compiler/src/format/`)

PROJECT.md Section 15 (Phase 9) explicitly lists "VS Code extension: syntax highlighting from Lezer grammar, diagnostics from compiler" as a deliverable.

We need to decide:
1. Where the extension lives in the monorepo
2. How to implement syntax highlighting (TextMate vs Lezer)
3. How to wire diagnostics (simple extension vs Language Server Protocol)
4. How to package and distribute the extension
5. What features to include in MVP vs defer to Phase 2

## Decision

### 1. Extension Location: `packages/vscode-extension/`

The extension will live at `packages/vscode-extension/` following the established monorepo pattern from ADR-0001.

Package structure:
```
packages/vscode-extension/
  .vscodeignore
  package.json              # Extension manifest + dependencies
  tsconfig.json             # Extends root config
  esbuild.mjs               # Bundle script
  src/
    extension.ts            # activate/deactivate entry point
    diagnostics.ts          # DiagnosticCollection management
  syntaxes/
    workpipe.tmLanguage.json
  language-configuration.json
  README.md
```

Package name: `@workpipe/vscode-extension`

### 2. Syntax Highlighting: TextMate Grammar

Syntax highlighting will use a TextMate grammar (`syntaxes/workpipe.tmLanguage.json`) rather than running the Lezer parser directly in the extension.

The TextMate grammar will cover:
- Keywords (`workflow`, `job`, `agent_job`, `cycle`, `on`, `needs`, `if`, `steps`, etc.)
- Strings (double-quoted `"..."`, triple-quoted `"""..."""`)
- Numbers and booleans
- Comments (line `//`, block `/* */`)
- Operators and punctuation
- Property names and identifiers

The grammar will be hand-written for MVP, kept synchronized with the Lezer grammar through code review. Automated generation from the Lezer grammar may be added later if drift becomes a problem.

### 3. Diagnostics Wiring: Simple Extension Pattern

For MVP, diagnostics will use a simple extension pattern without a Language Server:

```typescript
// Pseudocode for diagnostic flow
const diagnosticCollection = vscode.languages.createDiagnosticCollection('workpipe');

function updateDiagnostics(document: vscode.TextDocument) {
  const source = document.getText();
  const result = compile(source);  // Returns CompileResult with diagnostics

  const vsDiagnostics = result.diagnostics.map(d => {
    const range = spanToRange(d.span, source);
    const severity = mapSeverity(d.severity);
    const diagnostic = new vscode.Diagnostic(range, d.message, severity);
    diagnostic.code = d.code;
    if (d.hint) {
      diagnostic.relatedInformation = [/* ... */];
    }
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, vsDiagnostics);
}

// Trigger on save (debounced)
vscode.workspace.onDidSaveTextDocument(updateDiagnostics);
```

Diagnostic mapping:

| Compiler Field | VS Code Mapping |
|----------------|-----------------|
| `span.start/end` | `vscode.Range` via line/column conversion |
| `severity: "error"` | `vscode.DiagnosticSeverity.Error` |
| `severity: "warning"` | `vscode.DiagnosticSeverity.Warning` |
| `severity: "info"` | `vscode.DiagnosticSeverity.Information` |
| `code` | `diagnostic.code` |
| `message` | `diagnostic.message` |
| `hint` | `diagnostic.relatedInformation` |

### 4. Bundle Strategy: esbuild with Bundled Dependencies

The extension will bundle `@workpipe/lang` and `@workpipe/compiler` using esbuild, producing a self-contained extension that requires no global installation of WorkPipe.

Build configuration:
```javascript
// esbuild.mjs
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],  // Provided by VS Code runtime
  format: 'cjs',         // VS Code expects CommonJS
  platform: 'node',
  target: 'node18',
  sourcemap: true,
});
```

The `.vscodeignore` will exclude source files and node_modules, keeping the published extension small.

### 5. Activation: `onLanguage:workpipe`

The extension will activate when a `.workpipe` or `.wp` file is opened:

```json
{
  "activationEvents": [],
  "contributes": {
    "languages": [{
      "id": "workpipe",
      "aliases": ["WorkPipe", "workpipe"],
      "extensions": [".workpipe", ".wp"],
      "configuration": "./language-configuration.json"
    }]
  }
}
```

Note: Modern VS Code infers activation from `contributes.languages`, so explicit `activationEvents` can be empty. The extension activates lazily when a workpipe file is opened.

### 6. MVP Scope Boundaries

**MVP (WI-038) includes:**
- Extension package structure and build pipeline
- TextMate syntax highlighting for all language constructs
- Language configuration (brackets, comments, auto-closing pairs)
- File association for `.workpipe` and `.wp` extensions
- Diagnostic display on save (errors and warnings as squiggles)
- Problems panel integration

**Phase 2 (future work items) defers:**
- Format on save integration
- Language Server Protocol implementation
- Hover information (type info, documentation)
- Go-to-definition for job/artifact references
- Code completion
- Semantic highlighting (type-aware coloring)
- Code actions (quick fixes)
- Rename symbol support

## Alternatives Considered

### Extension Location: `editor/vscode/`

**Pros**:
- Separates editor tooling from core packages
- Could accommodate other editors (Vim, Emacs) under `editor/`

**Cons**:
- Breaks established pattern from ADR-0001 (all packages in `packages/`)
- Requires updating `pnpm-workspace.yaml` with new path pattern
- Creates inconsistency in how workspace dependencies are declared

**Decision**: Rejected. Following the established `packages/` pattern is more important than anticipating future editors. If we add Vim/Emacs support, we can restructure then.

### Syntax Highlighting: Lezer Parser Directly

**Pros**:
- Single source of truth (Lezer grammar)
- Enables semantic highlighting in the same package
- Incremental parsing for large files

**Cons**:
- Requires bundling the Lezer runtime (~50KB)
- More complex activation and state management
- Overkill for syntax highlighting of a declarative DSL
- VS Code's native highlighting uses TextMate; Lezer requires custom token provider

**Decision**: Rejected for MVP. TextMate is sufficient for highlighting a keyword-based DSL. Lezer will be used in Phase 2 when we implement LSP with semantic features.

### Syntax Highlighting: Auto-generate TextMate from Lezer

**Pros**:
- Guaranteed synchronization between grammars
- No manual maintenance of two grammar files

**Cons**:
- Lezer and TextMate have different paradigms (LR parsing vs regex matching)
- Generated regexes may be suboptimal or incorrect
- Adds build complexity and a maintenance burden for the generator
- TextMate grammars have features (repository, includes) that don't map cleanly from Lezer

**Decision**: Rejected. Hand-written TextMate grammar with code review synchronization is simpler and more reliable for MVP. If drift becomes a problem, we can revisit.

### Diagnostics: Language Server Protocol from Day 1

**Pros**:
- Standard protocol, works with other editors
- Incremental document sync for performance
- Natural extension point for hover, completion, go-to-def

**Cons**:
- Significantly more infrastructure (separate server process, JSON-RPC, lifecycle management)
- Overkill for "compile on save and show errors"
- Delays MVP delivery
- We don't have hover/completion content to serve yet

**Decision**: Rejected for MVP. A simple extension with `DiagnosticCollection` is sufficient. LSP will be implemented in Phase 2 when we have semantic features worth serving.

### Bundle Strategy: Require Global Installation

**Pros**:
- Smaller extension package
- Uses same compiler version as CLI
- Avoids bundling complexity

**Cons**:
- Poor UX: user must install `@workpipe/cli` globally before extension works
- Version mismatches between extension and global install
- Complicates extension setup instructions

**Decision**: Rejected. Bundling provides a "just works" experience. The extension should be self-contained.

### Bundle Strategy: Webpack Instead of esbuild

**Pros**:
- More mature, more configuration options
- Better tree-shaking in some cases

**Cons**:
- Slower builds
- More complex configuration
- esbuild is sufficient for our needs and aligns with modern tooling

**Decision**: Rejected. esbuild is faster, simpler, and adequate for bundling a VS Code extension.

### Activation: `workspaceContains:**/*.workpipe`

**Pros**:
- Extension activates when workspace has workpipe files, even before opening one
- Could pre-warm compiler or show workspace-level diagnostics

**Cons**:
- Activates even if user never opens a workpipe file
- Unnecessary overhead for most use cases
- Glob matching on workspace open adds latency

**Decision**: Rejected. `onLanguage:workpipe` is more efficient and sufficient for our features.

## Consequences

### Positive

1. **Consistent monorepo structure**: Extension follows ADR-0001 patterns, making it easy to find and work with
2. **Fast time-to-MVP**: TextMate + simple diagnostics avoids infrastructure overhead
3. **Self-contained distribution**: Bundling means users install once and it works
4. **Clear upgrade path**: Phase 2 features (LSP) can be added without breaking MVP

### Negative

1. **Two grammar files**: TextMate and Lezer grammars must be kept in sync manually
2. **No semantic features in MVP**: Users don't get hover or go-to-definition initially
3. **Recompile on every save**: Without LSP incremental sync, we reparse the whole file
4. **Bundle size**: Extension includes compiler code, increasing download size (~1-2MB estimated)

### Neutral

1. **VS Code only for now**: Other editors are out of scope; this is acceptable given VS Code's market share
2. **Diagnostics on save only**: Real-time diagnostics while typing deferred to LSP phase

## References

- [ADR-0001: Monorepo Structure and Toolchain](0001-monorepo-structure-and-toolchain.md)
- [ADR-0003: Lezer Grammar Design and Expression Language](0003-lezer-grammar-design-and-expression-language.md)
- [ADR-0006: Diagnostic System Design and Error Reporting Strategy](0006-diagnostic-system-design-and-error-reporting-strategy.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [TextMate Language Grammars](https://macromates.com/manual/en/language_grammars)
- [VS Code Language Server Protocol](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- PROJECT.md Section 15, Phase 9: VS Code extension deliverable
- Lezer grammar: `packages/lang/src/workpipe.grammar`
- Diagnostic types: `packages/compiler/src/diagnostic/types.ts`
