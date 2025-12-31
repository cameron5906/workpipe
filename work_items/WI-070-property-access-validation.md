# WI-070: Property Access Validation in Expressions

**ID**: WI-070
**Status**: Completed
**Priority**: P1-High
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)
**Parent**: WI-064 (User-Defined Type System)

## Description

Validate property access in expressions against typed outputs. When a job output uses a user-defined type, the compiler should catch references to non-existent properties.

## User Requirement

> "VS Code extension must support diagnostics so users can't reference non-existent properties"

## Example

```workpipe
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [...]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      // VALID: version exists on BuildInfo
      run("echo ${{ needs.build.outputs.info.version }}"),

      // ERROR: timestamp does not exist on BuildInfo
      run("echo ${{ needs.build.outputs.info.timestamp }}")
    ]
  }
}
```

Expected diagnostic:
```
WP5003: Property 'timestamp' does not exist on type 'BuildInfo'.
Available properties: version, commit
```

## Acceptance Criteria

### Expression Analysis
- [ ] Parse expressions to extract property access chains
- [ ] Track type information through `needs.X.outputs.Y` paths
- [ ] Resolve final type from TypeRegistry
- [ ] Validate property names against type structure

### Diagnostics
- [ ] WP5003: Property does not exist on type
  - "Property 'X' does not exist on type 'Y'. Available properties: a, b, c"
- [ ] Hint: suggest similar property names for typos

### Test Coverage
- [ ] Valid property access passes validation
- [ ] Invalid property access produces WP5003
- [ ] Nested property access is validated
- [ ] Array index access is handled (no validation on elements)
- [ ] Untyped outputs skip property validation

## Technical Context

### Expression Parsing

Expressions like `${{ needs.build.outputs.info.version }}` need to be parsed to extract:
- Base: `needs.build.outputs`
- Output name: `info`
- Property path: `version`

The existing expression parser from WI-063 can be extended.

### Type Resolution Path

1. Find job `build` in workflow
2. Get outputs for `build`
3. Find output `info`
4. Get type of `info` (either primitive or TypeReference)
5. If TypeReference, resolve via TypeRegistry
6. For each property in access path, validate existence

### Proposed Implementation

```typescript
function validatePropertyAccess(
  expr: ExpressionNode,
  workflow: WorkflowNode,
  registry: TypeRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Extract output references from expression
  const outputRefs = extractOutputReferences(expr);

  for (const ref of outputRefs) {
    // ref = { jobName, outputName, propertyPath }
    const job = findJob(workflow, ref.jobName);
    const output = findOutput(job, ref.outputName);

    if (output.type.kind === 'TypeReference') {
      const resolved = registry.resolve(output.type.name);
      if (resolved) {
        validateProperties(ref.propertyPath, resolved.definition, diagnostics);
      }
    }
  }

  return diagnostics;
}
```

### Files to Create
- `packages/compiler/src/semantics/property-validation.ts`
- `packages/compiler/src/semantics/__tests__/property-validation.test.ts`

### Files to Modify
- `packages/compiler/src/compile.ts` - Wire in property validation
- `docs/errors.md` - Document WP5003

## Dependencies

- WI-067: Type registry and resolver
- WI-068: Type references in job outputs
- WI-063: Expression type checking (complete) - expression parsing foundation

## Notes

- This is the key user-facing benefit of user-defined types
- Property validation only applies to typed outputs
- Untyped outputs (`string`, `int`, etc.) skip validation
- Array element access `items[0].field` is more complex - consider as stretch goal
- Consider depth limit for deeply nested properties
