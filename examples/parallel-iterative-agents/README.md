# Parallel Iterative Agents Example

A workflow demonstrating multi-agent orchestration within iterative cycles for comprehensive code review.

## What This Demonstrates

- Parallel agent jobs within a cycle body
- Multiple specialized AI agents working concurrently
- Aggregation of parallel agent outputs
- Iterative review with convergence conditions
- User-defined types for structured feedback

## Key Concepts

1. **User-defined types**: `ReviewFeedback` and `AggregatedReview` define structured outputs
2. **Parallel agents**: `reviewer_clarity` and `reviewer_security` run simultaneously
3. **Agent jobs**: `agent_job` with `agent_task` for AI-powered review
4. **Aggregation job**: Collects and combines results from parallel agents
5. **Cycle iteration**: Repeats the review process until convergence

## Workflow Structure

```
                    +------------------+
                    |  workflow_dispatch|
                    +--------+---------+
                             |
                    +--------v---------+
                    | review_cycle_hydrate|
                    +--------+---------+
                             |
           +-----------------+------------------+
           |                                    |
           v                                    v
+----------+-----------+            +-----------+----------+
|  reviewer_clarity    |            |  reviewer_security   |
| (agent: readability) |            | (agent: security)    |
+----------+-----------+            +-----------+----------+
           |                                    |
           +-----------------+------------------+
                             |
                    +--------v---------+
                    |     aggregate    |
                    +--------+---------+
                             |
                    +--------v---------+
                    | review_cycle_decide|
                    +--------+---------+
                             |
                   +---------+---------+
                   |                   |
            continue?              complete
                   |                   |
                   v                   v
         +--------+--------+    +--------+
         |   dispatch      |    | finalize|
         | (next iteration)|    +--------+
         +-----------------+
```

## Parallel Agent Pattern

Each agent is specialized for a specific concern:

1. **Clarity Reviewer**: Focuses on code readability, naming, and structure
2. **Security Reviewer**: Focuses on security vulnerabilities and best practices

Benefits of parallel agents:
- Faster overall review time (agents run concurrently)
- Specialized expertise in each area
- Independent analysis without bias from other reviewers

## Agent Configuration

Each agent task includes:
- **model**: The Claude model to use
- **max_turns**: Maximum interaction turns
- **tools**: Allowed tools (Read, Glob, Grep)
- **output_schema**: Structured output format
- **output_artifact**: Artifact name for results

## Aggregation Pattern

The `aggregate` job:
- Waits for all parallel agents to complete
- Collects and processes their outputs
- Produces a unified result (average score, consensus status)
- Determines if another iteration is needed

## Source

```workpipe
type ReviewFeedback {
  reviewer: string
  score: int
  suggestions: [string]
}

type AggregatedReview {
  average_score: int
  consensus_reached: bool
}

workflow multi_reviewer {
  on: workflow_dispatch

  cycle review_cycle {
    max_iters = 3
    key = "review"

    until guard_js """
      return state.iteration >= 2;
    """

    body {
      agent_job reviewer_clarity {
        runs_on: ubuntu-latest
        steps {
          uses("actions/checkout@v4") {}
          agent_task("Review code for clarity and readability") {
            model: "claude-sonnet-4-20250514"
            max_turns: 3
            tools: { allowed: ["Read", "Glob"] }
            output_schema: ReviewFeedback
            output_artifact: "review-clarity"
          }
        }
      }

      agent_job reviewer_security {
        runs_on: ubuntu-latest
        steps {
          uses("actions/checkout@v4") {}
          agent_task("Review code for security issues") {
            model: "claude-sonnet-4-20250514"
            max_turns: 3
            tools: { allowed: ["Read", "Glob", "Grep"] }
            output_schema: ReviewFeedback
            output_artifact: "review-security"
          }
        }
      }

      job aggregate {
        runs_on: ubuntu-latest
        needs: [reviewer_clarity, reviewer_security]
        outputs: { result: AggregatedReview }
        steps {
          shell {
            echo "Aggregating reviews..."
            echo "result={\"average_score\":4,\"consensus_reached\":true}" >> $GITHUB_OUTPUT
          }
        }
      }
    }
  }

  job finalize {
    runs_on: ubuntu-latest
    steps {
      shell { echo "Review cycle complete!" }
    }
  }
}
```

## Compiling

```bash
workpipe build parallel-iterative-agents.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions workflow.

## Use Cases

- **Code Review**: Multiple perspectives on code quality
- **Content Review**: Editorial and technical review in parallel
- **Security Audit**: Different security concerns checked simultaneously
- **Quality Gates**: Multiple quality checks before approval

## Related Examples

- [cycle-convergence](../cycle-convergence) - Basic cycle with convergence
- [agent-task](../agent-task) - Single agent task example
- [diamond-dependency](../diamond-dependency) - Fan-out/fan-in without cycles
