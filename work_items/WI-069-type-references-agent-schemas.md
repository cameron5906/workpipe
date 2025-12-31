# WI-069: Type References in Agent Task Schemas

**ID**: WI-069
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)
**Parent**: WI-064 (User-Defined Type System)

## Description

Enable agent task `output_schema` to reference user-defined types. The compiler generates JSON Schema from the type definition.

## Proposed Usage

```workpipe
type ReviewResult {
  approved: bool
  rating: int
  comments: [{
    file: string
    line: int
    severity: "error" | "warning" | "info"
    message: string
  }]
}

workflow review {
  on: pull_request

  agent_job code_review {
    runs_on: ubuntu-latest

    agent_task "reviewer" {
      prompt = "Review the code changes"
      output_schema = ReviewResult  // Reference type by name
    }
  }
}
```

## Acceptance Criteria

### Grammar
- [ ] `output_schema` accepts type reference (identifier) in addition to:
  - Inline schema object: `output_schema = { ... }`
  - File reference: `output_schema = file("schema.json")`
  - String path: `output_schema = "schema.json"`

### Semantic Analysis
- [ ] Type references in output_schema are resolved via TypeRegistry
- [ ] Undefined type references produce WP5002 diagnostic
- [ ] Resolved type stored for JSON Schema generation

### Code Generation
- [ ] Type definitions are converted to JSON Schema
- [ ] Reuse existing schema generation logic from WI-056
- [ ] Generated schema has `additionalProperties: false`
- [ ] All properties marked as required

### Tests
- [ ] Agent task with type reference parses correctly
- [ ] Type reference is resolved correctly
- [ ] Generated JSON Schema matches type definition
- [ ] Undefined type reference produces error

## Technical Context

### Current State

Agent tasks support three forms for output_schema:

```workpipe
// Inline schema
output_schema = { rating: int, summary: string }

// File reference
output_schema = file("schemas/review.json")

// String path
output_schema = "schemas/review.json"
```

### Proposed Extension

Add a fourth form - type reference:

```workpipe
output_schema = ReviewResult  // Type name
```

### Schema Generation

When a type reference is used, the compiler:

1. Resolves the type name via TypeRegistry
2. Gets the SchemaTypeNode for the type body
3. Uses existing `schemaTypeToJsonSchema()` from WI-056
4. Injects the schema into claude_args

### Grammar Addition

```lezer
OutputSchemaValue {
  InlineSchemaObject |
  FileReference |
  StringLiteral |
  TypeReference  // New
}
```

### Files to Modify
- `packages/lang/src/workpipe.grammar` - Add TypeReference to output_schema
- `packages/compiler/src/ast/builder.ts` - Build type reference
- `packages/compiler/src/codegen/transform.ts` - Resolve and generate schema
- `packages/compiler/src/codegen/schema-generator.ts` - Handle type references

## Dependencies

- WI-067: Type registry and resolver
- WI-056: JSON Schema generation (complete) - reuse schema generator

## Notes

- This provides significant ergonomic improvement over inline schemas
- Define type once, use in multiple agent tasks
- Type definitions can be more readable than inline schemas for complex structures
- Existing inline schema and file reference forms continue to work
