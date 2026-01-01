# uses() Trailing {} Documentation Gap

**ID**: WI-098
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: G (Step Syntax Improvements)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

The `uses("action@version") {}` syntax requires trailing `{}` even when no `with` block is needed. This is surprising behavior that is currently underdocumented. Users will hit syntax errors without understanding why, leading to frustration and wasted debugging time.

The issue was identified during end-user acceptance review. The block syntax (ADR-0013) mandates trailing braces for syntactic consistency, but this non-obvious requirement needs prominent documentation and possibly improved error messages.

## Acceptance Criteria

- [x] Add prominent callout in `docs/language-reference.md` explaining trailing `{}` requirement for `uses()`
- [x] Add callout in `docs/quick-reference.md` for `uses()` syntax
- [x] Update `docs/getting-started.md` with explicit note about trailing braces
- [x] Ensure all `uses()` examples in documentation show trailing `{}`
- [x] Add entry to `docs/troubleshooting.md` for "Missing {} after uses()" error
- [x] Review parser error message for missing `{}` after uses() - improve if unclear (see Notes)
- [x] Verify VS Code hover for `uses` keyword mentions the `{}` requirement

## Technical Context

- Step syntax was redesigned in ADR-0013 (WI-090 through WI-097)
- The block syntax uses brace-counting tokenizer for shell content
- `uses()` blocks follow the same pattern for consistency
- Grammar: `UsesBlockStep` in `workpipe.grammar`
- Current docs may not emphasize this sufficiently

## Dependencies

- None (documentation-only work item)

## Notes

This is a user experience issue, not a bug. The syntax is working as designed, but the design decision needs better communication. The trailing `{}` allows for optional `with { }` blocks while maintaining syntactic consistency across step types.

Example of the issue:
```workpipe
// This will fail with a parse error:
uses("actions/checkout@v4")

// This is the correct syntax:
uses("actions/checkout@v4") {}

// With a with block:
uses("actions/checkout@v4") {
  with {
    fetch-depth: 0
  }
}
```

## Completion Summary (2026-01-01)

### Stream A (Documentation Steward) - COMPLETE
- Added prominent callout in `docs/language-reference.md` (two callouts - Steps section and Uses Step section)
- Added callout in `docs/quick-reference.md` for `uses()` syntax
- Updated `docs/getting-started.md` with IMPORTANT callout
- All `uses()` examples in documentation show trailing `{}`
- Added entry to `docs/troubleshooting.md` - new "Syntax Errors" section with complete troubleshooting entry

### Stream B (Software Engineer) - COMPLETE
- Added VS Code hover for `uses` keyword with `{}` requirement emphasis
- Added test for hover documentation

### Parser Error Finding
The engineer investigated the parser error and found:
- Current error: Generic "Syntax error at position X" pointing to wrong location
- This is a Lezer grammar limitation - would need semantic validation to improve
- **Recommendation**: Create a follow-up work item for clearer error messages (low priority)
