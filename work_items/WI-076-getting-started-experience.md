# Getting Started Experience Polish

**ID**: WI-076
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling Polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Polish the end-to-end getting started experience for new WorkPipe users. The goal is to ensure a new user can go from "never heard of WorkPipe" to "working workflow committed" in under 10 minutes with a delightful experience.

This includes:
- Installation experience
- First workflow creation
- VS Code extension setup
- Understanding what happened and what to do next

## Acceptance Criteria

### Installation Experience
- [ ] Verify npm/pnpm/yarn installation instructions work
- [ ] Add installation verification steps (workpipe --version)
- [ ] Document common installation issues and fixes
- [ ] Consider adding npx/pnpx usage for try-without-install

### First Workflow Journey
- [ ] Streamline getting-started.md to be faster
- [ ] Add clear success indicators at each step
- [ ] Include expected output for each command
- [ ] Add troubleshooting tips inline where issues might occur

### VS Code Extension Onboarding
- [ ] Verify extension marketplace installation works
- [ ] Document extension setup in getting-started.md
- [ ] Add screenshots or GIFs of extension features
- [ ] Explain what the extension provides (syntax highlighting, diagnostics)

### Init Command Enhancement
- [ ] Verify `workpipe init` creates sensible defaults
- [ ] Verify `workpipe init --bootstrap` works correctly
- [ ] Document init command options clearly
- [ ] Consider adding interactive mode or templates

### Quick Win Examples
- [ ] Provide copy-paste examples that "just work"
- [ ] Include minimal example that compiles in one command
- [ ] Add "next steps" suggestions after first success

### Error Recovery
- [ ] Common first-time errors documented with solutions
- [ ] Clear error messages for typical mistakes
- [ ] Link to troubleshooting guide from getting-started

### Documentation Flow
- [ ] Clear progression: README -> getting-started -> language-reference
- [ ] "Next: Try these examples" section
- [ ] "Need help?" section with support options

### Time-to-Value
- [ ] Test the entire flow end-to-end
- [ ] Target: working workflow in < 10 minutes
- [ ] Document estimated time for each section

## Technical Context

Key files:
- `README.md` - Entry point (covered in WI-073)
- `docs/getting-started.md` - Main onboarding guide
- `docs/cli-reference.md` - Command reference
- `docs/vscode-extension.md` - Extension guide
- `docs/troubleshooting.md` - Error resolution

CLI commands used in onboarding:
- `workpipe --version`
- `workpipe build <file>`
- `workpipe check <file>`
- `workpipe init [--bootstrap]`
- `workpipe fmt <file>`

VS Code extension:
- Package: `packages/vscode-extension/`
- VSIX: `packages/vscode-extension/workpipe-vscode-0.0.1.vsix`

## Dependencies

- WI-073 (README redesign) - Links to getting-started
- WI-074 (documentation audit) - Ensures accuracy
- WI-075 (examples showcase) - Provides next steps after onboarding

## Notes

- Consider creating a short video or animated GIF showing the complete flow
- Could add a "playground" or online demo in the future
- Focus on reducing friction at every step
- Test with someone unfamiliar with the project if possible
