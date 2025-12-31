# Project Structure Guide

This guide explains the WorkPipe repository structure for contributors and developers.

## Monorepo Overview

WorkPipe uses a pnpm workspace monorepo structure. All packages are located in the `packages/` directory and managed through the root `pnpm-workspace.yaml`.

```
workpipe/
├── packages/
│   ├── lang/           # @workpipe/lang - Parser and AST
│   ├── compiler/       # @workpipe/compiler - Compilation to YAML
│   ├── cli/            # @workpipe/cli - Command-line interface
│   ├── action/         # @workpipe/action - GitHub Action
│   └── vscode-extension/  # Editor support
├── examples/           # Example .workpipe files
├── docs/               # Documentation
└── .github/workflows/  # CI configuration
```

## Packages

### @workpipe/lang

**Purpose**: Core language parser and AST definitions

**Location**: `packages/lang/`

The foundation package that:
- Defines the Lezer grammar for the WorkPipe DSL (`workpipe.grammar`)
- Generates the parser using `@lezer/generator`
- Exports AST node types and parser utilities

**Key Dependencies**:
- `@lezer/common` - Lezer runtime
- `@lezer/lr` - LR parser infrastructure

**Build Notes**: This package has a special build process that generates grammar files before TypeScript compilation.

```bash
# Build grammar, then TypeScript, then copy artifacts
pnpm --filter @workpipe/lang build
```

---

### @workpipe/compiler

**Purpose**: Transform parsed AST into GitHub Actions YAML

**Location**: `packages/compiler/`

The compilation package that:
- Takes parsed WorkPipe syntax trees from `@workpipe/lang`
- Transforms them into GitHub Actions workflow YAML
- Handles semantic validation and error reporting
- Exposes testing utilities via the `@workpipe/compiler/testing` subpath

**Key Dependencies**:
- `@workpipe/lang` (workspace dependency)
- `yaml` - YAML serialization

**Exports**:
- Main entry: compilation functions
- `@workpipe/compiler/testing`: test helpers and fixtures

---

### @workpipe/cli

**Purpose**: Command-line interface for compiling WorkPipe files

**Location**: `packages/cli/`

Provides the `workpipe` command:
- `workpipe build <files>` - Compile `.workpipe` files to YAML
- Glob pattern support for batch compilation
- Output directory configuration

**Key Dependencies**:
- `@workpipe/lang` (workspace dependency)
- `@workpipe/compiler` (workspace dependency)
- `commander` - CLI argument parsing
- `glob` - File pattern matching

**Binary**: Installed as `workpipe` command when the package is linked or installed globally.

---

### @workpipe/action

**Purpose**: GitHub Action for compiling WorkPipe files in CI

**Location**: `packages/action/`

A GitHub Action that:
- Runs WorkPipe compilation as part of a workflow
- Integrates with GitHub Actions core libraries
- Enables automated workflow generation in CI/CD

**Key Dependencies**:
- `@workpipe/compiler` (workspace dependency)
- `@actions/core` - GitHub Actions toolkit

---

### vscode-extension

**Purpose**: VS Code editor support for WorkPipe files

**Location**: `packages/vscode-extension/`

**Package Name**: `workpipe-vscode` (not scoped, for VS Code Marketplace)

Provides:
- Syntax highlighting via TextMate grammar
- Language configuration (brackets, comments, etc.)
- Real-time diagnostics from the compiler

**File Extensions**: `.workpipe`, `.wp`

**Build**: Uses esbuild for fast bundling

```bash
# Build extension
pnpm --filter workpipe-vscode build

# Package for distribution
pnpm --filter workpipe-vscode package
```

## Development Workflow

### Prerequisites

- Node.js >= 20.0.0
- pnpm 9.x (specified in `packageManager` field)

### Setup

```bash
# Clone the repository
git clone https://github.com/workpipe/workpipe.git
cd workpipe

# Install dependencies
pnpm install
```

### Common Commands

All commands can be run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (TypeScript compilation) |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check formatting without changes |
| `pnpm clean` | Remove all `dist/` directories |

### Package-Specific Commands

Run commands in specific packages using pnpm's filter:

```bash
# Build only the lang package
pnpm --filter @workpipe/lang build

# Run tests in compiler package with watch mode
pnpm --filter @workpipe/compiler test:watch

# Build the VS Code extension
pnpm --filter workpipe-vscode build
```

### Build Order

Due to workspace dependencies, packages must be built in order:

1. `@workpipe/lang` (no internal dependencies)
2. `@workpipe/compiler` (depends on lang)
3. `@workpipe/cli` (depends on lang + compiler)
4. `@workpipe/action` (depends on compiler)
5. `workpipe-vscode` (depends on compiler)

The root `pnpm build` command handles this automatically via TypeScript project references.

## Running Examples

The `examples/` directory contains sample WorkPipe files with expected outputs.

### Compile a Single Example

```bash
# Using the CLI (after building)
pnpm --filter @workpipe/cli build
node packages/cli/dist/index.js build examples/minimal/minimal.workpipe -o examples/minimal/
```

### Example Structure

Each example directory contains:

```
examples/<name>/
├── <name>.workpipe   # Source specification
├── expected.yml      # Generated GitHub Actions YAML
└── README.md         # Documentation
```

### Available Examples

| Example | Description |
|---------|-------------|
| `minimal/` | Simplest possible workflow |
| `simple-job/` | Multiple jobs with dependencies |
| `agent-task/` | AI-powered code review |
| `cycle-basic/` | Iterative refinement loop |
| `ci-pipeline/` | Standard CI workflow |
| `release-workflow/` | Manual release process |
| `iterative-refinement/` | AI doc improvement cycle |

See [`examples/README.md`](../examples/README.md) for a complete learning path.

## CI Pipeline

The repository uses GitHub Actions for continuous integration (`.github/workflows/ci.yml`).

### CI Steps

1. **Checkout** - Clone repository
2. **Setup pnpm** - Install pnpm v9
3. **Setup Node.js** - Install Node.js 20 with pnpm cache
4. **Install** - Run `pnpm install --frozen-lockfile`
5. **Build** - Compile all packages
6. **Lint** - Check code style
7. **Test** - Run tests with coverage
8. **Coverage Upload** - Report to Codecov

### Triggers

- Push to `main` branch
- Pull requests targeting `main`

## Dependency Graph

```
┌─────────────────┐
│  @workpipe/lang │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│  @workpipe/compiler  │
└──────────┬───────────┘
           │
     ┌─────┴─────┬─────────────┐
     ▼           ▼             ▼
┌─────────┐  ┌──────────┐  ┌─────────────────┐
│   cli   │  │  action  │  │ vscode-extension│
└─────────┘  └──────────┘  └─────────────────┘
```

## Adding a New Package

1. Create directory in `packages/`
2. Initialize with `package.json` including:
   - Scoped name (`@workpipe/<name>`)
   - `"type": "module"`
   - Standard scripts (`build`, `test`)
3. Add to TypeScript project references if needed
4. Workspace dependencies use `"workspace:*"` version
