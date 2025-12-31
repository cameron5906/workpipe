# Documentation Audit for Feature Completeness

**ID**: WI-074
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling Polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Audit all documentation to ensure recent features are fully documented, consistent, and accurate. Multiple features have been added since the initial documentation pass, and some may not be fully integrated into the documentation structure.

This audit should:
- Verify all features are documented in the appropriate places
- Ensure documentation is consistent and up-to-date
- Add missing cross-references and navigation
- Update outdated information
- Fix any documentation drift from implementation

## Acceptance Criteria

### Feature Coverage Audit

#### User-Defined Type System (Milestone A++)
- [ ] Verify `type` declaration syntax fully documented in language-reference.md
- [ ] Verify type references in job outputs documented
- [ ] Verify type references in agent task schemas documented
- [ ] Verify property access validation documented
- [ ] Verify WP5001, WP5002, WP5003 in errors.md
- [ ] Cross-link between language-reference.md and examples/user-defined-types/

#### Expression Type Checking
- [ ] Verify WP2012 (type mismatch in comparisons) documented in errors.md
- [ ] Verify WP2013 (numeric operations on non-numeric) documented in errors.md
- [ ] Verify expression type checking mentioned in language-reference.md

#### Guards Feature
- [ ] Verify guard_js syntax documented in language-reference.md
- [ ] Verify guard helper library functions documented
- [ ] Verify WP6001, WP6005 in errors.md
- [ ] Cross-link to examples/guard-job/ and examples/cycle-basic/

#### Matrix Builds
- [ ] Verify matrix axes syntax documented
- [ ] Verify include/exclude documented
- [ ] Verify WP4001, WP4002 (matrix limits) in errors.md
- [ ] Cross-link to examples/matrix-build/

#### Cycles
- [ ] Verify cycle syntax fully documented in language-reference.md
- [ ] Verify max_iters, key, until properties documented
- [ ] Verify phased execution model explained
- [ ] Cross-link to examples/cycle-basic/ and examples/iterative-refinement/

#### Agent Tasks
- [ ] Verify agent_job and agent_task syntax documented
- [ ] Verify inline schema syntax documented
- [ ] Verify tools, mcp configuration documented
- [ ] Cross-link to examples/agent-task/

### Documentation Structure
- [ ] Update docs/README.md with complete document index
- [ ] Ensure all error codes in errors.md are complete and current
- [ ] Verify troubleshooting.md covers common issues
- [ ] Check quick-reference.md is up-to-date with current syntax

### Cross-Reference Verification
- [ ] All code examples in docs compile without errors
- [ ] All links between documents work correctly
- [ ] ADR references are accurate
- [ ] Example references point to existing examples

### Freshness Check
- [ ] Update any outdated test counts or statistics
- [ ] Update any outdated feature status indicators
- [ ] Remove or update any TODO/WIP markers
- [ ] Verify package version information is accurate

## Technical Context

Documentation files to audit:
- `docs/README.md` - Documentation index
- `docs/getting-started.md` - Installation and first workflow
- `docs/cli-reference.md` - CLI commands
- `docs/language-reference.md` - Complete syntax reference
- `docs/errors.md` - Diagnostic codes
- `docs/troubleshooting.md` - Common errors
- `docs/vscode-extension.md` - Extension docs
- `docs/quick-reference.md` - Cheat sheet
- `docs/bootstrap.md` - Self-hosting
- `docs/project-structure.md` - Contributor guide

Key recent additions requiring verification:
1. User-Defined Types (WI-064 through WI-072)
2. Expression Type Checking (WI-063)
3. Schema Validation Error Codes (WI-059)
4. Output Reference Validation (WI-054)
5. Guard Job Outputs (WI-020)
6. Matrix Fingerprinting (WI-024)

## Dependencies

- None (can proceed independently)
- Should be coordinated with WI-073 (README redesign) to ensure links are correct

## Notes

- Focus on completeness rather than rewriting - ensure nothing is missing
- Document drift was identified in WI-062 review (see BACKLOG.md Known Issues)
- Some examples (WI-057) may use unsupported syntax - note as follow-up
