# WI-085: Import System - CLI Integration

**ID**: WI-085
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Update `workpipe build` and `workpipe check` commands for multi-file compilation with imports. This is Phase 6 of the import system implementation (ADR-0012).

## Acceptance Criteria

- [x] `workpipe build` resolves imports when compiling
- [x] `workpipe check` validates imports
- [x] Build compiles files in dependency order
- [x] Files with only type declarations (no workflows) produce no YAML output
- [x] Import errors surface with proper file context
- [x] Build continues with other files if one file has import errors
- [x] Verbose mode shows import resolution details
- [x] Consider `--ignore-imports` flag for single-file mode (optional)
- [x] Integration tests for CLI with imports
- [x] Test multi-file project compilation
- [x] Test error output for import failures

## Technical Context

**CLI behavior changes** (from ADR-0012):

Current behavior:
- Resolves all `.workpipe` files
- Compiles each independently
- Writes output to `.github/workflows/`

With imports:
- Resolve files as before
- Build import graph
- Compile in dependency order
- Files with only types (no workflows) produce no output

**Important distinction**:
- Files containing ONLY type declarations produce no YAML output
- Files with workflows produce YAML, using types from imported files

**Example project structure**:

```
project/
  types/
    common.workpipe     # Only types - no YAML output
    build-types.workpipe # Only types - no YAML output
  workflows/
    ci.workpipe         # Has workflow - produces ci.yml
    deploy.workpipe     # Has workflow - produces deploy.yml
```

**Files to modify**:
- `packages/cli/src/commands/build.ts`
- `packages/cli/src/commands/check.ts`
- `packages/cli/src/utils/file-resolver.ts`

## Dependencies

- WI-080: Import System - Grammar and Parser
- WI-081: Import System - Path Resolution
- WI-082: Import System - Dependency Graph
- WI-083: Import System - Type Registry Merging
- WI-084: Import System - Diagnostics

## Notes

- Consider caching parsed files for performance
- Incremental compilation could be a future enhancement
- Error output should clearly identify which file has the problem
