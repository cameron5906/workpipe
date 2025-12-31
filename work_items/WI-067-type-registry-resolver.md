# WI-067: Type Registry and Resolver

**ID**: WI-067
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed with 643 tests passing)
**Parent**: WI-064 (User-Defined Type System)

## Description

Implement a type registry that collects all type declarations and a resolver that validates type references. This is the core semantic analysis for user-defined types.

## Acceptance Criteria

### Type Registry
- [ ] Create `TypeRegistry` class to store type declarations
- [ ] Register all type declarations during semantic analysis
- [ ] Detect and report duplicate type names (WP5001)
- [ ] Store resolved type information for later use

### Type Resolver
- [ ] Create `TypeResolver` to resolve type references
- [ ] Look up type names in the registry
- [ ] Report undefined type references (WP5002)
- [ ] Return resolved type structure for valid references

### Diagnostics
- [ ] WP5001: Duplicate type name
  - "Type 'X' is already defined at line Y"
- [ ] WP5002: Undefined type reference
  - "Unknown type 'X'. Did you mean 'Y'?" (with suggestions)

### Tests
- [ ] Registry correctly stores type declarations
- [ ] Duplicate type detection works
- [ ] Type reference resolution works
- [ ] Undefined type reference detection works
- [ ] Integration with compile pipeline

## Technical Context

### Proposed Implementation

```typescript
// packages/compiler/src/semantics/type-registry.ts

interface ResolvedType {
  name: string;
  definition: SchemaTypeNode;
  declaration: TypeDeclarationNode;
}

class TypeRegistry {
  private types: Map<string, ResolvedType> = new Map();

  register(decl: TypeDeclarationNode): Diagnostic | null {
    if (this.types.has(decl.name)) {
      return createDuplicateTypeError(decl);
    }
    this.types.set(decl.name, {
      name: decl.name,
      definition: decl.body,
      declaration: decl,
    });
    return null;
  }

  resolve(name: string): ResolvedType | undefined {
    return this.types.get(name);
  }

  suggestSimilar(name: string): string[] {
    // Levenshtein distance for typo suggestions
  }
}

// packages/compiler/src/semantics/type-resolver.ts

function resolveTypeReference(
  ref: TypeReferenceNode,
  registry: TypeRegistry
): ResolvedType | Diagnostic {
  const resolved = registry.resolve(ref.name);
  if (!resolved) {
    const suggestions = registry.suggestSimilar(ref.name);
    return createUndefinedTypeError(ref, suggestions);
  }
  return resolved;
}
```

### Integration Point

The type registry should be built early in the compile pipeline, before output validation:

1. Parse source to CST
2. Build AST
3. **Build type registry** (new step)
4. Validate outputs (can now resolve type references)
5. Generate IR
6. Emit YAML

### Files to Create
- `packages/compiler/src/semantics/type-registry.ts`
- `packages/compiler/src/semantics/type-resolver.ts`
- `packages/compiler/src/semantics/__tests__/type-registry.test.ts`

### Files to Modify
- `packages/compiler/src/compile.ts` - Wire in registry building
- `docs/errors.md` - Document WP5001, WP5002

## Dependencies

- WI-066: AST for type declarations

## Notes

- Keep the registry simple - no complex type inference
- Structural typing: two types with same structure are compatible
- Suggestion algorithm should handle common typos
- Consider whether to support forward references (type A uses type B defined later)
