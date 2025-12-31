# Iterative Refinement Example

An AI-powered documentation improvement workflow using cycles for iterative review.

## What This Demonstrates

- Cycles for iterative workflows that span multiple runs
- Agent tasks within cycle bodies for AI-powered processing
- Guard conditions with state-based termination
- Combining regular jobs with agent jobs in cycles

## Key Concepts

1. **Cycle blocks**: `cycle improve_docs { ... }` defines an iterative process
2. **Max iterations**: `max_iters = 3` prevents infinite loops
3. **Guard termination**: `until guard_js` checks if work is complete
4. **State passing**: Cycles pass state between runs via artifacts
5. **Agent integration**: AI agents perform work each iteration

## How It Works

GitHub Actions only supports DAG workflows. WorkPipe compiles cycles into:
1. A hydrate job that loads state from previous iterations
2. Body jobs that execute the cycle work (AI review + apply fixes)
3. A decide job that evaluates the termination guard
4. A dispatch job that triggers the next iteration via `workflow_dispatch`

## Workflow Graph (per iteration)

```
[dispatch] --> hydrate --> review_docs --> apply_suggestions --> decide --> [dispatch next?]
```

## Source

```workpipe
workflow doc_refinement {
  on: workflow_dispatch

  job initialize { ... }

  cycle improve_docs {
    max_iters = 3
    until guard_js """ return context.approval_count >= 2; """
    body { agent_job review_docs { ... } job apply_suggestions { ... } }
  }

  job finalize { ... }
}
```

## Compiling

```bash
workpipe build iterative-refinement.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated workflow with cycle support.
