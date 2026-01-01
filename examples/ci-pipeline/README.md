# CI Pipeline Example

A typical continuous integration workflow with lint, test, build, and deploy stages.

## What This Demonstrates

- Parallel job execution (lint and test run concurrently)
- Job dependencies with `needs` for sequential stages
- Block syntax with `steps { }` and `shell { }` blocks
- Multi-line shell commands in a single block
- Conditional deployment based on branch
- Standard CI workflow patterns

## Key Concepts

1. **Parallel jobs**: `lint` and `test` have no dependencies, so they run in parallel
2. **Dependency chains**: `build` waits for both `lint` and `test` via `needs: [lint, test]`
3. **Shell blocks**: `shell { npm ci; npm run lint }` groups shell commands
4. **Conditional execution**: `deploy` only runs on main branch pushes
5. **Standard actions**: Uses `actions/checkout@v4` and `actions/setup-node@v4`

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

  job lint {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {}
      shell {
        npm ci
        npm run lint
      }
    }
  }

  job test {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {}
      shell {
        npm ci
        npm test
      }
    }
  }

  job build {
    runs_on: ubuntu-latest
    needs: [lint, test]
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {}
      shell {
        npm ci
        npm run build
      }
    }
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    if: github.ref == "refs/heads/main"
    steps {
      uses("actions/checkout@v4") {}
      shell { echo "Deploying to production..." }
    }
  }
}
```

## Compiling

```bash
workpipe build ci-pipeline.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
