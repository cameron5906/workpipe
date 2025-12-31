# Initialize Monorepo Structure with Package Scaffolding

**ID**: WI-001
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: A (Vertical slice)
**Phase**: 0 (Repo + contracts)
**Created**: 2025-12-30
**Updated**: 2025-12-30

## Description

Set up the foundational monorepo structure for WorkPipe following the recommended layout from the design document. This establishes the package organization that all subsequent work will build upon.

The monorepo should use a modern TypeScript toolchain with proper workspace configuration to enable:
- Shared dependencies across packages
- Consistent build and test commands
- Independent versioning (future)

## Acceptance Criteria

- [x] Root `package.json` with workspaces configuration
- [x] `packages/lang/` scaffolded with package.json (Lezer grammar)
- [x] `packages/compiler/` scaffolded with package.json (AST, typechecker, YAML emission)
- [x] `packages/cli/` scaffolded with package.json (workpipe build|check|fmt)
- [x] `packages/action/` scaffolded with package.json (GitHub Action wrapper)
- [x] `examples/` directory created for sample specs and golden fixtures
- [x] TypeScript configuration (tsconfig.json) with project references
- [x] ESLint and Prettier configuration for consistent code style
- [x] `.gitignore` properly configured for Node.js/TypeScript project
- [x] Basic README.md in root explaining the project structure

## Technical Context

From CLAUDE.md Section 11 (Repo layout):
```
packages/lang/       - Lezer grammar
packages/compiler/   - AST, typechecker, cycle lowering, YAML emission
packages/cli/        - workpipe build|check|fmt
packages/action/     - GitHub Action wrapper for the compiler
examples/            - sample repos + golden YAML fixtures
```

From PROJECT.md Section 11.2:
- Implementation language: TypeScript
- Node 20 target (aligns with GitHub Actions)
- Use Lezer for parsing
- Use `yaml` package for stable YAML output

## Dependencies

None - this is the foundational work item.

## Notes

- Consider using pnpm or npm workspaces for monorepo management
- TypeScript project references enable incremental builds
- Each package should have its own tsconfig.json extending a base config
- The `examples/` directory will hold both `.workpipe` source files and expected `.yml` outputs for golden testing
