# Staged Approval Example

A workflow demonstrating stage gating with multiple quality checkpoints before deployment.

## What This Demonstrates

- Sequential stage gating pattern
- Quality gates that must pass before proceeding
- User-defined types for structured reports
- Linear dependency chain for approval workflows
- Each stage acts as a checkpoint

## Key Concepts

1. **User-defined types**: `SecurityReport` defines structured security scan output
2. **Sequential stages**: Each job depends on the previous one completing
3. **Quality gates**: Lint, test, and security scan must pass before deploy
4. **Staged outputs**: Each stage produces outputs that can inform decisions
5. **Linear chain**: `lint -> test -> security_scan -> deploy`

## Pipeline Flow

```
+--------+     +--------+     +---------------+     +--------+
|  lint  | --> |  test  | --> | security_scan | --> | deploy |
+--------+     +--------+     +---------------+     +--------+
     |              |                  |
     v              v                  v
  passed?       coverage?         vulnerabilities?
```

## Stage Gating Pattern

Each stage acts as a quality gate:

1. **Lint Stage**: Ensures code style compliance
2. **Test Stage**: Verifies functionality and reports coverage
3. **Security Stage**: Scans for vulnerabilities
4. **Deploy Stage**: Only runs if all gates pass

If any stage fails, subsequent stages do not execute.

## Why Sequential Stages Matter

Unlike parallel execution, sequential stages ensure:
- Each check runs only after the previous succeeds
- Early failures prevent wasted compute on later stages
- Clear audit trail of what passed before deployment
- Easy to add intermediate gates (performance, compliance, etc.)

## Extending with Conditional Logic

You can add conditional deployment based on stage outputs:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [security_scan]
  if: fromJSON(needs.security_scan.outputs.report).severity_high == 0
  steps {
    shell { echo "Deploying approved release..." }
  }
}
```

## Source

```workpipe
type SecurityReport {
  vulnerabilities: int
  severity_high: int
}

workflow staged_deployment {
  on: workflow_dispatch

  job lint {
    runs_on: ubuntu-latest
    outputs: { passed: string }
    steps {
      uses("actions/checkout@v4") {}
      shell {
        npm run lint
        echo "passed=true" >> $GITHUB_OUTPUT
      }
    }
  }

  job test {
    runs_on: ubuntu-latest
    needs: [lint]
    outputs: { coverage: int }
    steps {
      shell {
        npm test
        echo "coverage=85" >> $GITHUB_OUTPUT
      }
    }
  }

  job security_scan {
    runs_on: ubuntu-latest
    needs: [test]
    outputs: { report: SecurityReport }
    steps {
      shell {
        echo "Scanning for vulnerabilities..."
        echo "report={\"vulnerabilities\":0,\"severity_high\":0}" >> $GITHUB_OUTPUT
      }
    }
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [security_scan]
    steps {
      shell { echo "Deploying approved release..." }
    }
  }
}
```

## Compiling

```bash
workpipe build staged-approval.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions workflow.

## Related Examples

- [diamond-dependency](../diamond-dependency) - Parallel fan-out/fan-in pattern
- [ci-pipeline](../ci-pipeline) - Combined parallel and sequential stages
- [release-workflow](../release-workflow) - Release-specific staged workflow
