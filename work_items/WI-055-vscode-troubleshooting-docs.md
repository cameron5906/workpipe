# WI-055: VS Code Extension Troubleshooting Documentation

**ID**: WI-055
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## User Feedback

> "I can't get the VSCode extension to work past highlighting. can you guys make sure that you did it right / have troubleshooting docs for people having issues like me?"

## Description

User reports the VS Code extension only provides syntax highlighting but other features (presumably real-time diagnostics/error squiggles) are not working. This requires two actions:

1. **Verification**: Ensure the extension is functioning correctly and diagnose what "past highlighting" might be failing
2. **Documentation**: Create troubleshooting documentation for common VS Code extension issues

## Acceptance Criteria

### Verification
- [ ] Manually test extension installation from VSIX
- [ ] Verify syntax highlighting works for all constructs
- [ ] Verify real-time diagnostics (error squiggles) appear for invalid files
- [ ] Verify diagnostics include hints (WI-050 feature)
- [ ] Test on a fresh VS Code profile to rule out conflicts
- [ ] Document any bugs found as separate work items

### Troubleshooting Documentation
- [ ] Create `docs/vscode-extension.md` with:
  - Installation instructions (from VSIX, from marketplace when published)
  - Expected features and how to verify they work
  - Common issues and solutions
  - How to check extension output/logs
  - Known limitations
- [ ] Update `docs/README.md` to include link to VS Code extension docs
- [ ] Update project README.md to mention VS Code extension with link to docs

## Technical Context

The VS Code extension was implemented in WI-038 and enhanced in WI-050:
- Package: `packages/vscode-extension/`
- Entry point: `src/extension.ts`
- Diagnostics: `src/diagnostics.ts`
- Tests: `src/__tests__/extension.test.ts` (12 tests passing)

Features that should work beyond highlighting:
- Real-time compiler diagnostics displayed as editor squiggles
- Diagnostic hints appended to error messages
- Support for `.workpipe` and `.wp` file extensions

Potential issues to investigate:
1. Extension activation not triggering
2. Compiler import failing in extension context
3. Diagnostics not refreshing on document change
4. Missing dependencies in bundled extension

## Dependencies

- WI-038: VS Code extension (complete) - foundation
- WI-050: Diagnostic hints (complete) - UX enhancement

## Notes

- This is user-facing and impacts adoption - prioritized as P1-High
- The .vsix file exists at `packages/vscode-extension/workpipe-vscode-0.0.1.vsix`
- Need to verify the extension works outside the development environment
- Consider adding a "Show WorkPipe Output" command for debugging
