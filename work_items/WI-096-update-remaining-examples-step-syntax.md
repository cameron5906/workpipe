# WI-096: Update Remaining Examples to New Step Syntax

**ID**: WI-096
**Status**: Completed
**Priority**: P1-High
**Milestone**: G (Step Syntax Improvements)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)

## Description

WI-095 updated 3 examples (minimal, simple-job, ci-pipeline) to the new `steps { shell { } }` block syntax per ADR-0013. However, there are 14 additional .workpipe files across 12 example directories that still use the old `steps: [ run("...") ]` array syntax.

This work item updates all remaining examples to use the new block syntax for consistency and to serve as proper reference documentation.

## Examples Updated

### Agent/AI Examples
- [x] `examples/agent-task/agent-task.workpipe` - converted to `steps { uses(...) { } agent_task(...) }`

### Cycle Examples
- [x] `examples/cycle-basic/cycle-basic.workpipe` - converted to `steps { shell { } }`
- [x] `examples/iterative-refinement/iterative-refinement.workpipe` - converted to `steps { uses(...) { } shell { } }`

### Guard Examples
- [x] `examples/guard-job/guard-job.workpipe` - converted to `steps { guard_js { } shell { } }`

### Output Examples
- [x] `examples/job-outputs/job-outputs.workpipe` - converted to `steps { shell { } }`
- [x] `examples/json-outputs/json-outputs.workpipe` - converted to `steps { shell { } }`

### Microservices/Enterprise Examples
- [x] `examples/microservices-build/microservices-build.workpipe` - converted to `steps { uses(...) { } shell { } }`
- [x] `examples/release-workflow/release-workflow.workpipe` - converted to `steps { uses(...) { } shell { } }`
- [x] `examples/enterprise-e2e-pipeline/enterprise-e2e-pipeline.workpipe` - converted to `steps { shell { } uses(...) { } }`
- [x] `examples/multi-environment-deploy/multi-environment-deploy.workpipe` - converted to `steps { shell { } uses(...) { } }`

### Import/Shared Types Examples
- [x] `examples/shared-types/workflows/ci.workpipe` - converted to `steps { uses(...) { } shell { } }`
- [x] `examples/shared-types/workflows/deploy.workpipe` - converted to `steps { uses(...) { } shell { } }`

### User-Defined Types Examples
- [x] `examples/user-defined-types/user-defined-types.workpipe` - converted to `steps { uses(...) { } shell { } agent_task(...) }`
- [x] `examples/user-defined-types/test-*.workpipe` files (6 files) - verified and updated as needed

## Acceptance Criteria

- [x] All .workpipe files in examples/ use new block syntax `steps { }`
- [x] `run("...")` calls converted to `shell { ... }` or inline `shell { command }`
- [x] `uses("action@version")` calls converted to `uses("action@version") {}` or `uses("action@version") { with { ... } }`
- [x] `agent_task(...)` blocks updated if syntax changed (verify compatibility)
- [x] `guard_js` blocks updated if syntax changed (verify compatibility)
- [x] All expected.yml files regenerated with `pnpm build` and verified
- [x] All examples compile without errors via `workpipe check`

## Technical Context

### New Syntax (ADR-0013 - Accepted)

```workpipe
steps {
  uses("actions/checkout@v4") {}
  shell { echo "Single line command" }
  shell {
    echo "Multi-line"
    echo "commands"
  }
  uses("actions/setup-node@v4") {
    with {
      node-version: "20"
    }
  }
}
```

### Old Syntax (Deprecated)

```workpipe
steps: [
  uses("actions/checkout@v4"),
  run("echo Single line command"),
  run("""
    echo Multi-line
    echo commands
  """)
]
```

### Notes

1. `guard_js` blocks use triple-quoted strings and remain unchanged
2. `agent_task` blocks may need syntax verification for step context
3. Multiline shell commands should use the multiline `shell { ... }` form
4. The types-only file `examples/shared-types/types/common.workpipe` has no steps and needs no update

## Dependencies

- WI-091: Grammar - Steps Block and Shell Keyword (COMPLETE)
- WI-092: AST and Parser Updates (COMPLETE)
- WI-093: Codegen - Indentation Stripping (COMPLETE)
- WI-095: Documentation and Examples (Partial - 3 examples done)

## Notes

- This is a follow-up to WI-095 which only covered 3 examples
- User reported examples are out of date
- Files with only type definitions (no workflows) do not need updates
