# WI-056: JSON Schema Type Definitions for Agent Tasks

**ID**: WI-056
**Status**: Completed
**Priority**: P1-High
**Milestone**: A+ (Agent Tasks Enhancement)
**Phase**: 7 (Agent tasks)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)

## User Feedback

> "I'd really like it if the agent task schemas could be defined just by providing a type definition. Can you guys PLEASE support enough in your typing framework to model a json schema (without the tricky $if, $def, etc - just required, properties, the general stuff. It needs to do union nulls, though. everything has to be required in claude's spec"

## Description

Users want to define agent task output schemas inline using a type definition syntax rather than referencing external JSON Schema files. This would allow:

```workpipe
// Current approach (file reference)
agent_task "review" {
  output_schema = file("schemas/review.json")
}

// Proposed approach (inline type definition)
agent_task "review" {
  output_schema = {
    rating: int
    summary: string
    issues: [{
      file: string
      line: int
      message: string
      severity: "error" | "warning" | null
    }]
  }
}
```

## Scope

Support a subset of JSON Schema sufficient for Claude's structured output requirements:

### Must Support
- [x] Primitive types: `string`, `int`, `float`, `bool`
- [x] Object types with properties
- [x] Array types with item type
- [x] Union types with null: `string | null`, `int | null`
- [x] Literal string unions: `"error" | "warning" | "info"`
- [x] Nested objects
- [x] All properties required by default (Claude's requirement)

### Explicitly Out of Scope
- `$if`, `$then`, `$else` conditionals
- `$defs` / `$ref` references
- `patternProperties`
- `additionalProperties` (default to false)
- `oneOf`, `anyOf` beyond simple null unions
- Format validations (`date-time`, `email`, etc.)

## Acceptance Criteria

### Grammar
- [x] Extend Lezer grammar with inline schema type syntax
- [x] Support object literal types: `{ field: type, ... }`
- [x] Support array types: `[elementType]`
- [x] Support union types: `type1 | type2`
- [x] Support null literal in unions
- [x] Support string literal unions for enums

### AST
- [x] Add `SchemaTypeNode` hierarchy to AST
- [x] Parse inline schemas into structured AST nodes
- [x] Preserve source spans for error reporting

### Codegen
- [x] Transform inline schema AST to JSON Schema object
- [x] Generate all properties as `required`
- [x] Set `additionalProperties: false`
- [x] Emit JSON Schema to artifact or step input

### Validation
- [x] Schema type validation integrated

### Documentation
- [x] Update `docs/language-reference.md` with inline schema syntax
- [x] Add example showing inline schema usage
- [x] Document relationship to JSON Schema

## Technical Context

### Current State
Agent tasks currently support `output_schema` via file reference:
```workpipe
output_schema = file("schemas/review.json")
```

This requires maintaining separate JSON Schema files, which is cumbersome for simple schemas.

### Proposed Syntax Examples

Simple object:
```workpipe
output_schema = {
  success: bool
  message: string
}
```

With arrays:
```workpipe
output_schema = {
  files: [string]
  errors: [{
    path: string
    line: int
    message: string
  }]
}
```

With nullable fields:
```workpipe
output_schema = {
  result: string
  error_message: string | null
}
```

With enums:
```workpipe
output_schema = {
  status: "pending" | "running" | "complete" | "failed"
  severity: "error" | "warning" | "info" | null
}
```

### Generated JSON Schema

Input:
```workpipe
output_schema = {
  rating: int
  summary: string
  issues: [{
    file: string
    line: int
    severity: "error" | "warning" | null
  }]
}
```

Output:
```json
{
  "type": "object",
  "properties": {
    "rating": { "type": "integer" },
    "summary": { "type": "string" },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "line": { "type": "integer" },
          "severity": {
            "oneOf": [
              { "enum": ["error", "warning"] },
              { "type": "null" }
            ]
          }
        },
        "required": ["file", "line", "severity"],
        "additionalProperties": false
      }
    }
  },
  "required": ["rating", "summary", "issues"],
  "additionalProperties": false
}
```

## Dependencies

- WI-026: Agent task syntax (complete) - foundation
- WI-046: Type system (complete) - type primitives

## Estimated Effort

This is a significant feature requiring:
1. Grammar extension (medium)
2. AST types (small)
3. Schema-to-JSON-Schema transform (medium)
4. Integration with agent task codegen (small)
5. Tests and documentation (medium)

Consider breaking into sub-items if scope grows.

## Notes

- This directly addresses user feedback about schema ergonomics
- The "all required" constraint aligns with Claude's structured output spec
- Union null support is critical per user feedback
- Keep it simple - resist feature creep toward full JSON Schema
