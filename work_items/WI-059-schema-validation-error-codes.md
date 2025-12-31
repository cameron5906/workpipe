# WI-059: Error Codes for Invalid Schema Syntax

**ID**: WI-059
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: A+ (Agent Tasks Enhancement)
**Phase**: 7 (Agent tasks)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## User Feedback Follow-up

From WI-056 end-user review: Need error codes for invalid schema syntax. Suggested range WP3xxx for schema-related errors.

## Description

Add semantic validation and diagnostic error codes for invalid inline schema definitions. Users should get clear, actionable error messages when their schema syntax is incorrect.

## Acceptance Criteria

### Error Codes to Implement

- [x] WP3001: Unknown primitive type in schema
  - Triggered when a type name isn't recognized (e.g., `integer` instead of `int`)
  - Hint: "Did you mean 'int'? Supported types: string, int, float, bool"

- [x] WP3002: Empty object schema
  - Triggered when `output_schema = {}` with no properties
  - Hint: "Object schemas must have at least one property"

- [x] WP3003: Invalid union type combination
  - Triggered for unions that don't make sense (e.g., `int | string` without null)
  - Hint: "Union types are primarily for nullable fields (type | null) or string literal enums"

- [x] WP3004: Duplicate property name in schema
  - Triggered when same property defined twice
  - Hint: "Property 'X' is defined multiple times"

- [ ] WP3005: Invalid array item type (DEFERRED - not implemented this iteration)
  - Triggered when array syntax is malformed
  - Hint: "Array type should be [itemType], e.g., [string] or [{...}]"

### Implementation Requirements

- [x] Add validation in `packages/compiler/src/semantics/schema-validation.ts`
- [x] Register error codes in diagnostic system
- [x] Update `docs/errors.md` with new WP3xxx codes
- [x] Add tests for each error code (22 new tests)
- [x] Wire validation into compile pipeline

## Technical Context

Current error handling for schemas is parser-level only. Semantic validation would catch:
- Type name typos
- Structural issues
- Usage errors

### Error Code Range

Following existing patterns:
- WP0xxx: Parser errors
- WP2xxx: Semantic errors (outputs)
- WP6xxx: Cycle-related
- WP7xxx: Required field validation
- **WP3xxx: Schema-related** (new)

## Dependencies

- WI-056: JSON Schema Type Definitions (complete)

## Estimated Effort

Medium - requires:
1. New validation module
2. Error code definitions
3. Tests for each case
4. Documentation updates

## Notes

- This improves DX for inline schema authoring
- Consider incremental implementation (start with most common errors)
- Error messages should guide users to correct syntax
