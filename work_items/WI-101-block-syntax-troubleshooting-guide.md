# Block Syntax Troubleshooting Guide

**ID**: WI-101
**Status**: Completed
**Priority**: P1-High
**Milestone**: G (Step Syntax Improvements)
**Created**: 2026-01-01
**Updated**: 2026-01-01
**Completed**: 2026-01-01

## Description

There is no dedicated troubleshooting section for common block syntax errors. Users encountering brace issues, shell content escaping problems, or other step syntax errors have no centralized resource to consult.

The new block-based step syntax (ADR-0013) introduces several potential pitfalls:
- Unbalanced braces in shell content
- Escaping requirements for special characters
- Trailing `{}` requirement for `uses()`
- Indentation behavior with indentation stripping

A dedicated troubleshooting guide will reduce user friction and support burden.

## Acceptance Criteria

- [x] Add "Block Syntax" section to `docs/troubleshooting.md`
- [x] Document common block syntax errors with examples:
  - [x] Unbalanced braces in shell content
  - [x] Missing trailing `{}` after `uses()` (covered in WI-098, referenced via cross-link)
  - [x] Special character escaping in shell blocks
  - [x] Multi-line shell command issues
  - [x] Indentation expectations
- [x] Each error example should include:
  - Problem code
  - Error message shown
  - Corrected code
  - Explanation of why the error occurred
- [x] Add cross-reference from `docs/language-reference.md` Steps section
- [x] Consider adding VS Code-specific troubleshooting tips (not added - no VS Code-specific issues identified for block syntax)

## Deliverables

- Added comprehensive "Block Syntax Issues" section to `docs/troubleshooting.md` with 7 subsections:
  1. Brace Counting and Shell Variable Expansion
  2. Nested Braces in Control Structures
  3. Indentation Handling in Shell Blocks
  4. Here-Documents in Shell Blocks
  5. Single-Line vs Multi-Line Shell Blocks
  6. Empty Shell Blocks
  7. See Also section with cross-references
- Added cross-reference from `docs/language-reference.md` (Shell Blocks section) to troubleshooting guide

## Technical Context

- Block syntax defined in ADR-0013 (docs/adr/ADR-0013-step-syntax-improvements.md)
- Shell tokenizer uses brace counting (`packages/lang/src/shell-tokenizer.ts`)
- Indentation stripping in `packages/compiler/src/codegen/transform.ts`
- Existing troubleshooting content in `docs/troubleshooting.md`

## Dependencies

- WI-098 (uses() trailing braces documentation) - related content, can be done in parallel

## Notes

This expands on the existing troubleshooting guide which focuses on type errors. The new section should be equally comprehensive for syntax/parsing errors.

Example errors to document:
```workpipe
// Error: Unbalanced braces
shell {
  if [ "$VAR" = "true" ]; then
    echo "yes"
  # Missing closing brace for if statement
}

// Error: Missing uses() braces
uses("actions/checkout@v4")

// Correct:
uses("actions/checkout@v4") {}
```
