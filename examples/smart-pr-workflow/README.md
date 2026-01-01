# Smart PR Workflow Example

This example demonstrates guard conditions with helper functions for intelligent pull request handling. PRs are automatically filtered based on their state and labels.

## Features

- **Guard Conditions**: JavaScript-based guards that control step execution
- **Helper Functions**: Built-in `guards` API for common PR checks
- **Typed Outputs**: Structured decision data using the `PRDecision` type
- **Conditional Execution**: Steps only run when guards return true

## Workflow Structure

### Type Definition

```workpipe
type PRDecision {
  should_test: bool
  should_deploy: bool
  priority: string
}
```

The `PRDecision` type captures:
- `should_test`: Whether tests should run for this PR
- `should_deploy`: Whether this PR should trigger deployment
- `priority`: Priority level ("normal", "high", "hotfix")

### Guard Helper Functions

The `guards` object provides a readable API for common checks:

| Helper | Description |
|--------|-------------|
| `guards.isDraft()` | Returns true if the PR is a draft |
| `guards.hasLabel(name)` | Returns true if the PR has the specified label |
| `guards.hasAnyLabel(...names)` | Returns true if the PR has any of the specified labels |
| `guards.hasAllLabels(...names)` | Returns true if the PR has all specified labels |
| `guards.isDefaultBranch()` | Returns true if targeting the default branch |
| `guards.isPullRequest()` | Returns true if the event is a pull request |
| `guards.isBranch(name)` | Returns true if on the specified branch |
| `guards.isAction(action)` | Returns true if the event action matches |

### Guard Syntax

```workpipe
step "evaluate" guard_js """
  const isDraft = guards.isDraft();
  const isHotfix = guards.hasLabel('hotfix');
  const isWip = guards.hasLabel('wip');
  return !isDraft && !isWip;
"""
```

Guards are JavaScript expressions that:
- Have access to the `guards` helper object
- Have access to the `context` object with event details
- Return a boolean: `true` to continue, `false` to skip

## Key Concepts

1. **Guard Declaration**: Use `step "name" guard_js """ ... """` for JavaScript guards
2. **Helper API**: The `guards` object provides semantic, readable checks
3. **Context Access**: Full access to GitHub event data via `context.event`
4. **Short-Circuit**: If a guard returns false, the step is skipped
5. **Chained Logic**: Combine multiple helper calls with boolean operators

## Example Logic

This workflow implements intelligent PR filtering:

1. **Skip drafts**: Draft PRs don't trigger full CI
2. **Skip WIP**: PRs labeled "wip" are work-in-progress
3. **Allow hotfixes**: Hotfix PRs could have special handling
4. **Normal flow**: Only non-draft, non-WIP PRs proceed to testing

## Generated Output

The guard compiles to a GitHub Actions step that evaluates the JavaScript expression and sets an output. Subsequent steps can depend on this output for conditional execution.

## Related Examples

- [guard-job](../guard-job/) - Basic guard conditions
- [environment-matrix-deploy](../environment-matrix-deploy/) - Guards with matrix builds
