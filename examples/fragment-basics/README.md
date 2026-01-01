# Fragment Basics Example

Demonstrates the WorkPipe fragment system for reusable workflow components.

## What This Demonstrates

- Using `job_fragment` to define reusable job templates
- Using `steps_fragment` to define reusable step sequences
- Parameterizing fragments with required and optional parameters
- Default parameter values
- Fragment instantiation with `job name = fragment_name { params }`
- Steps fragment spread with `...fragment_name { params }`

## Key Concepts

### Job Fragments

A `job_fragment` defines a complete, reusable job template. Use it when you have similar jobs that differ only in configuration:

```workpipe
job_fragment service_build {
  params {
    service_name: string         // Required parameter
    node_version: string = "20"  // Optional with default
  }

  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    shell { cd services/${{ params.service_name }} && npm ci && npm run build }
  }
}
```

Instantiate with assignment syntax:
```workpipe
job api = service_build { service_name: "api" }
job web = service_build { service_name: "web" node_version: "18" }
```

### Steps Fragments

A `steps_fragment` defines a reusable sequence of steps. Use it when multiple jobs share setup or teardown patterns:

```workpipe
steps_fragment checkout_and_setup {
  params {
    node_version: string = "20"
  }
  uses("actions/checkout@v4") {}
  shell { npm ci }
}
```

Spread into a job's steps block:
```workpipe
job lint {
  runs_on: ubuntu-latest
  steps {
    ...checkout_and_setup {}
    shell { npm run lint }
  }
}
```

## When to Use Each Type

| Use Case | Fragment Type |
|----------|---------------|
| Multiple similar jobs with different configs | `job_fragment` |
| Shared setup/teardown sequences | `steps_fragment` |
| Complete job replacement | `job_fragment` |
| Injecting steps into existing jobs | `steps_fragment` |

## Source

```workpipe
// job_fragment with required and optional params
job_fragment service_build {
  params {
    service_name: string
    node_version: string = "20"
  }

  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    shell { cd services/${{ params.service_name }} && npm ci && npm run build }
  }
}

// steps_fragment with defaults
steps_fragment checkout_and_setup {
  params {
    node_version: string = "20"
  }
  uses("actions/checkout@v4") {}
  shell { npm ci }
}

workflow fragment_basics {
  on: push

  // Job fragment instantiation
  job api = service_build { service_name: "api" }
  job web = service_build { service_name: "web" node_version: "18" }

  // Steps fragment spread
  job lint {
    runs_on: ubuntu-latest
    steps {
      ...checkout_and_setup {}
      shell { npm run lint }
    }
  }
}
```

## Compiling

```bash
workpipe build fragment-basics.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
