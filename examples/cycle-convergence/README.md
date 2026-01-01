# Cycle Convergence Example

A workflow demonstrating iterative refinement using WorkPipe cycles with measurable convergence.

## What This Demonstrates

- Cycle blocks for iterative workflows
- Guard conditions based on iteration state
- User-defined types for structured outputs
- Convergence patterns with max iteration limits
- Cycle state management across workflow runs

## Key Concepts

1. **User-defined types**: `QualityMetrics` defines a structured output schema
2. **Cycle declaration**: `cycle improve { ... }` creates an iterative block
3. **Iteration limit**: `max_iters = 5` prevents infinite loops
4. **State-based guard**: `until guard_js "return state.iteration >= 3;"` stops after 3 iterations
5. **Cycle key**: `key = "quality"` identifies the cycle for state tracking
6. **Typed outputs**: Jobs can output structured data using custom types

## How Cycles Work

GitHub Actions only supports DAG (directed acyclic graph) workflows. WorkPipe compiles cycles into:

1. **Hydration job**: Loads state from previous runs via artifacts
2. **Body jobs**: Execute the iteration work (analyze, fix)
3. **Decision job**: Evaluates the guard condition
4. **Dispatch job**: Triggers the next iteration if needed

Each iteration is a separate workflow run, with state passed via artifacts.

## Convergence Patterns

This example demonstrates a simple convergence pattern:
- Each iteration analyzes code quality
- Fixes are applied based on analysis
- The cycle terminates when a condition is met (3 iterations)

In real-world scenarios, you might check for:
- Quality score exceeding a threshold
- No more issues found
- Consensus reached among reviewers

## Source

```workpipe
type QualityMetrics {
  score: int
  issues_found: int
}

workflow quality_improvement {
  on: workflow_dispatch

  cycle improve {
    max_iters = 5
    key = "quality"

    until guard_js """
      return state.iteration >= 3;
    """

    body {
      job analyze {
        runs_on: ubuntu-latest
        outputs: { metrics: QualityMetrics }
        steps {
          uses("actions/checkout@v4") {}
          shell {
            echo "Analyzing code quality..."
            echo "metrics={\"score\":85,\"issues_found\":3}" >> $GITHUB_OUTPUT
          }
        }
      }

      job fix {
        runs_on: ubuntu-latest
        needs: [analyze]
        steps {
          shell { echo "Fixing identified issues..." }
        }
      }
    }
  }

  job report {
    runs_on: ubuntu-latest
    steps {
      shell { echo "Quality improvement cycle complete!" }
    }
  }
}
```

## Compiling

```bash
workpipe build cycle-convergence.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions workflow with cycle support.

## Iteration State

The cycle maintains state between iterations:
- `state.iteration` tracks the current iteration number
- Custom state can be added and persisted via artifacts
- The guard condition has access to the full state object

## Related Examples

- [cycle-basic](../cycle-basic) - Basic cycle with agent tasks
- [iterative-refinement](../iterative-refinement) - Another cycle pattern
- [parallel-iterative-agents](../parallel-iterative-agents) - Cycles with parallel agents
