# Fragment Composition Example

Demonstrates using multiple step fragments together in workflows.

## What This Demonstrates

- Creating atomic, single-purpose step fragments
- Using multiple fragments in a single job
- Choosing between composed and primitive fragments
- Flexible mixing of fragments for different needs

## Key Concepts

### Fragment Hierarchy

Define fragments at different levels of abstraction:

```workpipe
// Level 1: Atomic primitives
steps_fragment checkout {
  uses("actions/checkout@v4") {}
}

steps_fragment setup_node {
  uses("actions/setup-node@v4") {}
}

// Level 2: Full setup sequence
steps_fragment node_project_setup {
  uses("actions/checkout@v4") {}
  uses("actions/setup-node@v4") {}
  shell { npm ci }
}
```

### Flexible Usage

Use composed fragments for common patterns, or combine primitives for custom needs:

```workpipe
// Use full composed setup
job build {
  steps {
    ...node_project_setup {}
    shell { npm run build }
  }
}

// Mix primitives for custom setup
job lint {
  steps {
    ...checkout {}
    ...setup_node {}
    shell { npm ci && npm run lint }
  }
}
```

## Benefits of Composition

| Benefit | Description |
|---------|-------------|
| Single Responsibility | Each primitive does one thing well |
| Reusability | Primitives can be combined in multiple ways |
| Maintainability | Update a primitive, all uses benefit |
| Flexibility | Mix and match at any level of abstraction |

## When to Use Each Approach

### Use Composed Fragments

- Common setup sequences used by many jobs
- When you want consistent patterns across jobs
- For complex multi-step sequences

### Combine Primitives

- When you need fine-grained control
- For one-off variations
- When jobs have different requirements

## Full Source

```workpipe
// Level 1: Atomic primitives
steps_fragment checkout {
  uses("actions/checkout@v4") {}
}

steps_fragment setup_node {
  uses("actions/setup-node@v4") {}
}

// Level 2: Composed setup
steps_fragment node_project_setup {
  uses("actions/checkout@v4") {}
  uses("actions/setup-node@v4") {}
  shell { npm ci }
}

workflow composed {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      ...node_project_setup {}
      shell { npm run build }
    }
  }

  job test {
    runs_on: ubuntu-latest
    steps {
      ...node_project_setup {}
      shell { npm test }
    }
  }

  job lint {
    runs_on: ubuntu-latest
    steps {
      ...checkout {}
      ...setup_node {}
      shell { npm ci && npm run lint }
    }
  }
}
```

## Compiling

```bash
workpipe build fragment-composition.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
