# Release Workflow Example

A manual release workflow triggered via `workflow_dispatch` with parallel stages.

## What This Demonstrates

- Manual workflow triggers with `workflow_dispatch`
- Complex dependency graphs with parallel middle stages
- Release automation patterns (validate, build, publish, notify)

## Key Concepts

1. **Manual triggers**: `on: workflow_dispatch` allows manual runs from GitHub UI
2. **Parallel stages**: `build_artifacts` and `generate_changelog` run in parallel
3. **Fan-in pattern**: `publish` waits for multiple parallel jobs to complete
4. **Linear pipeline**: Final `notify` job runs after publish completes

## Workflow Graph

```
[manual trigger]
       │
       v
   validate
       │
   ┌───┴───┐
   v       v
build   changelog
   │       │
   └───┬───┘
       v
    publish
       │
       v
    notify
```

## Source

```workpipe
workflow release {
  on: workflow_dispatch

  job validate { ... }
  job build_artifacts { needs: [validate] ... }
  job generate_changelog { needs: [validate] ... }
  job publish { needs: [build_artifacts, generate_changelog] ... }
  job notify { needs: [publish] ... }
}
```

## Compiling

```bash
workpipe build release-workflow.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
