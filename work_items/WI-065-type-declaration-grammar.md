# WI-065: Grammar and Parser for Type Declarations

**ID**: WI-065
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31
**Parent**: WI-064 (User-Defined Type System)

## Description

Extend the Lezer grammar to support `type` declarations at the workflow level. This is the foundation for user-defined types.

## Proposed Syntax

```workpipe
// Simple type
type Version {
  major: int
  minor: int
  patch: int
}

// Type with nested objects
type BuildInfo {
  version: string
  commit: string
  artifacts: [{
    name: string
    path: string
  }]
}

// Type with unions and nulls
type ReviewResult {
  approved: bool
  severity: "error" | "warning" | "info" | null
  comments: [string]
}

workflow my_workflow {
  // ... types can be referenced here
}
```

## Acceptance Criteria

### Grammar
- [x] Add `TypeDecl` production to grammar
- [x] `type` keyword recognized as reserved word
- [x] Type name is an identifier
- [x] Type body uses same syntax as inline schema (`{ field: type }`)
- [x] Reuse existing schema type productions (primitives, arrays, unions, objects)
- [x] Type declarations allowed before or after workflow block
- [x] Multiple type declarations supported

### Parser
- [x] Parser correctly recognizes type declarations
- [x] Error recovery works for malformed type declarations
- [x] Source spans preserved for all type tokens

### Tests
- [x] Grammar tests for valid type declarations
- [x] Grammar tests for type with all supported features
- [x] Grammar tests for multiple type declarations
- [x] Grammar tests for error recovery on malformed types

## Technical Context

### Current Grammar
The grammar already supports inline schema types from WI-056:
- `SchemaType` - primitive, object, array, union types
- Object properties: `{ field: type }`
- Array types: `[elementType]`
- Union types: `type1 | type2`

### Proposed Grammar Addition

```lezer
@top WorkPipeFile { (TypeDecl | WorkflowDecl)* }

TypeDecl { kw<"type"> Identifier TypeBody }
TypeBody { "{" TypeProperty ("," TypeProperty)* ","? "}" }
TypeProperty { Identifier ":" SchemaType }
```

The existing `SchemaType` production handles all the type syntax.

### Files to Modify
- `packages/lang/src/workpipe.grammar` - Add TypeDecl production
- `packages/lang/src/parser.ts` - Export updated parser
- `packages/lang/src/__tests__/parser.test.ts` - Add grammar tests

## Dependencies

- None (this is the foundation)

## Notes

- Keep grammar simple - reuse existing schema type syntax
- Type declarations are structural, not nominal for now
- Consider placement: before workflow? Inside workflow? Both?
