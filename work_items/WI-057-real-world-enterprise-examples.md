# WI-057: Real-World Enterprise Examples

**ID**: WI-057
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: E (Documentation)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## User Feedback

> "I like the idea behind workpipe, but i'm trying to understand how I can use it at my company. We have some pretty intricate build systems, including ones that spin up an entire environment, run a series of automated test suites, and then brings it down and does some post-work. Your examples aren't very 'real-world'"

## Description

Current examples demonstrate individual features but lack realistic enterprise scenarios. Users need examples showing:
- Complex multi-stage pipelines
- Environment provisioning and teardown
- Multiple test suites with reporting
- Real-world deployment patterns
- Integration with common enterprise tools

## Acceptance Criteria

### New Example: Enterprise E2E Test Pipeline
- [ ] Create `examples/enterprise-e2e-pipeline/`
- [ ] WorkPipe file demonstrating:
  - Environment spin-up job (infrastructure provisioning)
  - Multiple test suite jobs (unit, integration, e2e)
  - Test result aggregation
  - Environment teardown (cleanup regardless of test results)
  - Post-work jobs (artifact archival, notifications)
- [ ] README explaining the pattern and enterprise applicability
- [ ] Expected YAML output

### New Example: Multi-Environment Deployment
- [ ] Create `examples/multi-environment-deploy/`
- [ ] WorkPipe file demonstrating:
  - Build once, deploy many pattern
  - Staging -> Production promotion
  - Environment-specific configuration
  - Manual approval gates (workflow_dispatch inputs)
  - Rollback considerations
- [ ] README explaining blue-green/canary patterns
- [ ] Expected YAML output

### New Example: Microservices Build Matrix
- [ ] Create `examples/microservices-build/`
- [ ] WorkPipe file demonstrating:
  - Matrix build across multiple services
  - Shared build artifacts
  - Service dependency ordering
  - Parallel deployments with controlled rollout
- [ ] README explaining microservices CI/CD patterns
- [ ] Expected YAML output

### Documentation Updates
- [ ] Update `examples/README.md` with new enterprise section
- [ ] Add "Enterprise Patterns" learning path
- [ ] Link from main README.md

## Example Structures

### Enterprise E2E Pipeline

```workpipe
workflow e2e_pipeline {
  on: push

  // Stage 1: Build
  job build {
    runs_on: ubuntu-latest
    outputs: {
      image_tag: string
      artifact_path: string
    }
    steps: [
      uses("actions/checkout@v4"),
      run("""
        docker build -t app:${{ github.sha }} .
        echo "image_tag=${{ github.sha }}" >> $GITHUB_OUTPUT
      """)
    ]
  }

  // Stage 2: Spin up test environment
  job provision_env {
    runs_on: ubuntu-latest
    needs: [build]
    outputs: {
      env_url: string
      env_id: string
    }
    steps: [
      run("""
        # Provision cloud resources (e.g., Terraform, Pulumi)
        terraform apply -auto-approve
        echo "env_url=$(terraform output -raw url)" >> $GITHUB_OUTPUT
        echo "env_id=$(terraform output -raw id)" >> $GITHUB_OUTPUT
      """)
    ]
  }

  // Stage 3: Run test suites (parallel)
  job test_unit {
    runs_on: ubuntu-latest
    needs: [provision_env]
    steps: [
      run("npm run test:unit -- --reporter=junit")
    ]
  }

  job test_integration {
    runs_on: ubuntu-latest
    needs: [provision_env]
    steps: [
      run("npm run test:integration -- --reporter=junit")
    ]
  }

  job test_e2e {
    runs_on: ubuntu-latest
    needs: [provision_env]
    steps: [
      run("""
        export TEST_URL=${{ needs.provision_env.outputs.env_url }}
        npm run test:e2e -- --reporter=junit
      """)
    ]
  }

  // Stage 4: Aggregate results
  job aggregate_results {
    runs_on: ubuntu-latest
    needs: [test_unit, test_integration, test_e2e]
    steps: [
      run("./scripts/aggregate-test-results.sh")
    ]
  }

  // Stage 5: Teardown (always runs)
  job teardown_env {
    runs_on: ubuntu-latest
    needs: [aggregate_results]
    if: always()
    steps: [
      run("""
        terraform destroy -auto-approve
        echo "Environment ${{ needs.provision_env.outputs.env_id }} destroyed"
      """)
    ]
  }

  // Stage 6: Post-work
  job notify {
    runs_on: ubuntu-latest
    needs: [teardown_env]
    if: always()
    steps: [
      run("./scripts/send-notification.sh")
    ]
  }
}
```

### Multi-Environment Deployment

```workpipe
workflow deploy_pipeline {
  triggers {
    on push {
      branches: ["main"]
    }
    on workflow_dispatch {
      input environment: enum<"staging", "production"> required
      input skip_tests: bool = false
    }
  }

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
    }
    steps: [
      uses("actions/checkout@v4"),
      run("""
        VERSION=$(git describe --tags --always)
        npm run build
        echo "version=$VERSION" >> $GITHUB_OUTPUT
      """)
    ]
  }

  job deploy_staging {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("""
        ./deploy.sh staging ${{ needs.build.outputs.version }}
      """)
    ]
  }

  job smoke_test_staging {
    runs_on: ubuntu-latest
    needs: [deploy_staging]
    steps: [
      run("./smoke-test.sh https://staging.example.com")
    ]
  }

  job deploy_production {
    runs_on: ubuntu-latest
    needs: [smoke_test_staging]
    if: github.event.inputs.environment == "production"
    steps: [
      run("""
        ./deploy.sh production ${{ needs.build.outputs.version }}
      """)
    ]
  }
}
```

## Technical Context

Current examples focus on feature demonstration:
- `minimal/` - syntax basics
- `simple-job/` - job dependencies
- `ci-pipeline/` - basic CI (lint, test, build)
- `release-workflow/` - manual dispatch

Missing enterprise patterns:
- Infrastructure-as-code integration (Terraform, Pulumi)
- Container orchestration
- Multi-environment promotion
- Cleanup/teardown with `if: always()`
- Test result aggregation
- Notification integrations

## Dependencies

- None - documentation/examples only

## Notes

- These examples should be comprehensive but still compilable
- Focus on patterns, not specific vendor tooling
- Include comments explaining enterprise considerations
- Consider creating a dedicated `examples/enterprise/` subdirectory
- May need `raw_yaml` blocks for features not yet in grammar
