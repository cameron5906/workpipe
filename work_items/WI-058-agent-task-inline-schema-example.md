# WI-058: Add Inline Schema Example to agent-task

**ID**: WI-058
**Status**: Completed
**Priority**: P1-High
**Milestone**: A+ (Agent Tasks Enhancement)
**Phase**: 7 (Agent tasks)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## User Feedback Follow-up

From WI-056 end-user review: The existing `examples/agent-task/` example should demonstrate the new inline schema syntax added in WI-056. Users need a working example showing how to define output schemas inline.

## Description

Update the `examples/agent-task/agent-task.workpipe` example to demonstrate the inline schema syntax. This is the primary example users see for agent tasks, and it should showcase the full feature set including structured output schemas.

## Acceptance Criteria

- [x] Update `examples/agent-task/agent-task.workpipe` to include `output_schema` with inline type definition
- [x] Schema should demonstrate multiple features:
  - Object with properties
  - Array type
  - Nullable field (union with null)
  - String literal union (enum-like)
- [x] Update `examples/agent-task/README.md` to explain inline schema syntax
- [x] Update `examples/agent-task/expected.yml` with new output
- [x] Verify example compiles successfully with `workpipe build`

## Example Update

Current:
```workpipe
agent_task("Review the codebase and provide feedback") {
  model: "claude-sonnet-4-20250514"
  max_turns: 5
  tools: {
    allowed: ["Read", "Glob", "Grep"]
  }
  output_artifact: "review_result"
}
```

Updated (with inline schema):
```workpipe
agent_task("Review the codebase and provide feedback") {
  model: "claude-sonnet-4-20250514"
  max_turns: 5
  tools: {
    allowed: ["Read", "Glob", "Grep"]
  }
  output_artifact: "review_result"
  output_schema = {
    summary: string
    rating: int
    issues: [{
      file: string
      line: int
      message: string
      severity: "error" | "warning" | "info"
    }]
    recommendation: string | null
  }
}
```

## Technical Context

WI-056 implemented:
- Inline schema syntax in grammar
- AST nodes: SchemaTypeNode hierarchy
- JSON Schema generation in codegen
- Documentation in language-reference.md

This work item ensures the primary example file demonstrates the feature.

## Dependencies

- WI-056: JSON Schema Type Definitions (complete)

## Notes

- This is a P1 priority from end-user review
- Keep the example realistic but not overly complex
- Focus on showcasing the most common schema patterns
