# Minimal Example

The simplest possible WorkPipe specification.

## What This Demonstrates

- Basic workflow declaration with `workflow` block
- Single trigger using `on: push`
- Single job with `runs_on` and `steps`
- Using `shell { }` blocks for shell commands

## Key Concepts

1. **Workflow name**: Declared as `workflow minimal { ... }`
2. **Trigger**: Simple `on: push` triggers on every push
3. **Job definition**: Jobs contain `runs_on` (runner) and `steps` (actions)
4. **Shell block**: `shell { command }` executes shell commands without quotes

## Source

```workpipe
workflow minimal {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps {
      shell { echo "Hello, WorkPipe!" }
    }
  }
}
```

## Compiling

```bash
workpipe build minimal.workpipe -o .
```

This generates `minimal.yml` - a valid GitHub Actions workflow.

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
