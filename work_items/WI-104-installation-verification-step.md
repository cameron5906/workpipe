# Installation Verification Step

**ID**: WI-104
**Status**: Completed
**Priority**: P1-High
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01
**Completed**: 2026-01-01

## Description

There is no documented way to verify that WorkPipe is installed correctly. Users completing installation have no feedback loop to confirm the tool is working before they start writing workflows.

A simple verification step like `workpipe --version` should be documented in the getting started guide to help users confirm successful installation.

## Acceptance Criteria

- [x] Verify `workpipe --version` command exists and works
- [x] If not, implement `--version` flag in CLI (already existed)
- [x] Add installation verification step to `docs/getting-started.md`:
  - After installation instructions
  - Show expected output
  - Provide troubleshooting if command not found
  - (Already present in getting-started.md)
- [x] Update `docs/cli-reference.md` with `--version` flag documentation
  - Added Global Options section with --version and --help flags
- [x] Update README.md quickstart section with verification step
  - Added --version verification after npm install step
- [x] Consider adding `workpipe doctor` or `workpipe --help` as additional verification
  - Added --help documentation to Global Options section
- [x] **Carry-over from WI-103**: Update `docs/language-reference.md` (lines 1436-1463) to fix unimplemented `emit`/`emits`/`consumes` artifact syntax (use `output_artifact` approach consistent with quick-reference.md)
  - Replaced unimplemented emits/emit/consumes syntax with supported output_artifact and typed outputs patterns

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
