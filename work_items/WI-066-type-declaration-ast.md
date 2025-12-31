# WI-066: AST Representation for Type Declarations

**ID**: WI-066
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31
**Parent**: WI-064 (User-Defined Type System)

## Description

Add AST node types for type declarations and update the AST builder to construct them from CST.

## Acceptance Criteria

### AST Types
- [x] Add `TypeDeclarationNode` interface
- [x] Type declaration has: `name`, `body` (SchemaTypeNode), `span`
- [x] Add `TypeReferenceNode` for referencing declared types by name
- [x] Update `WorkPipeFileNode` or `WorkflowNode` to include type declarations

### AST Builder
- [x] Build `TypeDeclarationNode` from CST `TypeDecl`
- [x] Build `TypeReferenceNode` when a bare identifier is used as a type
- [x] Preserve source spans for error reporting
- [x] Handle multiple type declarations

### Tests
- [x] AST builder tests for type declarations
- [x] AST builder tests for type references
- [x] Span preservation tests
- [x] Integration tests with existing workflow parsing

## Technical Context

### Proposed AST Types

```typescript
interface TypeDeclarationNode {
  kind: 'TypeDeclaration';
  name: string;
  body: SchemaTypeNode;  // Reuse from WI-056
  span: Span;
}

interface TypeReferenceNode {
  kind: 'TypeReference';
  name: string;
  span: Span;
}

// Update existing types
interface WorkPipeFileNode {
  kind: 'WorkPipeFile';
  typeDeclarations: TypeDeclarationNode[];
  workflow: WorkflowNode;
}

// Or if types are inside workflow:
interface WorkflowNode {
  // ... existing fields ...
  types: TypeDeclarationNode[];
}
```

### Existing SchemaTypeNode
WI-056 already defined:
- `SchemaObjectTypeNode` - `{ field: type }`
- `SchemaArrayTypeNode` - `[type]`
- `SchemaUnionTypeNode` - `type | type`
- `SchemaPrimitiveTypeNode` - `string`, `int`, etc.
- `SchemaLiteralTypeNode` - `"value"`
- `SchemaNullTypeNode` - `null`

### Files to Modify
- `packages/compiler/src/ast/types.ts` - Add new node types
- `packages/compiler/src/ast/builder.ts` - Build type declarations
- `packages/compiler/src/ast/__tests__/builder.test.ts` - Add tests

## Dependencies

- WI-065: Grammar for type declarations

## Notes

- Reuse existing SchemaTypeNode hierarchy from WI-056
- Keep AST simple and focused on structure
- Type checking and resolution happens in a later phase (WI-067)
