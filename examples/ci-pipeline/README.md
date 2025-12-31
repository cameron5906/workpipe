# CI Pipeline Example

A typical continuous integration workflow with lint, test, build, and deploy stages.

## What This Demonstrates

- Parallel job execution (lint and test run concurrently)
- Job dependencies with `needs` for sequential stages
- Conditional deployment based on branch
- Standard CI workflow patterns

## Key Concepts

1. **Parallel jobs**: `lint` and `test` have no dependencies, so they run in parallel
2. **Dependency chains**: `build` waits for both `lint` and `test` via `needs: [lint, test]`
3. **Conditional execution**: `deploy` only runs on main branch pushes
4. **Standard actions**: Uses `actions/checkout@v4` and `actions/setup-node@v4`

## Workflow Graph

```
[push/PR] --> lint ──┐
              │      ├──> build --> deploy (main only)
              └──> test ─┘
```

## Source

```workpipe
workflow ci {
  on: [push, pull_request]

  job lint { ... }
  job test { ... }
  job build { needs: [lint, test] ... }
  job deploy { needs: [build] if: github.ref == "refs/heads/main" ... }
}
```

## Compiling

```bash
workpipe build ci-pipeline.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
