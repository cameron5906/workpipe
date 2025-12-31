# WI-068: Type References in Job Outputs

**ID**: WI-068
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)
**Parent**: WI-064 (User-Defined Type System)

## Description

Enable job outputs to reference user-defined types instead of primitive types. This allows a type definition to be reused across multiple jobs.

## Proposed Usage

```workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo  // Reference user-defined type
    }
    steps: [
      run("echo \"info={\\\"version\\\":\\\"1.0.0\\\",\\\"commit\\\":\\\"abc123\\\",\\\"timestamp\\\":1234567890}\" >> $GITHUB_OUTPUT")
    ]
  }

  job test {
    runs_on: ubuntu-latest
    outputs: {
      result: BuildInfo  // Same type reused
    }
    // ...
  }
}
```

## Acceptance Criteria

### Grammar
- [ ] Output type position accepts type references (identifiers)
- [ ] Existing primitive types (`string`, `int`, etc.) still work
- [ ] Mix of primitive and type references in same outputs block works

### Semantic Analysis
- [ ] Type references in outputs are resolved via TypeRegistry
- [ ] Undefined type references produce WP5002 diagnostic
- [ ] Resolved type information stored for downstream use

### Code Generation
- [ ] Type reference outputs generate same YAML as primitive outputs
- [ ] Output declaration maps to GitHub Actions job outputs format

### Tests
- [ ] Output with type reference parses correctly
- [ ] Type reference is resolved correctly
- [ ] Undefined type reference produces error
- [ ] YAML output is correct

## Technical Context

### Current State

Job outputs currently support only primitives:
```workpipe
outputs: {
  version: string
  count: int
  success: bool
}
```

### Proposed Extension

The grammar should allow a type reference (identifier) in the type position:

```lezer
OutputProperty { Identifier ":" OutputType }
OutputType { PrimitiveType | TypeReference }
TypeReference { Identifier }
```

### Resolution Flow

1. Parser recognizes `outputs: { info: BuildInfo }`
2. AST builder creates output with `TypeReferenceNode`
3. Semantic analysis resolves `BuildInfo` via TypeRegistry
4. If found, stores resolved type for expression validation
5. If not found, emits WP5002 diagnostic

### Files to Modify
- `packages/lang/src/workpipe.grammar` - Allow type references in outputs
- `packages/compiler/src/ast/builder.ts` - Build type references
- `packages/compiler/src/semantics/output-validation.ts` - Resolve references
- `packages/compiler/src/codegen/transform.ts` - Handle type references

## Dependencies

- WI-067: Type registry and resolver

## Notes

- Type references in outputs are semantically equivalent to `json` type for codegen
- The value is still serialized as a JSON string to GITHUB_OUTPUT
- The type information enables compile-time property validation (WI-070)
- Backward compatibility: primitive types continue to work unchanged
