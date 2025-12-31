# Add Type Error Examples to Documentation

**ID**: WI-061
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling/Documentation)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Add a "Common Mistakes" or "Troubleshooting" section to the documentation showing type-related errors with concrete examples. Users benefit from seeing:
- What the error looks like in their code
- What the error message says
- How to fix the problem

This helps users self-serve when they encounter type-related diagnostics.

## Acceptance Criteria

- [x] At least 3 type-related error examples documented
- [x] Each example shows:
  - WorkPipe code that triggers the error
  - The error message output
  - The corrected code/fix
- [x] Links to `docs/errors.md` for complete error reference

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

## Deliverables

Created `docs/troubleshooting.md` with the following sections:

**Common Type Errors (6 examples):**
- WP2010: Duplicate output name
- WP2011: Reference to non-existent output
- WP2012: Type mismatch in comparison
- WP2013: Numeric operation on non-numeric type
- WP3001: Unknown primitive type
- WP3004: Duplicate property name in schema

**Required Field Errors (2 examples):**
- WP7001: Job missing runs_on
- WP6001: Cycle missing termination condition

**Also updated:**
- `docs/README.md` - Added link to new troubleshooting guide

Each example follows the requested format:
1. Problem description
2. Code that triggers the error
3. Error message output
4. Fixed code

## Notes

- Originated from end-user acceptance review of custom type system
- Created new `docs/troubleshooting.md` as a practical companion to `docs/errors.md`
- Following the pattern established in errors.md with enhanced "how to fix" guidance
