# Microservices Build Example

A workflow demonstrating parallel builds for multiple services with a fan-out/fan-in pattern.

## What This Demonstrates

- Parallel job execution for independent builds
- Fan-out pattern (build multiple services simultaneously)
- Fan-in pattern (converge for integration testing)
- Multi-stage pipeline with parallel and sequential phases
- Conditional publishing based on branch
- Job outputs for passing build artifacts

## Key Concepts

1. **Parallel builds**: Independent jobs (`build_api`, `build_web`, etc.) run concurrently
2. **Parallel tests**: Unit test jobs run in parallel with builds
3. **Fan-in convergence**: `integration_tests` waits for all builds and tests via `needs`
4. **Multi-phase testing**: Unit tests, contract tests, integration tests, then E2E
5. **Conditional execution**: `if: github.ref == "refs/heads/main"` for publish step

## Pipeline Flow

```
                    +-----------------+
                    |  push/PR event  |
                    +--------+--------+
                             |
    +------------------------+------------------------+
    |            |           |           |            |
    v            v           v           v            v
+-------+   +-------+   +-------+   +-------+    +-------+
|build  |   |build  |   |build  |   |build  |    | test  |
| _api  |   | _web  |   |_worker|   |_gate  |    | jobs  |
+-------+   +-------+   +-------+   +-------+    |(x4)   |
    |            |           |           |       +-------+
    +------------+-----------+-----------+            |
                             |                        |
        +--------------------+------------------------+
        |                                             |
        v                                             v
+-------+-------+                             +-------+-------+
|  integration  |                             |   contract    |
|    tests      |                             |    tests      |
+-------+-------+                             +-------+-------+
        |                                             |
        +----------------------+----------------------+
                               |
                               v
                      +--------+--------+
                      |   e2e_tests     |
                      +--------+--------+
                               |
          +--------------------+--------------------+
          |                                         |
          v                                         v
  +-------+-------+                         +-------+-------+
  | publish_images|                         |    notify     |
  | (main only)   |                         |  completion   |
  +---------------+                         +---------------+
```

## Key Pattern: Fan-Out/Fan-In

This example shows explicit parallel jobs for each service rather than matrix builds:

```workpipe
// Fan-out: Independent builds run in parallel
job build_api { ... }
job build_web { ... }
job build_worker { ... }
job build_gateway { ... }

// Fan-in: Wait for all parallel jobs to complete
job integration_tests {
  needs: [build_api, build_web, build_worker, build_gateway, test_api, test_web, test_worker, test_gateway]
  ...
}
```

This pattern is useful when:
- Each service has different build requirements
- You need fine-grained control over individual job configurations
- Services have different outputs that downstream jobs consume

## Source

```workpipe
workflow microservices_build {
  on: [push, pull_request]

  job build_api {
    runs_on: ubuntu-latest
    outputs: { image_tag: string }
    steps: [
      uses("actions/checkout@v4"),
      uses("docker/setup-buildx-action@v3"),
      run("docker build -t myorg/api:${{ github.sha }} ./services/api")
    ]
  }

  // Similar jobs for build_web, build_worker, build_gateway, test_*...

  job integration_tests {
    needs: [build_api, build_web, build_worker, build_gateway, ...]
    steps: [ ... ]
  }

  job e2e_tests {
    needs: [integration_tests, contract_tests]
    steps: [ ... ]
  }

  job publish_images {
    needs: [e2e_tests]
    if: github.ref == "refs/heads/main"
    steps: [ ... ]
  }
}
```

## Compiling

```bash
workpipe build microservices-build.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
