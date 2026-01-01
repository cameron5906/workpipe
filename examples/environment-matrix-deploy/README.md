# Environment Matrix Deploy Example

This example demonstrates combining matrix builds with guard conditions for staged environment deployments. Production deployments are gated to only run on the default branch.

## Features

- **Matrix + Guards**: Combine matrix iteration with conditional guards
- **Environment-Specific Logic**: Different behavior per environment
- **Branch Gating**: Production deploys only from main/master
- **Typed Results**: Structured deployment results using `DeployResult`

## Workflow Structure

### Type Definition

```workpipe
type DeployResult {
  environment: string
  success: bool
  deployed_version: string
}
```

The `DeployResult` type captures:
- `environment`: Target environment ("staging" or "production")
- `success`: Whether the deployment succeeded
- `deployed_version`: The version that was deployed

### Matrix Configuration

```workpipe
job deploy matrix {
  axes {
    env: [staging, production]
  }
  ...
}
```

This creates two matrix jobs:
1. Deploy to staging
2. Deploy to production

### Conditional Guard

```workpipe
step "gate" guard_js """
  if (matrix.env === 'production') {
    return guards.isDefaultBranch();
  }
  return true;
"""
```

This guard implements environment-specific logic:
- **Staging**: Always allowed (returns `true`)
- **Production**: Only allowed on the default branch

## Key Concepts

1. **Matrix in Guards**: Access `matrix.*` values inside guard expressions
2. **Conditional Logic**: Use JavaScript if/else for complex conditions
3. **Branch Protection**: `guards.isDefaultBranch()` checks for main/master
4. **Staged Deployments**: Deploy to staging on any branch, production only on main

## Deployment Flow

```
Feature Branch Push:
  staging  -> DEPLOYS (guard passes)
  production -> SKIPPED (guard fails - not default branch)

Main Branch Push:
  staging  -> DEPLOYS (guard passes)
  production -> DEPLOYS (guard passes - is default branch)
```

## Use Cases

This pattern is ideal for:
- **Continuous Deployment**: Auto-deploy to staging on every push
- **Protected Production**: Require merge to main for production deploys
- **Preview Environments**: Could extend matrix for PR-specific environments
- **Multi-Region Deploys**: Combine with region axes for geographic distribution

## Environment Safety

The guard ensures production safety by:
1. Checking if the current environment is production
2. If so, verifying the push is to the default branch
3. If not the default branch, the deployment step is skipped
4. Staging environments deploy on any branch

## Generated Output

The workflow compiles to GitHub Actions with:
- Matrix strategy for the environments
- Guard step that evaluates the JavaScript expression
- Conditional deployment based on guard result

## Related Examples

- [cross-platform-matrix-test](../cross-platform-matrix-test/) - Matrix without guards
- [smart-pr-workflow](../smart-pr-workflow/) - Guards without matrix
- [guard-job](../guard-job/) - Basic guard conditions
