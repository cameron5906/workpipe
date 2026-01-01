# Installation Verification Step

**ID**: WI-104
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

There is no documented way to verify that WorkPipe is installed correctly. Users completing installation have no feedback loop to confirm the tool is working before they start writing workflows.

A simple verification step like `workpipe --version` should be documented in the getting started guide to help users confirm successful installation.

## Acceptance Criteria

- [ ] Verify `workpipe --version` command exists and works
- [ ] If not, implement `--version` flag in CLI
- [ ] Add installation verification step to `docs/getting-started.md`:
  - After installation instructions
  - Show expected output
  - Provide troubleshooting if command not found
- [ ] Update `docs/cli-reference.md` with `--version` flag documentation
- [ ] Update README.md quickstart section with verification step
- [ ] Consider adding `workpipe doctor` or `workpipe --help` as additional verification

## Technical Context

- CLI entry point: `packages/cli/src/index.ts`
- CLI uses Commander.js for argument parsing
- Current commands: build, check, fmt, init
- Standard convention is `--version` or `-V` flag

## Dependencies

- None

## Notes

This is a small quality-of-life improvement that significantly helps the onboarding experience. Users who can verify installation will have more confidence proceeding with the tutorial.

Example documentation section:
```markdown
## Verify Installation

After installing WorkPipe, verify it's working:

```bash
workpipe --version
```

You should see output like:
```
workpipe v1.0.0
```

If you see "command not found", ensure the package is installed globally
or check that your PATH includes the npm bin directory.
```
