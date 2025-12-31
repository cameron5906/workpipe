# Implement agent_task Syntax and AST

**ID**: WI-026
**Status**: Completed
**Priority**: P1-High
**Milestone**: A+ (Core differentiator)
**Phase**: 7 (Agent Tasks)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Implement the `agent_task` syntax and AST nodes for WorkPipe's core differentiator: first-class agentic workflows with Claude Code integration. This enables users to define AI-powered tasks that compile to GitHub Actions workflows using the Claude Code Action.

## Acceptance Criteria

- [x] Grammar extended with `agent_job` and `agent_task` constructs
- [x] AST types for `AgentJobNode`, `AgentTaskNode`, `ToolsConfig`, `McpConfig`
- [x] AST builder handles agent constructs
- [x] YAML IR types for Claude Code Action steps
- [x] Transform generates proper Claude Code Action YAML
- [x] Output artifact upload generated
- [x] Example fixture with golden test
- [x] All tests passing

## Implementation Summary

### Phase 1 - Grammar
Extended Lezer grammar with:
- `agent_job` keyword and block structure
- `agent_task` with name and configuration block
- `model`, `max_turns` properties
- `tools { allowed = [...], disallowed = [...] }`
- `mcp { strict = true/false, config_file = "..." }`
- `system_prompt`, `prompt` with `file()` and `template()` functions
- `output_schema`, `output_artifact` properties
- `consumes` declarations

### Phase 2 - AST Types
Added to `packages/compiler/src/ast/types.ts`:
- `AgentJobNode` - job containing agent tasks
- `AgentTaskNode` - individual agent task configuration
- `ToolsConfig` - allowed/disallowed tools
- `McpConfig` - MCP server configuration
- `PromptValue` - string, file(), or template()
- `ConsumeNode` - artifact consumption
- `AnyJobNode` union type

### Phase 3 - AST Builder
Added builder functions in `packages/compiler/src/ast/builder.ts`:
- `buildAgentJob()`
- `buildAgentTask()`
- `buildToolsConfig()`
- `buildMcpConfig()`
- `buildPromptValue()`
- `buildConsumes()`

### Phase 4 - YAML IR
Added to `packages/compiler/src/codegen/yaml-ir.ts`:
- `ClaudeCodeStepIR` - Claude Code Action step
- `UploadArtifactStepIR` - artifact upload step
- Updated `StepIR` union

### Phase 5 - Transform
Added to `packages/compiler/src/codegen/transform.ts`:
- `transformAgentJob()` - transforms agent job to JobIR
- `transformAgentTask()` - builds claude_args from config
- Handles tools, MCP, prompts, output artifacts

### Phase 6 - Example
Created `examples/agent-task/`:
- `agent-task.workpipe` - example agent workflow
- `expected.yml` - expected GitHub Actions output

## Technical Context

From PROJECT.md Section 9 (Agentic tasks):
> WorkPipe's `agent_task` config must control:
> - MCP config (`--mcp-config`, `--strict-mcp-config`)
> - allowed/disallowed tools
> - model and max turns
> - system prompt strategy
> - structured output (`--json-schema`)
> - output artifact naming + retrieval

## Generated YAML Example

Input:
```workpipe
agent_job review {
  agent_task "code-reviewer" {
    model = "sonnet"
    max_turns = 5
    tools {
      allowed = ["Read", "Grep", "Glob"]
    }
    prompt = "Review the code changes"
    output_artifact = "review_output"
  }
}
```

Output:
```yaml
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          claude_args: --model sonnet --max-turns 5 --allowedTools Read,Grep,Glob
          prompt: Review the code changes
      - uses: actions/upload-artifact@v4
        with:
          name: review_output
          path: .workpipe/out/review_output.json
```

## Results

- 148 tests passing
- End-to-end compilation of agent tasks working
- Golden tests pass for all examples (minimal, simple-job, agent-task)
