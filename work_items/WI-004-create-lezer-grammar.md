# Create Lezer Grammar for WorkPipe DSL

**ID**: WI-004
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A (Vertical slice)
**Phase**: 1 (Parser + AST + Formatter)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Create the Lezer grammar that defines the WorkPipe DSL syntax. This is the foundation of the compiler - all subsequent work depends on having a working parser. The grammar should support the core language constructs needed for Milestone A (vertical slice): workflow definition, triggers, jobs, and steps.

Lezer was chosen for its incremental parsing capabilities, excellent error recovery, and native support for editor tooling (syntax highlighting, code folding).

## Acceptance Criteria

- [x] Lezer grammar file created at `packages/lang/src/workpipe.grammar`
- [x] Grammar compiles successfully with `@lezer/generator`
- [x] Parser exported from `@workpipe/lang` package
- [x] Core constructs parseable:
  - [x] `workflow <name> { ... }` top-level block
  - [x] `on:` trigger declarations (push, pull_request, workflow_dispatch)
  - [x] `job <name> { ... }` blocks
  - [x] `runs_on:` runner specification
  - [x] `needs:` job dependencies
  - [x] `if:` conditional expressions
  - [x] `steps:` array with `run()` and `uses()` calls
- [x] String literals (single-quoted, double-quoted, triple-quoted `"""`)
- [x] Comments (single-line `//` and multi-line `/* */`)
- [x] Identifiers and dotted paths (e.g., `github.ref`)
- [x] Basic error recovery (parser continues after syntax errors)
- [x] Unit tests for grammar covering valid and invalid inputs
- [x] Build script integrates grammar generation into package build

## Technical Context

### From PROJECT.md

Section 2.5 (Lezer as parser foundation):
> Lezer is built for incremental parsing and editor tooling; its generator + grammar format is designed for real language tooling, not "toy regex parsing."

Section 11.3 (Lezer grammar strategy):
> - Keep grammar relatively small; push complexity into semantic phase.
> - Use explicit keywords to avoid ambiguous parse states.
> - Make whitespace/comments liberal.
> - Preserve string blocks (`"""..."""`) for prompts/scripts.
> - Strong error recovery so we can emit diagnostics even with partially typed files.

### Syntax Examples to Support

**Minimal workflow** (`examples/minimal/minimal.workpipe`):
```workpipe
workflow minimal {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo Hello, WorkPipe!")
    ]
  }
}
```

**Simple job with dependencies** (`examples/simple-job/simple-job.workpipe`):
```workpipe
workflow simple_job {
  on: [push, pull_request]

  job build {
    runs_on: ubuntu-latest
    steps: [
      uses("actions/checkout@v4"),
      run("npm install"),
      run("npm test")
    ]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    if: github.ref == "refs/heads/main"
    steps: [
      uses("actions/checkout@v4"),
      run("npm run deploy")
    ]
  }
}
```

### Grammar Structure Guidance

The grammar should define these node types (approximate):

```
@top Workflow { "workflow" Identifier Block }

Block { "{" statement* "}" }

statement {
  TriggerDecl |
  JobDecl |
  PropertyAssignment
}

TriggerDecl { "on:" TriggerValue }
TriggerValue { Identifier | Array }

JobDecl { "job" Identifier Block }

PropertyAssignment { PropertyName ":" Value }
PropertyName { "runs_on" | "needs" | "if" | "steps" }

Value { String | Identifier | Array | Expression | FunctionCall }

FunctionCall { Identifier "(" ArgList? ")" }
Array { "[" (Value ("," Value)*)? "]" }

String { DoubleQuotedString | SingleQuotedString | TripleQuotedString }
```

### Required Dependencies

Add to `packages/lang/package.json`:
- `@lezer/lr` - Runtime parser
- `@lezer/generator` - Grammar compiler (devDependency)

### Build Integration

The grammar compilation should be part of the build process:
1. `@lezer/generator` compiles `workpipe.grammar` to `workpipe.grammar.js`
2. TypeScript compiles the rest of the package
3. Parser is exported for use by `@workpipe/compiler`

## Dependencies

- WI-001: Monorepo structure (complete)
- WI-003: Testing infrastructure (complete)

## Notes

- Start with a minimal grammar that handles the example fixtures
- Error recovery is critical for editor integration - invest time here
- The grammar should be liberal with whitespace and newlines
- Triple-quoted strings (`"""..."""`) are important for inline scripts and prompts
- Dotted identifiers (e.g., `github.ref`, `steps.build.outputs.result`) need careful handling
- Consider using Lezer's `@external` tokens for complex string handling if needed
- The `@workpipe/lang` package should export both the parser and node type constants
- Test with intentionally malformed input to verify error recovery

## References

- Lezer documentation: https://lezer.codemirror.net/docs/guide/
- Lezer grammar reference: https://lezer.codemirror.net/docs/ref/#lr.ParserConfig
- Example grammars: https://github.com/lezer-parser (JavaScript, JSON, etc.)
