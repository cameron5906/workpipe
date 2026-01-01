# Enterprise E2E Pipeline Example

> **Note**: This is an aspirational example demonstrating planned syntax. Some features shown here (such as `if: always()` conditions and advanced output expressions) are not yet fully implemented in WorkPipe. This example serves as a design reference for future development.

A complex enterprise testing pipeline demonstrating environment provisioning, parallel test execution, guaranteed cleanup, and notifications.

## What This Demonstrates

- Environment provisioning with output passing
- Parallel test suite execution (unit, integration, e2e)
- Results aggregation across multiple jobs
- Guaranteed teardown using `if: always()`
- Conditional notifications based on test outcomes

## Pipeline Structure

```
[push/PR] --> provision_env ──┬──> unit_tests ────────┬──> aggregate_results ──┐
                              ├──> integration_tests ─┤                        ├──> notify
                              └──> e2e_tests ─────────┴──> teardown ───────────┘
```

## Key Concepts

### 1. Environment Provisioning

The `provision_env` job creates a test environment and exports its URL and ID as outputs:

```workpipe
job provision_env {
  outputs: {
    env_url: string
    env_id: string
  }
  steps: [
    run("""
      echo "env_url=https://test-env-123.example.com" >> $GITHUB_OUTPUT
      echo "env_id=test-123" >> $GITHUB_OUTPUT
    """)
  ]
}
```

### 2. Parallel Test Execution

All three test jobs depend only on `provision_env`, so they run in parallel:

```workpipe
job unit_tests { needs: [provision_env] ... }
job integration_tests { needs: [provision_env] ... }
job e2e_tests { needs: [provision_env] ... }
```

### 3. Guaranteed Cleanup with `if: always()`

The `teardown` job runs regardless of test outcomes:

```workpipe
job teardown {
  needs: [unit_tests, integration_tests, e2e_tests]
  if: always()
  steps: [
    run("echo Tearing down environment ${{ needs.provision_env.outputs.env_id }}")
  ]
}
```

Without `if: always()`, teardown would be skipped if any test job fails, leaving orphaned resources.

### 4. Results Aggregation

The `aggregate_results` job collects outcomes from all test jobs using `needs.<job>.result`:

```workpipe
run("""
  echo "Unit Tests: ${{ needs.unit_tests.result }}"
  echo "Integration Tests: ${{ needs.integration_tests.result }}"
  echo "E2E Tests: ${{ needs.e2e_tests.result }}"
""")
```

### 5. Conditional Notifications

The `notify` job sends different notifications based on the overall outcome:

```workpipe
job notify {
  needs: [aggregate_results, teardown]
  if: always()
  ...
}
```

## Enterprise Patterns

| Pattern | Implementation |
|---------|----------------|
| Resource lifecycle | provision -> use -> teardown |
| Parallel testing | Independent jobs with shared dependency |
| Failure handling | `if: always()` ensures cleanup runs |
| Output passing | Typed outputs flow between jobs |
| Fan-in | Multiple jobs converge before notification |

## Compiling

```bash
workpipe build enterprise-e2e-pipeline.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
