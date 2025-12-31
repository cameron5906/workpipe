# Matrix Build Example

> **Status: Planned**
>
> This example is a placeholder for future matrix build support.

## Planned Features

Matrix builds allow running the same job across multiple configurations:

- Multiple Node.js versions (18, 20, 22)
- Multiple operating systems (ubuntu, windows, macos)
- Multiple test shards for parallel execution

## Proposed Syntax

```workpipe
workflow matrix_ci {
  on: [push, pull_request]

  job test matrix {
    runs_on: ubuntu-latest
    axes {
      node: [18, 20, 22]
      shard: [1..4]
    }
    max_parallel = 4
    fail_fast = false

    steps: [
      uses("actions/checkout@v4"),
      uses("actions/setup-node@v4"),
      run("npm ci"),
      run("npm test -- --shard=${{ matrix.shard }}/4")
    ]
  }
}
```

## Key Concepts (Planned)

1. **Matrix declaration**: `job name matrix { axes { ... } }`
2. **Axis values**: Define arrays or ranges for each dimension
3. **Parallelism control**: `max_parallel` limits concurrent jobs
4. **Failure handling**: `fail_fast` controls behavior on failures
5. **Artifact naming**: Automatic unique names per matrix combination

## Implementation Status

Matrix support is tracked in the WorkPipe roadmap (Phase 6).
See `PROJECT.md` for the full implementation plan.

## Related Examples

- [ci-pipeline](../ci-pipeline/) - Basic CI without matrices
- [simple-job](../simple-job/) - Job dependencies
