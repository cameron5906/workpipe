# Block Syntax Troubleshooting Guide

**ID**: WI-101
**Status**: Backlog
**Priority**: P1-High
**Milestone**: G (Step Syntax Improvements)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

There is no dedicated troubleshooting section for common block syntax errors. Users encountering brace issues, shell content escaping problems, or other step syntax errors have no centralized resource to consult.

The new block-based step syntax (ADR-0013) introduces several potential pitfalls:
- Unbalanced braces in shell content
- Escaping requirements for special characters
- Trailing `{}` requirement for `uses()`
- Indentation behavior with indentation stripping

A dedicated troubleshooting guide will reduce user friction and support burden.

## Acceptance Criteria

- [ ] Add "Block Syntax" section to `docs/troubleshooting.md`
- [ ] Document common block syntax errors with examples:
  - [ ] Unbalanced braces in shell content
  - [ ] Missing trailing `{}` after `uses()`
  - [ ] Special character escaping in shell blocks
  - [ ] Multi-line shell command issues
  - [ ] Indentation expectations
- [ ] Each error example should include:
  - Problem code
  - Error message shown
  - Corrected code
  - Explanation of why the error occurred
- [ ] Add cross-reference from `docs/language-reference.md` Steps section
- [ ] Consider adding VS Code-specific troubleshooting tips

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
