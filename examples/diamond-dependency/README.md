# Diamond Dependency Example

A workflow demonstrating complex fan-out/fan-in dependency patterns with parallel execution.

## What This Demonstrates

- Fan-out pattern (one job spawns multiple parallel jobs)
- Fan-in pattern (multiple jobs converge to a single job)
- Diamond dependency graph structure
- User-defined types for build outputs
- Parallel execution within dependency constraints

## Key Concepts

1. **User-defined types**: `BuildResult` defines structured build output
2. **Fan-out**: `prepare` job triggers `build_api`, `build_web`, `build_worker` in parallel
3. **Fan-in**: `test_integration` waits for all three build jobs
4. **Diamond shape**: Single root, parallel middle tier, single convergence point

## Dependency Graph

```
                +----------+
                | prepare  |
                +----+-----+
                     |
       +-------------+-------------+
       |             |             |
       v             v             v
 +---------+   +---------+   +-----------+
 |build_api|   |build_web|   |build_worker|
 +---------+   +---------+   +-----------+
       |             |             |
       +-------------+-------------+
                     |
                     v
          +------------------+
          | test_integration |
          +--------+---------+
                   |
                   v
             +----------+
             |  deploy  |
             +----------+
```

## Why Diamond Dependencies Matter

Diamond patterns are common in real-world pipelines:

1. **Build parallelization**: Build multiple services from shared preparation
2. **Test convergence**: Run integration tests after all builds complete
3. **Resource efficiency**: Parallel jobs utilize separate runners
4. **Clear dependencies**: Each job explicitly declares what it needs

## Parallel Execution

GitHub Actions runs jobs in parallel when their dependencies are satisfied:
- `build_api`, `build_web`, `build_worker` run simultaneously after `prepare`
- `test_integration` waits for all builds before starting
- `deploy` runs only after integration tests pass

## Source

```workpipe
type BuildResult {
  artifact_path: string
  checksum: string
}

workflow release_pipeline {
  on: push

  job prepare {
    runs_on: ubuntu-latest
    outputs: { version: string }
    steps {
      uses("actions/checkout@v4") {}
      shell { echo "version=1.0.0" >> $GITHUB_OUTPUT }
    }
  }

  job build_api {
    runs_on: ubuntu-latest
    needs: [prepare]
    outputs: { result: BuildResult }
    steps {
      shell { echo "Building API..." }
    }
  }

  job build_web {
    runs_on: ubuntu-latest
    needs: [prepare]
    outputs: { result: BuildResult }
    steps {
      shell { echo "Building Web..." }
    }
  }

  job build_worker {
    runs_on: ubuntu-latest
    needs: [prepare]
    outputs: { result: BuildResult }
    steps {
      shell { echo "Building Worker..." }
    }
  }

  job test_integration {
    runs_on: ubuntu-latest
    needs: [build_api, build_web, build_worker]
    steps {
      shell { echo "Running integration tests..." }
    }
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [test_integration]
    steps {
      shell { echo "Deploying all services..." }
    }
  }
}
```

## Compiling

```bash
workpipe build diamond-dependency.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions workflow.

## Related Examples

- [microservices-build](../microservices-build) - Larger fan-out/fan-in pattern
- [staged-approval](../staged-approval) - Sequential stage gating
- [ci-pipeline](../ci-pipeline) - Simple multi-job pipeline
