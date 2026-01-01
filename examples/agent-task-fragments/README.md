# Agent Task Fragments Example

Demonstrates reusable job fragments containing agent tasks with parameterized prompts.

## What This Demonstrates

- Using `job_fragment` to create reusable AI-powered review jobs
- Parameterizing agent task prompts with fragment parameters
- Cross-file fragment imports with `import` syntax
- Multi-agent workflows with parallel reviews
- Structured output schemas in fragments
- Job dependencies to aggregate results

## Key Concepts

### Parameterized Agent Prompts

Fragment parameters can be substituted into agent task prompts, enabling flexible AI-powered workflows:

```workpipe
job_fragment code_reviewer {
  params {
    review_focus: string
  }

  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Review the codebase focusing on ${{ params.review_focus }}") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: { allowed: ["Read", "Glob", "Grep"] }
      output_schema: {
        rating: int
        summary: string
        issues: [string]
      }
      output_artifact: "review-result"
    }
  }
}
```

### Multi-Agent Patterns

Create specialized review agents by instantiating the same fragment with different parameters:

```workpipe
job security_review = code_reviewer { review_focus: "security vulnerabilities" }
job performance_review = code_reviewer { review_focus: "performance issues" }
job style_review = code_reviewer { review_focus: "code style and maintainability" }
```

### Cross-File Organization

Keep fragment definitions in a separate library file for reuse across workflows:

```
agent-task-fragments/
  fragments/
    agent-library.workpipe   <- Fragment definitions
  agent-task-fragments.workpipe  <- Main workflow
```

Import fragments using standard import syntax:
```workpipe
import { code_reviewer } from "./fragments/agent-library.workpipe"
```

## File Structure

### fragments/agent-library.workpipe

Contains reusable agent task fragments:

```workpipe
type ReviewFeedback {
  rating: int
  summary: string
  issues: [string]
}

job_fragment code_reviewer {
  params {
    review_focus: string
  }

  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Review the codebase focusing on ${{ params.review_focus }}") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: { allowed: ["Read", "Glob", "Grep"] }
      output_schema: {
        rating: int
        summary: string
        issues: [string]
      }
      output_artifact: "review-result"
    }
  }
}
```

### agent-task-fragments.workpipe

Main workflow that imports and uses the fragment:

```workpipe
import { code_reviewer } from "./fragments/agent-library.workpipe"

workflow comprehensive_review {
  on: pull_request

  job security_review = code_reviewer { review_focus: "security vulnerabilities" }
  job performance_review = code_reviewer { review_focus: "performance issues" }
  job style_review = code_reviewer { review_focus: "code style and maintainability" }

  job aggregate {
    runs_on: ubuntu-latest
    needs: [security_review, performance_review, style_review]
    steps {
      shell { echo "All reviews complete" }
    }
  }
}
```

## Workflow Graph

```
[pull_request] --> security_review ──┐
                  performance_review ──┼──> aggregate
                  style_review ───────┘
```

All three review jobs run in parallel, then aggregate waits for all to complete.

## Use Cases

- **Code Review Automation**: Different reviewers focus on security, performance, style
- **Multi-perspective Analysis**: Same codebase analyzed from different angles
- **Specialized AI Agents**: Each agent configured for its specific domain
- **Parallel Processing**: Multiple AI reviews run concurrently for faster feedback

## Compiling

```bash
workpipe build agent-task-fragments.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
