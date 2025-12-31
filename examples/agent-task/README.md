# Agent Task Example

A workflow demonstrating Claude Code integration for AI-powered automation.

## What This Demonstrates

- Using `agent_job` for AI-powered workflows
- Configuring `agent_task` with model and tool settings
- Restricting tools available to the agent
- Generating output artifacts from agent tasks

## Key Concepts

1. **Agent jobs**: `agent_job` blocks set up Claude Code Action integration
2. **Agent tasks**: `agent_task("prompt")` defines what the agent should do
3. **Model selection**: `model: "claude-sonnet-4-20250514"` specifies the model
4. **Turn limits**: `max_turns: 5` prevents runaway agent loops
5. **Tool restrictions**: `tools: { allowed: [...] }` limits agent capabilities
6. **Output artifacts**: `output_artifact` saves agent results for downstream use

## Source

```workpipe
workflow agent_demo {
  on: workflow_dispatch

  agent_job review {
    runs_on: ubuntu-latest
    steps: [
      uses("actions/checkout@v4"),
      agent_task("Review the codebase and provide feedback") {
        model: "claude-sonnet-4-20250514"
        max_turns: 5
        tools: {
          allowed: ["Read", "Glob", "Grep"]
        }
        output_artifact: "review_result"
      }
    ]
  }
}
```

## Compiling

```bash
workpipe build agent-task.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
