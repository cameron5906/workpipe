# Define CLI Interface and Command Contracts

**ID**: WI-002
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A (Vertical slice)
**Phase**: 0 (Repo + contracts)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Define the CLI interface and command contracts for the WorkPipe compiler. This establishes the user-facing API that all subsequent compiler work will implement.

The CLI should be simple and focused, following the principle of "do one thing well" while providing the essential commands for development workflows.

## Acceptance Criteria

- [x] CLI entry point defined in `packages/cli/src/index.ts`
- [x] `workpipe build` command spec documented (compile .workpipe to .yml)
- [x] `workpipe check` command spec documented (validate without writing)
- [x] `workpipe fmt` command spec documented (format .workpipe files)
- [x] Command-line argument parsing setup (recommend `commander` or `yargs`)
- [x] Exit codes documented (0 = success, 1 = error, 2 = validation failure)
- [x] Input/output path conventions defined:
  - Default input: `**/*.workpipe` or `**/*.wp` in current directory
  - Default output: `.github/workflows/<derived-name>.yml`
- [x] `--help` output implemented for all commands
- [x] `--version` flag implemented
- [x] Basic error output format defined (for later diagnostics integration)

## Technical Context

From PROJECT.md Section 15 (Implementation rubric - Phase 0):
```
Define CLI:
  - workpipe compile (note: we're using "build" as the primary command)
  - workpipe fmt
  - workpipe check
```

From CLAUDE.md Section 6 (Compiler architecture):
- The CLI wraps the compiler pipeline
- Commands map to different pipeline stages:
  - `build`: full pipeline (parse -> emit YAML)
  - `check`: parse + validate (no YAML output)
  - `fmt`: parse + reformat source

### CLI Command Details

#### `workpipe build [options] [files...]`
- Compiles WorkPipe spec files to GitHub Actions YAML
- Options:
  - `--output, -o <dir>`: Output directory (default: `.github/workflows/`)
  - `--watch, -w`: Watch mode for development
  - `--dry-run`: Show what would be generated without writing
  - `--verbose, -v`: Verbose output

#### `workpipe check [files...]`
- Validates WorkPipe spec files without generating output
- Useful for CI/pre-commit hooks
- Returns exit code 2 if validation fails

#### `workpipe fmt [options] [files...]`
- Formats WorkPipe spec files
- Options:
  - `--write`: Write formatted output back to files (default: print to stdout)
  - `--check`: Exit with error if files need formatting (for CI)

## Dependencies

- WI-001: Initialize monorepo structure (must have `packages/cli/` scaffolded)

## Notes

- Consider using `commander` for CLI parsing (lightweight, well-maintained)
- The CLI should be executable via `npx workpipe` after npm publish
- Add `bin` field to package.json pointing to compiled entry point
- Consider supporting `workpipe.config.js` for project-level configuration (future)
- Error messages should include file:line:column for integration with editors
