# Create Bootstrap Workflow Template

**ID**: WI-040
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Create the bootstrap workflow template that enables WorkPipe self-hosting. This workflow automatically compiles `.workpipe` specs and commits the generated YAML files, closing the development loop.

## Acceptance Criteria

- [x] Bootstrap workflow template created
- [x] `workpipe init --bootstrap` command to generate the workflow
- [x] Triggers on changes to `workpipe/**/*.workpipe` and `workpipe/**/*.wp`
- [x] Installs Node 20 + WorkPipe CLI
- [x] Runs `workpipe build` to compile all specs
- [x] Commits generated YAML to `.github/workflows/`
- [x] Self-hosting example for WorkPipe's own CI
- [x] Tests for init command

## Deliverables

### New Files
- `templates/bootstrap.yml` - Standalone bootstrap workflow template
- `packages/cli/src/commands/init.ts` - Init command with `--bootstrap` option
- `workpipe/ci.workpipe` - Self-hosting example CI workflow
- `packages/cli/src/commands/__tests__/init.test.ts` - 10 tests

### Modified Files
- `packages/cli/src/index.ts` - Registered init command

### Features
- `workpipe init --bootstrap` creates `.github/workflows/workpipe-compile.yml`
- Bootstrap workflow:
  - Triggers on changes to `workpipe/**/*.workpipe` or `workpipe/**/*.wp`
  - Installs Node 20 + WorkPipe CLI
  - Compiles all specs to `.github/workflows/`
  - Commits changes automatically on push
- Self-hosting example for WorkPipe's own CI

## Technical Context

From PROJECT.md Section 13 (Bootstrap workflow):

> A single checked-in workflow:
> - triggers on changes to `workpipe/**/*.workpipe` (and optionally compiler version files)
> - installs Node + WorkPipe compiler
> - runs `workpipe compile`
> - writes generated YAML into `.github/workflows/`
> - commits changes back to the repo (optional but recommended for "generated is always up to date")

## Dependencies

- WI-042: CLI build command (complete) - provides the compilation command
- WI-002: CLI contracts (complete) - provides command structure

## CLI Commands

WorkPipe CLI now has 4 commands:
- `workpipe build` - Compile specs to YAML
- `workpipe check` - Validate specs
- `workpipe fmt` - Format specs
- `workpipe init` - Initialize project (new)

## Notes

- The bootstrap workflow uses `GITHUB_TOKEN` for commits, which won't trigger recursive workflows (by design)
- For fork PRs, the workflow uploads artifacts instead of committing (security)
- This enables the "dogfooding" story - WorkPipe compiling itself
