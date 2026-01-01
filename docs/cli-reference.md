# CLI Reference

The WorkPipe CLI (`workpipe`) provides commands for compiling, validating, and formatting WorkPipe source files.

## Installation

```bash
npm install -g @workpipe/cli

# Verify installation
workpipe --version
```

## Global Options

These options are available for all commands:

| Option | Description |
|--------|-------------|
| `--version` | Display the CLI version and exit |
| `--help` | Display help information for any command |

**Examples:**

```bash
# Show version
workpipe --version

# Show general help
workpipe --help

# Show help for a specific command
workpipe build --help
```

## Commands

### workpipe build

Compiles WorkPipe source files into GitHub Actions workflow YAML.

```bash
workpipe build [files...]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `files` | Optional list of files or glob patterns. If omitted, discovers all `*.workpipe` and `*.wp` files recursively. |

**Options:**

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--output <dir>` | `-o` | `.github/workflows/` | Output directory for generated YAML files |
| `--watch` | `-w` | `false` | Watch mode for development (not yet implemented) |
| `--dry-run` | | `false` | Preview output without writing files |
| `--verbose` | `-v` | `false` | Show detailed compilation information |
| `--no-color` | | | Disable colored output |

**Examples:**

```bash
# Build all WorkPipe files in the project
workpipe build

# Build a specific file
workpipe build workpipe/ci.workpipe

# Build with a glob pattern
workpipe build "workpipe/**/*.workpipe"

# Output to a custom directory
workpipe build -o dist/workflows

# Preview without writing files
workpipe build --dry-run

# Preview with verbose output
workpipe build --dry-run --verbose
```

**Output Naming:**

The output filename is derived from the workflow name in the source file, not the input filename:

```
Input:  workpipe/my-pipeline.workpipe
        workflow deploy_production { ... }

Output: .github/workflows/deploy_production.yml
```

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error (file not found, invalid usage) |
| 2 | Validation failure (syntax or semantic errors in source) |

---

### workpipe check

Validates WorkPipe source files without generating output. Useful for CI gates and pre-commit hooks.

```bash
workpipe check [files...]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `files` | Optional list of files or glob patterns. If omitted, discovers all `*.workpipe` and `*.wp` files recursively. |

**Options:**

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--verbose` | `-v` | `false` | Show detailed validation output |
| `--no-color` | | | Disable colored output |

**Examples:**

```bash
# Check all WorkPipe files
workpipe check

# Check a specific file
workpipe check workpipe/ci.workpipe

# Check with verbose output
workpipe check -v
```

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | All files valid |
| 1 | Runtime error |
| 2 | Validation errors found |

---

### workpipe fmt

Formats WorkPipe source files for consistent style.

```bash
workpipe fmt [files...]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `files` | Optional list of files or glob patterns. If omitted, discovers all `*.workpipe` and `*.wp` files recursively. |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--write` | `false` | Write formatted output back to files |
| `--check` | `false` | Exit with error if files need formatting (for CI) |

**Examples:**

```bash
# Print formatted output to stdout
workpipe fmt workpipe/ci.workpipe

# Format files in place
workpipe fmt --write

# Check if formatting is needed (CI mode)
workpipe fmt --check
```

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success (or no formatting needed in check mode) |
| 1 | Runtime error |
| 2 | Files need formatting (check mode only) |

---

### workpipe init

Initializes WorkPipe in a project by generating configuration and bootstrap files.

```bash
workpipe init
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--bootstrap` | `false` | Generate a bootstrap workflow for automatic CI compilation |

**Examples:**

```bash
# Show initialization help
workpipe init

# Generate bootstrap workflow
workpipe init --bootstrap
```

**Bootstrap Workflow:**

When using `--bootstrap`, WorkPipe creates `.github/workflows/workpipe-compile.yml`. This workflow:

1. Triggers on changes to `workpipe/**/*.workpipe` and `workpipe/**/*.wp`
2. Installs the WorkPipe CLI
3. Compiles all WorkPipe source files
4. Commits the regenerated workflow files

This ensures your generated workflows stay in sync with your WorkPipe sources.

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error creating files |

---

## File Discovery

When no file arguments are provided, WorkPipe searches recursively for:
- `**/*.workpipe` (primary extension)
- `**/*.wp` (alias extension)

The following directories are excluded:
- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `.github/workflows/`

**Glob Patterns:**

When using glob patterns, quote them to prevent shell expansion:

```bash
# Correct
workpipe build "workpipe/**/*.workpipe"

# May fail due to shell expansion
workpipe build workpipe/**/*.workpipe
```

---

## Exit Codes Summary

All WorkPipe commands use consistent exit codes:

| Code | Name | Meaning |
|------|------|---------|
| 0 | SUCCESS | Operation completed successfully |
| 1 | ERROR | Runtime error, internal error, or invalid usage |
| 2 | VALIDATION_FAILURE | Source validation failed or formatting needed |

Exit code 2 indicates "the tool worked correctly but found problems with the input." This distinction enables CI scripts to differentiate between tool failures and source issues.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NO_COLOR` | Disable colored output (standard convention) |

---

## See Also

- [Getting Started](getting-started.md) - Installation and first workflow guide
- [Language Reference](language-reference.md) - Complete syntax reference
