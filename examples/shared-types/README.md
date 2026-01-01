# Shared Types Example

A multi-file project demonstrating WorkPipe's import system for sharing type definitions across workflows.

## What This Demonstrates

- Importing types from other WorkPipe files
- Aliased imports with `as` keyword
- Multi-file project organization
- Type reuse across multiple workflows
- Non-transitive import behavior

## Project Structure

```
shared-types/
  types/
    common.workpipe       # Shared type definitions
  workflows/
    ci.workpipe           # CI workflow - imports BuildInfo, TestResult
    deploy.workpipe       # Deploy workflow - imports BuildInfo, DeployConfig
  expected/
    ci.yml                # Generated CI workflow YAML
    deploy.yml            # Generated deploy workflow YAML
```

## Key Concepts

### 1. Defining Shared Types

Create a file containing only type definitions:

```workpipe
// types/common.workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

type DeployConfig {
  environment: string
  region: string
  replicas: int
}
```

### 2. Importing Types

Use the `import` statement to bring types into your workflow:

```workpipe
// workflows/ci.workpipe
import { BuildInfo, TestResult } from "../types/common.workpipe"

workflow ci {
  on: push

  job build {
    outputs: { info: BuildInfo }
    // ...
  }
}
```

### 3. Aliased Imports

Rename imported types to avoid name collisions or improve clarity:

```workpipe
// workflows/deploy.workpipe
import { DeployConfig as Config } from "../types/common.workpipe"

workflow deploy {
  job prepare {
    outputs: { config: Config }  // Uses the alias
    // ...
  }
}
```

### 4. Multiple Imports

Import multiple types from the same file in one statement:

```workpipe
import { BuildInfo, TestResult } from "../types/common.workpipe"
```

Or import from multiple files:

```workpipe
import { BuildInfo } from "../types/common.workpipe"
import { DeployConfig as Config } from "../types/common.workpipe"
```

## Compiling

Compile individual workflow files:

```bash
workpipe build workflows/ci.workpipe -o expected/
workpipe build workflows/deploy.workpipe -o expected/
```

The compiler automatically:
1. Detects imports and determines compilation order
2. Parses the imported files first
3. Makes imported types available in the workflow

## Import Rules

| Rule | Description |
|------|-------------|
| **Relative paths only** | Imports must start with `./` or `../` |
| **Extension required** | Include `.workpipe` extension in paths |
| **Non-transitive** | Types imported into a file cannot be re-exported |
| **Project-bound** | Import paths cannot escape the project root |

### Non-Transitive Imports

If file A imports `TypeX` from file B, and file C imports from file A, file C cannot access `TypeX` through file A. Import directly from file B instead:

```workpipe
// Wrong: TypeX is not re-exported from middle.workpipe
import { TypeX } from "./middle.workpipe"

// Correct: Import directly from the source
import { TypeX } from "./original.workpipe"
```

## Import-Related Error Codes

| Code | Description |
|------|-------------|
| [WP7001](../../docs/errors.md#wp7001) | Circular import detected |
| [WP7002](../../docs/errors.md#wp7002) | Import file not found |
| [WP7003](../../docs/errors.md#wp7003) | Type not exported (or not defined in source) |
| [WP7004](../../docs/errors.md#wp7004) | Duplicate import |
| [WP7005](../../docs/errors.md#wp7005) | Name collision with local type |
| [WP7006](../../docs/errors.md#wp7006) | Invalid import path (not relative) |
| [WP7007](../../docs/errors.md#wp7007) | Import path escapes project root |

## When to Use Imports

| Use imports when... | Use inline types when... |
|---------------------|-------------------------|
| Same type used in multiple workflows | Type used in only one file |
| Types represent a shared domain model | Quick prototyping |
| Team needs a single source of truth | Simple, one-off data shapes |
| Project has many workflow files | Minimal dependencies |

## Output

See the `expected/` directory for generated GitHub Actions YAML:

- [ci.yml](./expected/ci.yml) - Generated CI workflow
- [deploy.yml](./expected/deploy.yml) - Generated deploy workflow

## See Also

- [Language Reference: Imports](../../docs/language-reference.md#imports)
- [User-Defined Types Example](../user-defined-types/) - Type definitions without imports
- [Language Reference: User-Defined Types](../../docs/language-reference.md#user-defined-types)
