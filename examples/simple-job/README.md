# Simple Job Example

A workflow with multiple jobs and job dependencies.

## What This Demonstrates

- Multiple triggers using array syntax
- Multiple jobs in a workflow
- Job dependencies with `needs`
- Conditional execution with `if`
- Using `shell { }` blocks for shell commands
- Using external actions with `uses() {}`

## Key Concepts

1. **Multiple triggers**: `on: [push, pull_request]` triggers on both events
2. **Action steps**: `uses("actions/checkout@v4") {}` invokes external actions
3. **Shell blocks**: `shell { npm install }` runs shell commands without quotes
4. **Job dependencies**: `needs: [build]` waits for build job to complete
5. **Conditionals**: `if: github.ref == "refs/heads/main"` guards job execution

## Source

```workpipe
workflow simple_job {
  on: [push, pull_request]

  job build {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      shell {
        npm install
        npm test
      }
    }
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    if: github.ref == "refs/heads/main"
    steps {
      uses("actions/checkout@v4") {}
      shell { npm run deploy }
    }
  }
}
```

## Compiling

```bash
workpipe build simple-job.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
