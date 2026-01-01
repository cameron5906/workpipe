# Cross-File Fragments Example

Demonstrates organizing fragments into a shared library for reuse across multiple workflows.

## What This Demonstrates

- Separating fragment definitions from workflow files
- Importing both `job_fragment` and `steps_fragment` from a shared library
- Using imported fragments in workflows
- Building a composable CI/CD toolkit

## Key Concepts

### Shared Fragment Library

Keep fragment definitions in a dedicated directory for reuse:

```
cross-file-fragments/
  fragments/
    ci-common.workpipe   <- Fragment library
  workflows/
    ci.workpipe          <- Consumer workflow
```

### Importing Multiple Fragments

Import specific fragments using destructuring syntax:

```workpipe
import { node_setup, test_job } from "../fragments/ci-common.workpipe"
```

## File Structure

### fragments/ci-common.workpipe

The shared fragment library:

```workpipe
steps_fragment node_setup {
  uses("actions/checkout@v4") {}
  uses("actions/setup-node@v4") {}
  shell { npm ci }
}

job_fragment test_job {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/setup-node@v4") {}
    shell { npm ci }
    shell { npm test }
  }
}
```

### workflows/ci.workpipe

The consumer workflow:

```workpipe
import { node_setup, test_job } from "../fragments/ci-common.workpipe"

workflow ci {
  on: push

  job test = test_job {}

  job lint {
    runs_on: ubuntu-latest
    steps {
      ...node_setup {}
      shell { npm run lint }
    }
  }
}
```

## Benefits

| Benefit | Description |
|---------|-------------|
| Single Source of Truth | Update fragment once, all consumers get the change |
| Reduced Duplication | Common patterns defined once |
| Consistent Setup | All jobs use identical setup sequences |
| Easy Testing | Fragment library can be tested independently |

## Compiling

```bash
workpipe build workflows/ci.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
