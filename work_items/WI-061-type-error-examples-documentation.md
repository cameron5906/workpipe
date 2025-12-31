# Add Type Error Examples to Documentation

**ID**: WI-061
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: E (Tooling/Documentation)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Add a "Common Mistakes" or "Troubleshooting" section to the documentation showing type-related errors with concrete examples. Users benefit from seeing:
- What the error looks like in their code
- What the error message says
- How to fix the problem

This helps users self-serve when they encounter type-related diagnostics.

## Acceptance Criteria

- [ ] At least 3 type-related error examples documented
- [ ] Each example shows:
  - WorkPipe code that triggers the error
  - The error message output
  - The corrected code/fix
- [ ] Links to `docs/errors.md` for complete error reference

## Technical Context

Relevant error codes to document:
- **WP2010**: Invalid output type (unknown type name)
- **WP2011**: Reference to non-existent output
- **WP3001**: Unknown primitive type in schema
- **WP3002**: Empty object schema
- **WP3003**: Invalid union type combination
- **WP3004**: Duplicate property name in schema

Error documentation lives in `docs/errors.md`. This work item adds practical examples that complement the reference documentation.

## Dependencies

- None (documentation-only work item)

## Notes

- Originated from end-user acceptance review of custom type system
- Could be added to `docs/language-reference.md` or a new `docs/troubleshooting.md`
- Consider following the pattern established in errors.md
