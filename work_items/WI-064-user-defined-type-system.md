# WI-064: User-Defined Type System

**ID**: WI-064
**Status**: Completed
**Priority**: P0-Critical (User Directive)
**Milestone**: A++ (Type System Enhancement)
**Phase**: 3+ (Types + Outputs - Extended)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)

## User Directive

> **Requirement:** WorkPipe MUST support user-defined types.
>
> **Rationale from user:**
> - Define complex JSON shapes that matter when using them in job scripts or passing to agent_task
> - Compiler automatically generates JSON schema FROM type definitions
> - More reusable, brings clarity and protection
> - No generics needed - just basic type definitions
> - VS Code extension must support diagnostics so users can't reference non-existent properties

## Description

Add user-defined type declarations to WorkPipe, allowing users to define named types that can be:
1. Reused across multiple job outputs
2. Used as agent_task input/output schemas (compiler generates JSON Schema)
3. Validated at compile time for property access errors

**Proposed Syntax:**

```workpipe
// Type declaration at workflow level
type BuildInfo {
  version: string
  commit: string
  timestamp: int
  artifacts: [{
    name: string
    path: string
    size: int | null
  }]
}

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

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo  // Reference named type
    }
    steps: [
      run("echo \"info={...}\" >> $GITHUB_OUTPUT")
    ]
  }

  agent_job review {
    runs_on: ubuntu-latest
    needs: [build]

    agent_task "code-review" {
      prompt = "Review the build"
      output_schema = ReviewResult  // Reference named type for schema
    }
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build, review]
    steps: [
      // Compiler catches: build.outputs.info.nonexistent is an error!
      run("echo ${{ needs.build.outputs.info.version }}")
    ]
  }
}
```

## Key Use Cases

1. **Define once, use multiple times**: A type like `BuildInfo` can be used across multiple job outputs without duplication
2. **Agent task schemas from types**: The compiler generates JSON Schema from type definitions, no external files needed
3. **Compile-time property validation**: Expressions like `${{ needs.build.outputs.info.nonexistent }}` are caught as errors at compile time

## Acceptance Criteria

### Core Language
- [ ] `type` keyword supported at workflow level
- [ ] Type declarations support all primitives: `string`, `int`, `float`, `bool`
- [ ] Type declarations support object types: `{ field: type }`
- [ ] Type declarations support array types: `[type]`
- [ ] Type declarations support union types: `type | null`, `"a" | "b"`
- [ ] Type declarations support nested objects and arrays
- [ ] Types can be referenced by name in `outputs:` blocks
- [ ] Types can be referenced by name in `output_schema` for agent tasks

### Compiler
- [ ] Type registry/resolver tracks all declared types
- [ ] Type references are resolved and validated
- [ ] Duplicate type names produce a diagnostic
- [ ] Undefined type references produce a diagnostic
- [ ] Property access on typed outputs is validated
- [ ] Expressions referencing non-existent properties produce diagnostics
- [ ] JSON Schema is automatically generated from type definitions

### VS Code Extension
- [ ] Diagnostics surface for undefined type references
- [ ] Diagnostics surface for invalid property access
- [ ] Hover shows type information for typed outputs
- [ ] Code completion suggests valid properties on typed outputs (stretch goal)

### Documentation
- [ ] Language reference updated with type declaration syntax
- [ ] Examples showing type reuse across jobs
- [ ] Examples showing type-as-schema for agent tasks
- [ ] Error documentation for new diagnostics

## Technical Constraints

### Design Decisions Needed (Architect Review)
1. **Where do type declarations live?** At workflow level? Separate section? Top of file?
2. **Type compatibility**: When do two types "match"? Structural or nominal?
3. **JSON Schema generation**: Reuse existing schema generation from WI-056?
4. **Expression type tracking**: How to track types through expression AST?
5. **Backward compatibility**: Existing workflows without types must continue working

### No Generics
Per user directive, generics are explicitly out of scope. Types are concrete definitions only.

### Integration Points
- Grammar: New `type` keyword and type declaration syntax
- AST: New `TypeDeclarationNode` and type reference nodes
- Semantics: Type registry, resolution, and validation
- Codegen: JSON Schema generation from type definitions
- VS Code: Diagnostics integration for type errors

## Sub-Work Items

This epic is decomposed into the following work items:

| WI | Title | Priority | Dependency |
|----|-------|----------|------------|
| WI-065 | Grammar and parser for type declarations | P0 | None |
| WI-066 | AST representation for type declarations | P0 | WI-065 |
| WI-067 | Type registry and resolver | P0 | WI-066 |
| WI-068 | Type references in job outputs | P0 | WI-067 |
| WI-069 | Type references in agent task schemas | P0 | WI-067, WI-056 |
| WI-070 | Property access validation in expressions | P1 | WI-067 |
| WI-071 | VS Code diagnostics for type errors | P1 | WI-070 |
| WI-072 | Documentation and examples | P1 | WI-068, WI-069 |

## Dependencies

- WI-056: JSON Schema Type Definitions for Agent Tasks (complete) - foundation for schema generation
- WI-046: Type System for Task/Job Data Flow (complete) - primitive type system
- WI-063: Expression Type Checking (complete) - expression analysis foundation

## Estimated Effort

This is a **major feature** requiring:
1. Grammar extension (medium)
2. AST types (small-medium)
3. Type registry/resolver (medium)
4. Integration with existing output types (medium)
5. Integration with agent task schemas (medium)
6. Property access validation (medium-large)
7. VS Code integration (medium)
8. Documentation (medium)

**Estimated total**: 2-3 weeks of focused development

## Notes

- This directly addresses user feedback about type reusability
- Builds on existing inline schema syntax from WI-056
- The "no generics" constraint keeps scope manageable
- VS Code property completion is a stretch goal - diagnostics are the priority
- Must maintain backward compatibility with typeless workflows

## QA Triggers

This is a **major feature** per CLAUDE.md criteria:
- New DSL top-level construct (`type` keyword)
- New compiler phase (type resolution)
- New diagnostics format (type errors)
- Affects example walkthroughs

QA validation and end-user acceptance review will be required.

## Documentation Triggers

This is a **user-facing feature** per CLAUDE.md criteria:
- New syntax that users can invoke
- Changes recommended patterns for complex data
- Alters "how to define schemas" guidance

Documentation steward review will be required.
