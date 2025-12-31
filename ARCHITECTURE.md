# WorkPipe Architecture

This document describes the current architecture of WorkPipe, a domain-specific language (DSL) that compiles to GitHub Actions workflow YAML files. It reflects the "how it works today" view and links to ADRs for detailed rationale.

**Last Updated**: 2025-12-31
**Status**: Milestone A implementation in progress

---

## Overview

WorkPipe is a compiler that transforms `.workpipe` source files into ready-to-commit `.github/workflows/*.yml` files. The system provides:

- A workflow-first authoring model with typed inputs/outputs
- First-class support for agentic tasks (Claude Code GitHub Action)
- Strategy B cycle compilation (multi-run loops via workflow_dispatch)
- Guard abstractions for complex conditional logic
- Matrix support with artifact naming safety

---

## Package Structure

The codebase is organized as a TypeScript monorepo using pnpm workspaces. See [ADR-0001](adr/0001-monorepo-structure-and-toolchain.md) for the rationale behind this structure.

```
workpipe/
  packages/
    lang/           # Lezer grammar and parser generation
    compiler/       # AST, type checking, cycle lowering, YAML emission
    cli/            # Command-line interface (build, check, fmt)
    action/         # GitHub Action wrapper for CI integration
  examples/         # Sample specs and golden test fixtures
  adr/              # Architecture Decision Records
```

### Package Responsibilities

#### `@workpipe/lang`
- Lezer grammar definition (`workpipe.grammar`)
- Generated parser tables
- Syntax highlighting metadata for editor tooling
- **Dependencies**: `@lezer/lr`, `@lezer/generator` (dev)
- **Consumers**: `@workpipe/compiler`

#### `@workpipe/compiler`
- CST to AST transformation with source spans
- Name resolution and symbol tables
- Type checking for inputs, outputs, and artifacts
- Dependency graph construction
- Cycle detection (SCC analysis) and Strategy B lowering
- YAML IR generation and emission
- Diagnostic system with error codes (WPxxxx)
- **Dependencies**: `@workpipe/lang`, `yaml`
- **Consumers**: `@workpipe/cli`, `@workpipe/action`

#### `@workpipe/cli`
- Command-line entry point (`workpipe` binary)
- Commands: `build`, `check`, `fmt`
- File discovery and glob pattern handling
- Human-readable diagnostic output
- **Dependencies**: `@workpipe/compiler`, `commander`
- **Consumers**: End users, CI systems

#### `@workpipe/action`
- GitHub Action wrapper (`action.yml`)
- Invokes compiler in CI context
- Outputs compilation status and diagnostics
- **Dependencies**: `@workpipe/compiler`, `@actions/core`
- **Consumers**: GitHub Actions workflows

### Dependency Flow

```
@workpipe/lang
      |
      v
@workpipe/compiler
      |
      +-----------+
      |           |
      v           v
@workpipe/cli   @workpipe/action
```

---

## Grammar Design

The WorkPipe grammar is implemented using [Lezer](https://lezer.codemirror.net/), a parser system designed for editor tooling. See [ADR-0003](adr/0003-lezer-grammar-design-and-expression-language.md) for detailed rationale behind grammar design decisions.

### Grammar Location

- **Source**: `packages/lang/src/workpipe.grammar`
- **Generated**: `packages/lang/src/parser.js` (Lezer parser tables)
- **Build**: `pnpm build:grammar` compiles grammar to parser

### Reserved Keywords

The following keywords are reserved and cannot be used as identifiers:

```
after        agent_job    agent_task   as           axes
body         consumes     cycle        emit         emits
env          false        from         guard_js     if
import       inputs       job          key          matrix
max_iters    mcp          model        needs        on
output_artifact           output_schema outputs     prompt
raw_yaml     run          runs_on      step         steps
system_prompt tools       triggers     true         until
uses         when         workflow
```

Note: `import`, `from`, and `as` are reserved for the import system (see [ADR-0012](adr/0012-import-system.md)).

### String Syntax

Three string forms are supported:

| Form | Syntax | Use Case |
|------|--------|----------|
| Double-quoted | `"string"` | Simple strings, action references |
| Triple-quoted | `"""multi-line"""` | Scripts, prompts, guard JavaScript |
| Template | `template("{{var}}")` | Strings with interpolation |

Triple-quoted strings preserve whitespace and do not process escapes. Template strings support `{{expression}}` interpolation.

### Expression Language

Condition expressions (`if:`, `when`, `until`) are parsed as structured AST, enabling:
- Type checking of referenced outputs and artifacts
- IDE features (go-to-definition, hover)
- Compile-time validation

Supported expression constructs:
- Member access: `github.ref`, `needs.build.outputs.status`
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`, `!`
- Literals: strings, numbers, booleans
- Function calls: `contains()`, `startsWith()`, etc.
- Arrays: `[a, b, c]`

### Error Recovery

The grammar implements Lezer error recovery for editor resilience:
- Delimiter detection for `{}`, `[]`, `()`
- Synchronization at `workflow`, `job`, `step` keywords
- Partial CST output for incomplete input

This enables real-time diagnostics while typing in editors.

### Cycle Syntax

Cycles enable iterative workflows spanning multiple GitHub Actions runs. See [ADR-0007](adr/0007-cycle-syntax-and-guard-block-design.md) for detailed design rationale.

**Basic structure:**

```workpipe
cycle refine {
  max_iters = 10
  key = "refinement-${github.run_id}"

  until guard_js """
    return state.quality_score > 0.95;
  """

  body {
    job analyze { ... }
    agent_job improve { ... }
    job evaluate { ... }
  }
}
```

**Cycle configuration properties** (use `=` syntax):

| Property | Required | Description |
|----------|----------|-------------|
| `max_iters` | One of these | Hard iteration limit (safety rail) |
| `until` | required | Convergence predicate (guard_js block) |
| `key` | Optional | Concurrency group identifier |

**Property syntax distinction:**
- Cycle configuration uses `=` (e.g., `max_iters = 10`)
- Job/step properties use `:` (e.g., `runs_on: ubuntu-latest`)

This visual distinction signals different semantics: configuration vs. structure.

**Guard JS blocks:**
- Must use triple-quoted strings: `guard_js """..."""`
- Content is captured verbatim (opaque to compiler)
- Executed at runtime by Node.js in the generated workflow
- Must return a boolean value

**Constraints:**
- Nested cycles are not allowed (error WP6002)
- Cycles must have `max_iters` or `until` or both (error WP6001)
- Missing `key` emits a warning (WP4001) with derived default

---

## Compiler Pipeline

The compiler transforms WorkPipe source through the following stages:

```
Source (.workpipe)
      |
      v
[1. Parse]          Lezer parser -> CST with spans
      |
      v
[2. AST Build]      CST -> Typed AST nodes
      |
      v
[3. Name Binding]   Symbol tables for workflows, jobs, types, artifacts
      |
      v
[4. Type Check]     Unify types, validate contracts
      |
      v
[5. Graph Build]    Construct dependency graph (needs, guards, artifacts)
      |
      v
[6. Cycle Lower]    Strategy B transformation for cyclic components
      |
      v
[7. YAML IR]        Lower to YAML-shaped intermediate representation
      |
      v
[8. Emit]           Deterministic YAML output
      |
      v
Output (.github/workflows/*.yml)
```

Each stage produces diagnostics that include:
- Error code (WPxxxx)
- Source span (file, line, column)
- Message with suggested fix

### Milestone A Pipeline

For the initial vertical slice, stages 3-6 are deferred. The simplified pipeline is:

```
Source -> [Parse] -> [AST Build] -> [Transform] -> [Emit] -> YAML
```

This enables end-to-end compilation of simple workflows without the full semantic analysis infrastructure.

---

## Code Generation

The code generation phase transforms the typed AST into GitHub Actions workflow YAML. See [ADR-0004](adr/0004-yaml-ir-design-and-emission-strategy.md) for detailed rationale behind these design decisions.

### Three-Layer Architecture

Code generation is structured as three distinct layers:

```
AST (WorkflowNode)
        |
        v
   [Transform]    AST -> IR conversion, expression serialization
        |
        v
   YAML IR        Intermediate representation mirroring GHA structure
        |
        v
     [Emit]       IR -> YAML string serialization
        |
        v
   YAML String
```

### Module Organization

```
packages/compiler/src/codegen/
  yaml-ir.ts      # IR type definitions
  transform.ts    # AST-to-IR transformation
  emit.ts         # IR-to-YAML emission
  index.ts        # Public exports
```

### YAML IR Types

The IR mirrors GitHub Actions workflow structure:

```typescript
interface WorkflowIR {
  name: string;
  on: TriggerIR;
  jobs: Map<string, JobIR>;  // Preserves insertion order
}

interface JobIR {
  runsOn: string;
  needs?: string[];
  condition?: string;  // Serialized GHA expression
  steps: StepIR[];
}

type StepIR = RunStepIR | UsesStepIR;
```

### Expression Serialization

AST expression nodes are serialized to GitHub Actions expression strings during the transform phase:

| AST Node | Output |
|----------|--------|
| `PropertyAccessNode { path: ["github", "ref"] }` | `github.ref` |
| `StringLiteralNode { value: "refs/heads/main" }` | `'refs/heads/main'` |
| `BinaryExpressionNode { op: "==" }` | `left == right` |

String literals use single quotes in expressions (GitHub Actions convention).

### Trigger Normalization

Triggers are stored uniformly as arrays in IR; the emitter decides output format:

| Event Count | IR | YAML Output |
|-------------|-----|-------------|
| Single | `["push"]` | `on: push` |
| Multiple | `["push", "pull_request"]` | `on: [push, pull_request]` |

### Deterministic Output

The emitter guarantees deterministic, reproducible output:

- Jobs appear in source order (Map insertion order)
- Steps appear in source order
- No automatic line wrapping
- Plain scalar style for commands
- Trailing newline (POSIX compliance)

### Public API

```typescript
import { compile } from "@workpipe/compiler";

const yaml = compile(workpipeSource);
// Throws CompileError on failure
// Returns YAML string with trailing newline on success
```

---

## Strategy B Cycle Compilation

GitHub Actions job graphs must be acyclic. WorkPipe supports cycles through Strategy B: multi-run phased execution via `workflow_dispatch` self-dispatch. See [ADR-0007](adr/0007-cycle-syntax-and-guard-block-design.md) for syntax design and [ADR-0008](adr/0008-strategy-b-cycle-lowering-and-phased-execution.md) for lowering implementation.

### How It Works

One workflow run equals one iteration. At the end of each iteration, the workflow dispatches itself with updated loop state.

### Generated Job Structure

Each `cycle` block compiles to four jobs (named `<cycle_name>_<phase>`):

1. **cycle_hydrate**: Downloads prior state artifact (skipped on iteration 0)
2. **cycle_body_***: The jobs defined in the cycle's `body {}` block
3. **cycle_decide**: Evaluates `guard_js` termination condition, emits continue/done outputs
4. **cycle_dispatch**: Triggers next iteration via `gh workflow run` (if not terminated)

### Workflow Dispatch Inputs

Cycles inject three underscore-prefixed inputs to avoid collision with user inputs:

| Input | Description |
|-------|-------------|
| `_cycle_phase` | Iteration number ("0" = initial run) |
| `_cycle_key` | Concurrency group identifier |
| `_cycle_prev_run_id` | Previous run ID for artifact download |

### State Passing

State is passed between iterations via JSON artifacts:
- Artifact naming: `workpipe-state-<cycle_name>-iter-<N>-run-<run_id>`
- Cross-run downloads require `actions: read` permission
- State schema includes iteration, key, prevRunId, done, maxIters, and captured outputs

### Guard JS Execution

The `guard_js` termination predicate runs inline in a Node.js step:
- Receives `state` object with iteration info and captured outputs
- Must return boolean (truthy = terminate, falsy = continue)
- `max_iters` check is enforced regardless of guard result

### Safety Rails

Compile-time requirements:
- `max_iters` or `until` is mandatory (WP6001 error if missing)
- Nested cycles are disallowed (WP6002 error)

Runtime enforcement:
- Iteration counter tracked in `_cycle_phase` input
- `max_iters` enforced in `cycle_decide` guard evaluation
- Concurrency group prevents overlapping runs: `group: ${{ inputs._cycle_key }}`

### Token Requirements

The generated workflow requires:
- `actions: write` - For `gh workflow run` dispatch
- `actions: read` - For cross-run artifact download

See [ADR-0008](adr/0008-strategy-b-cycle-lowering-and-phased-execution.md) for complete generated YAML example.

---

## Typed Parameter Passing

WorkPipe enforces typed data flow between jobs. See [ADR-0010](adr/0010-type-system-for-data-flow.md) for primitive types and [ADR-0011](adr/0011-user-defined-type-declarations.md) for user-defined types.

### Job Outputs (Small Values)
- Scalars passed via `needs.<job>.outputs.<name>`
- Compiler generates `GITHUB_OUTPUT` write steps
- Type information preserved in AST for validation

### Artifacts (Structured Data)
- JSON blobs and files passed via artifacts
- Unique naming prevents v4 immutability collisions:
  - Pattern: `wp.<workflow>.<job>.<artifact>.<run_attempt>.<matrix_fingerprint?>`
- Compiler generates upload/download steps automatically

### Agent Task Outputs
- Claude Code structured output written to known file path
- Schema validation via `--json-schema` flag
- Output uploaded as artifact for downstream consumption

### User-Defined Types

User-defined types enable complex JSON shapes to be declared once and reused across job outputs and agent task schemas. See [ADR-0011](adr/0011-user-defined-type-declarations.md) for detailed design.

**Syntax**:
```workpipe
type BuildInfo {
  version: string
  commit: string
  artifacts: [{
    name: string
    path: string
  }]
}

workflow ci {
  job build {
    outputs: {
      info: BuildInfo  // Reference by name
    }
  }

  agent_job review {
    agent_task "analyze" {
      output_schema: BuildInfo  // Also usable in schemas
    }
  }
}
```

**Key design decisions**:
- **Placement**: Types declared at file level, before workflow blocks
- **Typing model**: Structural typing (same shape = compatible)
- **JSON Schema**: Compiler generates JSON Schema from type definitions
- **Property validation**: Expressions like `needs.build.outputs.info.version` are validated against the type structure

**Diagnostic codes**:
| Code | Description |
|------|-------------|
| WP5001 | Undefined type reference |
| WP5002 | Type name shadows built-in type |
| WP5003 | Property does not exist on type |
| WP5004 | Declared type is never used |
| WP5005 | Duplicate type declaration |

### Import System (Planned)

The import system enables sharing type definitions across multiple workflow files. See [ADR-0012](adr/0012-import-system.md) for detailed design and implementation guidance.

**Syntax**:
```workpipe
// Named imports
import { BuildInfo, DeployResult } from "./types.workpipe"

// Aliased imports
import { BuildInfo as BI } from "./types.workpipe"

// Multiple imports from same file
import {
  BuildInfo,
  DeployResult,
  TestSummary
} from "./shared/types.workpipe"

workflow ci {
  job build {
    outputs: { info: BuildInfo }  // Use imported type
  }
}
```

**Key design decisions**:
- **Named imports only**: Explicit `{ Type } from "path"` syntax
- **Relative paths**: Paths resolved from importing file's directory
- **Non-transitive**: Only types declared in target file are importable
- **Implicit exports**: All types are automatically exportable (no `export` keyword)
- **No index files**: Must specify full path including filename

**Path resolution rules**:
- Paths must start with `./` or `../`
- Paths must end with `.workpipe`
- Absolute paths are rejected (error WP7006)
- Paths escaping project root are rejected (error WP7007)

**Import diagnostic codes**:
| Code | Severity | Description |
|------|----------|-------------|
| WP7001 | Error | Circular import detected |
| WP7002 | Error | Import file not found |
| WP7003 | Error | Type not exported by imported file |
| WP7004 | Error | Duplicate import of same type |
| WP7005 | Warning | Unused import |
| WP7006 | Error | Invalid import path (absolute path) |
| WP7007 | Error | Import path resolves outside project root |

**Compiler pipeline impact**:
```
Source -> Parse -> AST
                    |
                    v
             [Import Resolution]
                    |
       +------------+------------+
       |            |            |
       v            v            v
  Parse Dep 1   Parse Dep 2   ... (parallel)
       |            |
       v            v
    Merge Type Registries
               |
               v
        Semantics -> Transform -> Emit
```

Files containing only type declarations (no workflows) produce no YAML output but are parsed and validated for their dependents.

---

## Build System

### TypeScript Configuration

- Base config at `tsconfig.base.json` with shared options
- Each package extends base with local overrides
- Project references enable incremental compilation
- Target: ES2022 (Node 20 compatibility)
- Module: NodeNext (native ESM)

### Development Workflow

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (respects references)
pnpm test             # Run tests across workspace
pnpm lint             # Lint all packages
```

### Testing Strategy

This project uses Vitest for testing with v8 coverage reporting.

#### Test File Conventions

- **Location**: Test files are co-located in `__tests__/` directories within each package's `src/`
- **Naming**: Test files use the `.test.ts` extension (e.g., `parser.test.ts`)
- **Structure**: Tests use `describe`/`it` blocks with descriptive names

```
packages/
  compiler/
    src/
      __tests__/
        placeholder.test.ts
        parser.test.ts
        typechecker.test.ts
      index.ts
```

#### Test Types

- **Unit tests**: Vitest, co-located in `__tests__/` directories
- **Golden tests**: Input `.workpipe` -> expected `.yml` comparison
- **Negative tests**: Organized by error code (WPxxxx)
- **Integration tests**: Run generated workflows in sandbox

#### Golden Test Framework

The compiler package exports a golden test framework for comparing compiler output against expected results:

```typescript
import { runGoldenTest, listFixtures } from "@workpipe/compiler/testing";

// Run a single golden test
await runGoldenTest({
  fixturePath: "examples/minimal",
  inputName: "minimal.workpipe",  // Optional, defaults to <dirname>.workpipe
  expectedName: "expected.yml",   // Optional, defaults to expected.yml
});

// Update snapshots by setting environment variable
// WORKPIPE_UPDATE_SNAPSHOTS=true pnpm test
```

Fixtures are located in `examples/` directory with structure:
```
examples/
  minimal/
    minimal.workpipe
    expected.yml
  simple-job/
    simple-job.workpipe
    expected.yml
```

#### Coverage Requirements

Coverage thresholds are configured per-package in `vitest.config.ts`:

| Package | Threshold |
|---------|-----------|
| `@workpipe/compiler` | 80% |
| `@workpipe/lang` | 60% |
| `@workpipe/cli` | 60% |
| `@workpipe/action` | 60% |

Coverage reports are generated in three formats:
- `text`: Console output
- `json`: Machine-readable JSON
- `lcov`: For CI integration and code coverage services

#### CI Integration

The project uses GitHub Actions for continuous integration (`.github/workflows/ci.yml`):

- **Triggers**: Push and pull request to `main` branch
- **Environment**: Ubuntu Linux, Node.js 20
- **Steps**:
  1. Install dependencies (`pnpm install --frozen-lockfile`)
  2. Build all packages (`pnpm build`)
  3. Run linter (`pnpm lint`)
  4. Run tests with coverage (`pnpm test -- --coverage`)
  5. Upload coverage to Codecov

#### Running Tests

```bash
pnpm test                    # Run all tests
pnpm test -- --coverage      # Run with coverage
pnpm test -- --watch         # Watch mode

# Update golden test snapshots
WORKPIPE_UPDATE_SNAPSHOTS=true pnpm test
```

---

## File Conventions

### Source Files
- Extension: `.workpipe` (primary) or `.wp` (alias)
- Location: Project root or `workpipe/` directory
- One file = one workflow

### Generated Files
- Location: `.github/workflows/`
- Naming: Derived from workflow name (kebab-case)
- Deterministic output for stable diffs

### Configuration
- `workpipe.config.js` (future): Project-level configuration

---

## CLI Contract

The `@workpipe/cli` package provides the primary user interface for WorkPipe. See [ADR-0002](adr/0002-cli-command-interface-and-exit-codes.md) for detailed rationale behind these decisions.

### Commands

#### `workpipe build [files...]`

Compiles WorkPipe source files into GitHub Actions workflow YAML.

```bash
workpipe build                           # Build all *.workpipe/*.wp files
workpipe build src/ci.workpipe           # Build specific file
workpipe build "src/**/*.workpipe"       # Build with glob pattern
workpipe build -o dist/workflows         # Custom output directory
workpipe build --dry-run                 # Preview without writing
workpipe build --watch                   # Rebuild on changes
workpipe build --verbose                 # Detailed output
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--output <dir>` | `-o` | `.github/workflows/` | Output directory |
| `--watch` | `-w` | `false` | Watch mode |
| `--dry-run` | | `false` | Preview only |
| `--verbose` | `-v` | `false` | Detailed output |

#### `workpipe check [files...]`

Validates source files without producing output. Ideal for CI gates and pre-commit hooks.

```bash
workpipe check                           # Check all files
workpipe check src/ci.workpipe           # Check specific file
workpipe check --verbose                 # Detailed validation output
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--verbose` | `-v` | `false` | Detailed output |

#### `workpipe fmt [files...]`

Formats source files for consistent style.

```bash
workpipe fmt                             # Print formatted to stdout
workpipe fmt --write                     # Format files in place
workpipe fmt --check                     # Check if formatting needed (CI)
```

| Option | Default | Description |
|--------|---------|-------------|
| `--write` | `false` | Write formatted output back to files |
| `--check` | `false` | Exit with error if formatting needed |

### Exit Codes

| Code | Name | Meaning |
|------|------|---------|
| 0 | `SUCCESS` | Operation completed successfully |
| 1 | `ERROR` | Runtime error, internal error, or invalid usage |
| 2 | `VALIDATION_FAILURE` | Source validation failed or formatting needed |

Exit code 2 indicates "the tool worked correctly but found problems with the input." This enables CI scripts to distinguish tool failures from source issues.

### File Discovery

When no file arguments are provided, WorkPipe searches recursively for:
- `**/*.workpipe` (primary extension)
- `**/*.wp` (alias extension)

Excluded directories: `node_modules/`, `.git/`, `dist/`, `build/`, `.github/workflows/`

Explicit glob patterns should be quoted to prevent shell expansion:
```bash
workpipe build "src/**/*.workpipe"       # Correct
workpipe build src/**/*.workpipe         # Shell may expand incorrectly
```

### Output Path Derivation

Output filenames are derived from the workflow name in the source, not the input filename:

```
Input:  src/pipelines/deploy.workpipe
        workflow deploy_production { ... }

Output: .github/workflows/deploy-production.yml
```

Rules:
1. Workflow name determines output filename
2. Names are converted to kebab-case
3. Extension is always `.yml`
4. Input directory structure is not preserved

### Verbose and Dry-Run Output

- Verbose output (`--verbose`) goes to stderr to keep stdout clean
- Dry-run (`--dry-run`) performs full compilation but writes nothing
- Both options can be combined: `workpipe build --dry-run --verbose`

---

## Diagnostics

The diagnostic system provides comprehensive error reporting throughout the compilation pipeline. See [ADR-0006](adr/0006-diagnostic-system-design-and-error-reporting-strategy.md) for detailed design rationale.

### Diagnostic Structure

```typescript
interface Diagnostic {
  code: string;        // WPxxxx format
  severity: "error" | "warning" | "info";
  message: string;
  span: Span;
  hint?: string;
  relatedSpans?: RelatedSpan[];
}
```

### Error Code Categories

| Range | Category | Description |
|-------|----------|-------------|
| WP1xxx | Parse errors | Malformed syntax, unexpected tokens |
| WP2xxx | Semantic errors | Undefined references, type mismatches, duplicates |
| WP3xxx | Codegen errors | Unsupported features, invalid configurations |
| WP4xxx | Warnings | Unused variables, deprecated syntax |
| WP5xxx | Artifact errors | Invalid artifact names, missing references |
| WP6xxx | Cycle errors | Invalid cycle configuration, termination issues |

### CompileResult Pattern

The compiler returns a discriminated union rather than throwing exceptions:

```typescript
type CompileResult<T> =
  | { success: true; value: T; diagnostics: Diagnostic[] }
  | { success: false; diagnostics: Diagnostic[] };
```

This enables:
- Collecting multiple diagnostics per file
- Returning warnings with successful compilation
- Continuing analysis after non-fatal errors
- Type-safe error handling in consumers

### CLI Output Format

Diagnostics are formatted for terminal display:

```
file:line:column: error[WPxxxx]: message

   15 | job deploy needs [build] {
      |                   ^^^^^ not found in this workflow

hint: Did you mean 'build_app'?
```

- Errors display in red, warnings in yellow
- Source snippets show context around the error
- Machine-readable JSON format available via `--format=json`

---

## Editor Integration

WorkPipe provides editor support through a VS Code extension. See [ADR-0009](adr/0009-vscode-extension-architecture.md) for detailed design decisions.

### VS Code Extension

The `@workpipe/vscode-extension` package provides:
- Syntax highlighting via TextMate grammar
- Diagnostic display (errors/warnings as squiggles)
- Language configuration (brackets, comments, auto-closing pairs)
- File association for `.workpipe` and `.wp` extensions

### Package Structure

```
packages/vscode-extension/
  src/
    extension.ts            # activate/deactivate entry point
    diagnostics.ts          # DiagnosticCollection management
  syntaxes/
    workpipe.tmLanguage.json  # TextMate grammar
  language-configuration.json
  package.json              # VS Code extension manifest
  esbuild.mjs               # Bundle script
```

### Syntax Highlighting

The extension uses a TextMate grammar for syntax highlighting, covering:
- Keywords (`workflow`, `job`, `agent_job`, `cycle`, etc.)
- Strings (double-quoted, triple-quoted)
- Numbers, booleans
- Comments (line `//`, block `/* */`)
- Operators and punctuation

The TextMate grammar is maintained separately from the Lezer grammar but kept synchronized through code review.

### Diagnostic Integration

The extension invokes the compiler on file save and maps `Diagnostic` objects to VS Code diagnostics:

| Compiler Field | VS Code Mapping |
|----------------|-----------------|
| `span.start/end` | `vscode.Range` via line/column conversion |
| `severity: "error"` | `DiagnosticSeverity.Error` |
| `severity: "warning"` | `DiagnosticSeverity.Warning` |
| `severity: "info"` | `DiagnosticSeverity.Information` |
| `code` | `diagnostic.code` |
| `message` | `diagnostic.message` |
| `hint` | `diagnostic.relatedInformation` |

### Bundle Strategy

The extension bundles `@workpipe/lang` and `@workpipe/compiler` using esbuild, producing a self-contained extension that requires no global installation. The `vscode` module is marked as external (provided by the VS Code runtime).

### MVP vs Phase 2

**MVP (current)**:
- Syntax highlighting
- Diagnostics on save
- File association

**Phase 2 (planned)**:
- Language Server Protocol implementation
- Format on save integration
- Hover information (type info)
- Go-to-definition for job/artifact references
- Code completion

---

## Related Documents

- [PROJECT.md](PROJECT.md): Full language and compiler design document
- [CLAUDE.md](CLAUDE.md): Condensed design reference for development
- [ADR-0001](adr/0001-monorepo-structure-and-toolchain.md): Monorepo structure and toolchain decisions
- [ADR-0002](adr/0002-cli-command-interface-and-exit-codes.md): CLI command interface and exit codes
- [ADR-0003](adr/0003-lezer-grammar-design-and-expression-language.md): Lezer grammar design and expression language
- [ADR-0004](adr/0004-yaml-ir-design-and-emission-strategy.md): YAML IR design and emission strategy
- [ADR-0005](adr/0005-agent-task-design-and-claude-code-integration.md): Agent task design and Claude Code integration
- [ADR-0006](adr/0006-diagnostic-system-design-and-error-reporting-strategy.md): Diagnostic system design and error reporting strategy
- [ADR-0007](adr/0007-cycle-syntax-and-guard-block-design.md): Cycle syntax and guard block design
- [ADR-0008](adr/0008-strategy-b-cycle-lowering-and-phased-execution.md): Strategy B cycle lowering and phased execution
- [ADR-0009](adr/0009-vscode-extension-architecture.md): VS Code extension architecture
- [ADR-0010](adr/0010-type-system-for-data-flow.md): Type system for task/job data flow
- [ADR-0011](adr/0011-user-defined-type-declarations.md): User-defined type declarations
- [ADR-0012](adr/0012-import-system.md): Import system for cross-file references

---

## Revision History

| Date | Change | ADR |
|------|--------|-----|
| 2025-12-30 | Initial architecture scaffold | ADR-0001 |
| 2025-12-30 | Added CLI Contract section | ADR-0002 |
| 2025-12-30 | Expanded Testing Strategy section | WI-003 |
| 2025-12-30 | Added Grammar Design section | ADR-0003 |
| 2025-12-30 | Added Code Generation section | ADR-0004 |
| 2025-12-30 | Expanded Diagnostics section with CompileResult pattern | ADR-0006 |
| 2025-12-30 | Expanded Strategy B Cycle Compilation section | ADR-0008 |
| 2025-12-30 | Added Cycle Syntax section, updated reserved keywords | ADR-0007 |
| 2025-12-30 | Added Editor Integration section for VS Code extension | ADR-0009 |
| 2025-12-31 | Added User-Defined Types section to Typed Parameter Passing | ADR-0011 |
| 2025-12-31 | Added Import System section to Typed Parameter Passing | ADR-0012 |
