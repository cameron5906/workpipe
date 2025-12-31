# Guard Job Example

A workflow demonstrating step-level guard conditions using JavaScript expressions.

## What This Demonstrates

- Step-level guards with `guard_js` blocks
- JavaScript expressions for conditional logic
- Accessing GitHub event context in guards
- Filtering workflows based on issue labels

## Key Concepts

1. **Guard steps**: `step "name" guard_js "..."` defines a conditional check
2. **JavaScript expressions**: Guards evaluate JavaScript that returns a boolean
3. **Context access**: Guards can access `context.event` for GitHub event data
4. **Flow control**: Subsequent jobs wait for guard jobs via `needs`

## How Guards Work

Guard steps generate JavaScript that evaluates at runtime. If the guard returns `false`, the step fails (and by default, the job fails), preventing dependent jobs from running.

This is useful for:
- Filtering issues by labels before processing
- Validating PR conditions before running expensive tests
- Checking commit messages for skip patterns
- Any conditional workflow logic based on event data

## Source

```workpipe
workflow guard_job_example {
  on: issues

  job guard {
    runs_on: ubuntu-latest
    steps: [
      step "check_labels" guard_js """
        const labels = context.event.issue?.labels || [];
        const hasPriority = labels.some(l => l.name === 'priority');
        const isOpen = context.event.action === 'opened';
        return hasPriority && isOpen;
      """
    ]
  }

  job process {
    runs_on: ubuntu-latest
    needs: guard
    steps: [
      run("echo Processing priority issue..."),
      run("npm run process-issue")
    ]
  }
}
```

## Guard Expression Context

The `context` object in guard expressions includes:

| Property | Description |
|----------|-------------|
| `context.event` | The full GitHub event payload |
| `context.event.action` | The action that triggered the event (e.g., "opened", "closed") |
| `context.event.issue` | Issue data (for issue-triggered workflows) |
| `context.event.pull_request` | PR data (for PR-triggered workflows) |

## Common Guard Patterns

### Check Issue Labels

```javascript
const labels = context.event.issue?.labels || [];
return labels.some(l => l.name === 'bug');
```

### Check PR Base Branch

```javascript
return context.event.pull_request?.base?.ref === 'main';
```

### Check Commit Message

```javascript
const message = context.event.head_commit?.message || '';
return !message.includes('[skip ci]');
```

## Compiling

```bash
workpipe build guard-job.workpipe -o .
```

## Output

See [guard_job_example.yml](./guard_job_example.yml) for the generated GitHub Actions YAML.

## See Also

- [Cycle Basic](../cycle-basic/) - Guards in cycle termination conditions
- [Language Reference: Guard JS](../../docs/language-reference.md#guard-js-blocks) - Full guard documentation
