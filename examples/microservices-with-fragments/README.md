# Microservices with Fragments Example

Demonstrates how fragments dramatically reduce code duplication in multi-service workflows.

## What This Demonstrates

- Using `job_fragment` to template repetitive jobs
- Parameterizing service-specific configurations
- Scaling workflows without code explosion
- Dependency management across instantiated jobs

## Before and After Comparison

### Without Fragments (Verbose)

```yaml
# Traditional YAML approach - 70+ lines for 3 services
jobs:
  build_api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myorg/api:latest ./services/api

  build_web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myorg/web:latest ./services/web

  build_worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myorg/worker:latest ./services/worker

  test_api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd services/api && npm test

  test_web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd services/web && npm test

  test_worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd services/worker && npm test

  deploy:
    runs-on: ubuntu-latest
    needs: [build_api, build_web, build_worker, test_api, test_web, test_worker]
    steps:
      - run: echo "Deploying all services"
```

### With Fragments (Concise)

```workpipe
job_fragment build_service {
  params { service: string }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    shell { docker build -t myorg/${{ params.service }}:latest ./services/${{ params.service }} }
  }
}

job_fragment test_service {
  params { service: string }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    shell { cd services/${{ params.service }} && npm test }
  }
}

workflow microservices {
  on: push

  job build_api = build_service { service: "api" }
  job build_web = build_service { service: "web" }
  job build_worker = build_service { service: "worker" }

  job test_api = test_service { service: "api" }
  job test_web = test_service { service: "web" }
  job test_worker = test_service { service: "worker" }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build_api, build_web, build_worker, test_api, test_web, test_worker]
    steps { shell { echo "Deploying all services" } }
  }
}
```

## Code Reduction Analysis

| Metric | Without Fragments | With Fragments | Reduction |
|--------|-------------------|----------------|-----------|
| Lines of code | 70+ | 35 | 50% |
| Repeated patterns | 6 | 0 | 100% |
| Places to update | 6 | 2 | 67% |

## Key Benefits

### 1. Single Point of Change
Update the fragment once, all services get the improvement:

```workpipe
job_fragment build_service {
  params { service: string }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    // Add caching - automatically applies to all services
    uses("docker/setup-buildx-action@v3") {}
    shell { docker build -t myorg/${{ params.service }}:latest ./services/${{ params.service }} }
  }
}
```

### 2. Easy Service Addition
Adding a new service is one line:

```workpipe
job build_auth = build_service { service: "auth" }
job test_auth = test_service { service: "auth" }
```

### 3. Consistent Patterns
All services use identical build and test patterns, reducing configuration drift.

## Workflow Graph

```
[push] --> build_api ──┐
          build_web ───┼──> deploy
          build_worker ┤
          test_api ────┤
          test_web ────┤
          test_worker ─┘
```

All build and test jobs run in parallel, deploy waits for all to complete.

## Compiling

```bash
workpipe build microservices-with-fragments.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
