# Cycle Basic Example

A workflow demonstrating iterative refinement using WorkPipe cycles.

## What This Demonstrates

- Cycle blocks for iterative workflows
- Guard conditions for cycle termination
- Combining cycles with regular jobs
- Cross-run artifact passing via `workflow_dispatch`

## Key Concepts

1. **Cycle declaration**: `cycle name { ... }` defines an iterative block
2. **Iteration limit**: `max_iters = 5` prevents infinite loops
3. **Termination guard**: `until guard_js "..."` stops when condition is met
4. **Cycle body**: Jobs inside `body { ... }` execute each iteration
5. **State management**: WorkPipe generates hydration/decision jobs automatically

## How Cycles Work

GitHub Actions only supports DAG workflows. WorkPipe compiles cycles into:
- A hydration job that loads state from previous runs
- Body jobs that execute the iteration work
- A decision job that evaluates the guard condition
- A dispatch job that triggers the next iteration if needed

## Source

```workpipe
workflow cycle_basic {
  on: push

  job setup { ... }

  cycle refine_loop {
    max_iters = 5
    key = "iteration"
    until guard_js """
      return context.quality_score > 0.95;
    """
    body { ... }
  }

  job cleanup { ... }
}
```

## Compiling

```bash
workpipe build cycle-basic.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated workflow with cycle support.
