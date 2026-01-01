# VS Code Extension: Missing Diagnostic for Unresolved Types

**ID**: WI-108
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

The VS Code extension does not warn when a user references a type that doesn't exist. When a user writes `output_schema: NonExistentType` (or any undefined type reference), the extension should display a WP5002 diagnostic error, but it currently does not.

This is a UX/correctness bug because:
1. Users get no feedback about typos in type names
2. The error only surfaces at compile time via CLI, not in the editor
3. Existing WP5002 diagnostic infrastructure exists in the compiler but may not be reaching the VS Code extension correctly

## Acceptance Criteria

- [ ] VS Code extension shows WP5002 diagnostic when `output_schema` references a non-existent type
- [ ] VS Code extension shows WP5002 diagnostic when job `outputs` reference a non-existent type
- [ ] Diagnostic includes helpful hint with available types (leveraging existing hint infrastructure)
- [ ] Diagnostic is displayed with error severity (red squiggle)
- [ ] Tests verify the diagnostic appears in VS Code context (not just compiler tests)
- [ ] Existing test case at `packages/vscode-extension/src/__tests__/diagnostics.test.ts` line 200-222 passes

## Technical Context

### Current Implementation

The compiler already has WP5002 diagnostic support in `packages/compiler/src/semantics/type-registry.ts`:

```typescript
function validateTypeReferencesInAgentTask(
  task: AgentTaskNode,
  registry: TypeRegistry
): Diagnostic[] {
  // ... validates task.outputSchema for unknown types
  // Returns WP5002 error with hint listing available types
}
```

The validation is wired through:
- `validateTypeReferences()` in `type-registry.ts`
- Called from the compile pipeline
- `DiagnosticsProvider` in VS Code extension calls `compile()` and maps diagnostics

### Potential Root Causes to Investigate

1. **AST Representation Gap**: The `outputSchema` field may not be correctly extracted from the AST when it's a type reference (vs. inline schema or file path)

2. **Validation Not Called**: The `validateTypeReferences()` function may not be invoked in all code paths (e.g., when using `compileWithImports()` vs. `compile()`)

3. **Type Reference Detection**: The check `typeof task.outputSchema === "string" && !task.outputSchema.endsWith(".json")` may be too narrow

4. **Import Context Timing**: When using imports, the type registry may not be populated before validation runs

### Relevant Files

- `packages/compiler/src/semantics/type-registry.ts` - Type validation logic
- `packages/compiler/src/compile.ts` - Main compile pipeline
- `packages/vscode-extension/src/diagnostics.ts` - VS Code diagnostic integration
- `packages/vscode-extension/src/__tests__/diagnostics.test.ts` - Existing tests (line 200-222 has WP5002 test for job outputs)

### Diagnostic Infrastructure

- **WP5002**: "Unknown type 'X'" with hint listing available types
- Severity: Error
- Hint: Lists available user-defined types for typo correction

## Dependencies

- None (existing infrastructure should support this)

## Notes

- A test already exists at line 200-222 in `diagnostics.test.ts` that checks WP5002 for job outputs
- Need to verify if the test actually passes and if there's a gap for agent task `output_schema` specifically
- Consider adding additional test cases for:
  - Type reference in agent task output_schema
  - Type reference in type declaration fields
  - Imported type reference that fails resolution
