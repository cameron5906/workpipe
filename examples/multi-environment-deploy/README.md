# Multi-Environment Deployment

This example demonstrates the build-once, deploy-many pattern with environment promotion.

## Pattern Overview

```
build → deploy_staging → deploy_production
         (automatic)       (can require approval)
```

**Key principle**: Build artifacts once, then promote the same artifact through environments. This ensures what you test in staging is exactly what runs in production.

## Workflow Structure

### Build Job
- Creates a Docker image tagged with the commit SHA
- Outputs the image tag for downstream jobs
- Runs only once, regardless of how many environments exist

### Deploy Staging
- Automatically triggered after successful build
- Deploys and runs smoke tests
- Uses the `environment: staging` declaration

### Deploy Production
- Triggered after staging succeeds
- Uses the `environment: production` declaration
- Can require manual approval (see below)

## Adding Manual Approval Gates

To require approval before production deployment, configure environment protection rules in GitHub:

1. Go to **Settings → Environments → production**
2. Enable **Required reviewers**
3. Add team members who can approve deployments

The workflow will pause at `deploy_production` until an approved reviewer clicks "Approve" in the Actions UI.

## Environment Secrets

Each environment can have its own secrets:

- `staging` environment: staging cluster credentials
- `production` environment: production cluster credentials

Access them the same way (`${{ secrets.KUBE_CONFIG }}`), but each environment resolves to its own values.

## Extending This Pattern

Add more environments by inserting jobs in the chain:

```workpipe
job deploy_qa {
  needs: [build]
  environment: qa
}

job deploy_staging {
  needs: [deploy_qa]
  environment: staging
}

job deploy_production {
  needs: [deploy_staging]
  environment: production
}
```
