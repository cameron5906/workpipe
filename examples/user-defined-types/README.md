# User-Defined Types Example

A workflow demonstrating user-defined types for structured data and type-safe property access.

## What This Demonstrates

- Defining named types with the `type` keyword
- Using types in job outputs for structured data
- Using types as agent task output schemas
- Type references between types (composing types)
- Property access validation at compile time

## Key Concepts

### 1. Type Definitions

Define reusable types at file level before the workflow:

```workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
  success: bool
}
```

### 2. Types in Job Outputs

Reference types in job output declarations:

```workpipe
job build {
  outputs: {
    info: BuildInfo  // Structured output typed as BuildInfo
  }
}
```

### 3. Types in Agent Task Schemas

Reference types by name (as a quoted string) for agent task schemas:

```workpipe
agent_task("Review code") {
  output_schema: "ReviewResult"  // Compiler generates JSON Schema from type
}
```

### 4. Type Composition

Types can reference other types:

```workpipe
type DeployResult {
  environment: string
  build: BuildInfo  // Nested type reference
}
```

### 5. Property Validation

The compiler validates property access at compile time:

```workpipe
// OK - 'version' exists on BuildInfo
run("echo ${{ fromJSON(needs.build.outputs.info).version }}")

// ERROR WP5003 - 'typo' does not exist on BuildInfo
run("echo ${{ fromJSON(needs.build.outputs.info).typo }}")
```

## Source

```workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
  success: bool
}

type ReviewResult {
  approved: bool
  rating: int
  comments: [{
    file: string
    line: int
    severity: "error" | "warning" | "info"
    message: string
  }]
  summary: string | null
}

workflow typed_pipeline {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: { info: BuildInfo }
    steps: [
      uses("actions/checkout@v4"),
      run("echo \"info={...}\" >> $GITHUB_OUTPUT")
    ]
  }

  agent_job review {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      uses("actions/checkout@v4"),
      agent_task("Review the code") {
        output_schema: "ReviewResult"
      }
    ]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build, review]
    steps: [
      run("echo ${{ fromJSON(needs.build.outputs.info).version }}")
    ]
  }
}
```

## Compiling

```bash
workpipe build user-defined-types.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.

## Type System Benefits

| Benefit | Description |
|---------|-------------|
| **Reusability** | Define once, use across multiple jobs and tasks |
| **Documentation** | Types serve as inline documentation for data shapes |
| **Validation** | Catch property typos at compile time, not runtime |
| **JSON Schema** | Agent task schemas generated automatically from types |

## Type-Related Error Codes

| Code | Description |
|------|-------------|
| [WP5001](../../docs/errors.md#wp5001) | Duplicate type name |
| [WP5002](../../docs/errors.md#wp5002) | Unknown type reference |
| [WP5003](../../docs/errors.md#wp5003) | Property does not exist on type |

## Important Notes

### Runtime Behavior

Types are compile-time only. At runtime:
- Job outputs are JSON strings passed via `$GITHUB_OUTPUT`
- Use `fromJSON()` in expressions to parse and access properties
- Agent task outputs are validated against the generated JSON Schema

### Escaping JSON in Shell

Building JSON inline requires careful escaping:

```workpipe
run("echo \"info={\\\"version\\\":\\\"1.0\\\"}\" >> $GITHUB_OUTPUT")
```

For complex JSON, consider using a script file or `jq`.

## See Also

- [Language Reference: User-Defined Types](../../docs/language-reference.md#user-defined-types)
- [JSON Outputs Example](../json-outputs/) - Using `json` type without named types
- [Agent Task Example](../agent-task/) - Agent tasks with inline schemas
