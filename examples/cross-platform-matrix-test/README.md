# Cross-Platform Matrix Test Example

This example demonstrates matrix builds with typed test results across multiple Node.js versions and operating system platforms.

## Features

- **Matrix Builds**: Run the same test job across 9 different configurations
- **Typed Outputs**: Test results use a structured `TestMatrix` type
- **Cross-Platform Testing**: Tests matrix includes Ubuntu, macOS, and Windows
- **Parallel Execution**: Up to 6 concurrent matrix jobs

## Workflow Structure

### Type Definition

```workpipe
type TestMatrix {
  platform: string
  node_version: int
  passed: bool
  duration: float
}
```

The `TestMatrix` type captures:
- `platform`: The OS where the test ran (e.g., "ubuntu-latest")
- `node_version`: The Node.js major version (18, 20, or 22)
- `passed`: Whether the tests passed
- `duration`: How long the tests took in seconds

### Matrix Configuration

```workpipe
job test matrix {
  axes {
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest, windows-latest]
  }
  max_parallel = 6
  fail_fast = false
  ...
}
```

This generates 9 job combinations:
| Node | OS |
|------|-----|
| 18 | ubuntu-latest |
| 18 | macos-latest |
| 18 | windows-latest |
| 20 | ubuntu-latest |
| 20 | macos-latest |
| 20 | windows-latest |
| 22 | ubuntu-latest |
| 22 | macos-latest |
| 22 | windows-latest |

### Matrix Options

- `max_parallel = 6`: Limits concurrent jobs to 6 (useful for resource management)
- `fail_fast = false`: Continue running other matrix jobs even if one fails

### Accessing Matrix Values

Use `${{ matrix.<axis> }}` in expressions to access current matrix values:

```workpipe
run("echo \"result={\\\"platform\\\":\\\"${{ matrix.os }}\\\",\\\"node_version\\\":${{ matrix.node }},...}\" >> $GITHUB_OUTPUT")
```

## Key Concepts

1. **Matrix Declaration**: Use `job name matrix { axes { ... } }` to define matrix jobs
2. **Axis Values**: Arrays define the values for each dimension
3. **Cross-Product**: All combinations of axis values are generated
4. **Variable Access**: Use `${{ matrix.<axis> }}` in expressions to reference current values
5. **Parallelism Control**: `max_parallel` limits concurrent executions
6. **Failure Handling**: `fail_fast` controls whether to cancel on first failure

## Generated Output

The workflow compiles to GitHub Actions workflow YAML with a proper matrix strategy configuration, enabling parallel test execution across all platform and version combinations.

## Current Limitations

- Static `runs_on`: The runner must be specified statically (e.g., `runs_on: ubuntu-latest`), not dynamically via matrix values
- Matrix jobs use array syntax for steps: `steps: [...]`

## Related Examples

- [environment-matrix-deploy](../environment-matrix-deploy/) - Matrices with guard conditions
- [ci-pipeline](../ci-pipeline/) - Basic CI without matrices
