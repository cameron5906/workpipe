# WI-072: User-Defined Types Documentation and Examples

**ID**: WI-072
**Status**: Completed
**Priority**: P1-High
**Milestone**: A++ (Type System Enhancement)
**Phase**: 9 (Tooling)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)
**Parent**: WI-064 (User-Defined Type System)

## Description

Create comprehensive documentation and examples for user-defined types.

## Acceptance Criteria

### Language Reference
- [ ] Add "User-Defined Types" section to `docs/language-reference.md`
- [ ] Document `type` keyword and declaration syntax
- [ ] Document supported type features (primitives, objects, arrays, unions)
- [ ] Document type references in outputs
- [ ] Document type references in agent task schemas
- [ ] Explain compile-time property validation

### Error Documentation
- [ ] Add WP5001 to `docs/errors.md` (duplicate type)
- [ ] Add WP5002 to `docs/errors.md` (undefined type)
- [ ] Add WP5003 to `docs/errors.md` (property not found)
- [ ] Include examples and solutions for each

### Examples
- [ ] Create `examples/user-defined-types/` with:
  - `user-defined-types.workpipe` - showcase example
  - `expected.yml` - generated output
  - `README.md` - explanation
- [ ] Example shows type reuse across jobs
- [ ] Example shows type as agent task schema
- [ ] Example demonstrates property validation

### README Updates
- [ ] Update main `README.md` to mention type system
- [ ] Add type system to feature list
- [ ] Link to documentation

## Content Outline

### Language Reference Section

```markdown
## User-Defined Types

WorkPipe allows you to define named types that can be reused across
your workflow.

### Defining Types

Use the `type` keyword to define a named type:

\`\`\`workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}
\`\`\`

### Type Syntax

Types support all schema type features:

| Feature | Example | Description |
|---------|---------|-------------|
| Primitives | `string`, `int` | Basic types |
| Objects | `{ field: type }` | Nested structures |
| Arrays | `[type]` | List of items |
| Unions | `type \| null` | Optional values |
| Enums | `"a" \| "b"` | String literals |

### Using Types in Outputs

Reference a type by name in job outputs:

\`\`\`workpipe
job build {
  outputs: {
    info: BuildInfo  // Uses the type defined above
  }
}
\`\`\`

### Using Types in Agent Tasks

Reference a type for agent task output schemas:

\`\`\`workpipe
agent_task "review" {
  output_schema = ReviewResult  // Compiler generates JSON Schema
}
\`\`\`

### Property Validation

The compiler validates property access on typed outputs:

\`\`\`workpipe
job deploy {
  steps: [
    run("${{ needs.build.outputs.info.version }}"),  // OK
    run("${{ needs.build.outputs.info.missing }}")   // Error: WP5003
  ]
}
\`\`\`
```

### Example Workflow

```workpipe
// examples/user-defined-types/user-defined-types.workpipe

// Define reusable types at workflow level
type BuildInfo {
  version: string
  commit: string
  timestamp: int
  success: bool
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
  summary: string | null
}

workflow typed_pipeline {
  on: push

  // Build job uses BuildInfo type for output
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [
      run("echo \"info={\\\"version\\\":\\\"1.0.0\\\"}\" >> $GITHUB_OUTPUT")
    ]
  }

  // Agent job uses ReviewResult type for schema
  agent_job review {
    runs_on: ubuntu-latest
    needs: [build]

    agent_task "code-review" {
      prompt = "Review the build at version ${{ needs.build.outputs.info.version }}"
      output_schema = ReviewResult
    }
  }

  // Deploy job references typed properties
  job deploy {
    runs_on: ubuntu-latest
    needs: [build, review]
    steps: [
      // Type-safe property access
      run("echo Version: ${{ needs.build.outputs.info.version }}"),
      run("echo Commit: ${{ needs.build.outputs.info.commit }}")
    ]
  }
}
```

## Dependencies

- WI-068: Type references in job outputs
- WI-069: Type references in agent task schemas
- WI-070: Property access validation

## Notes

- Documentation should be beginner-friendly
- Examples should be runnable
- Cover common use cases
- Include troubleshooting for common errors
