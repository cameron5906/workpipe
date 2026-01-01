# WorkPipe Quick Reference

A concise cheat sheet for WorkPipe syntax.

---

## File Structure

```workpipe
workflow <name> {
  on: <trigger>

  job <name> { ... }
}
```

- Extension: `.workpipe` or `.wp`
- One `workflow` block per file

---

## Imports

Import type definitions from other files:

```workpipe
import { TypeName } from "./path/to/file.workpipe"
import { TypeA, TypeB } from "./types.workpipe"
import { BuildInfo as BI } from "./common.workpipe"  // aliased
```

| Rule | Example |
|------|---------|
| Relative paths only | `"./types.workpipe"` or `"../shared.workpipe"` |
| Extension required | Must include `.workpipe` |
| Types only | Only type declarations can be imported |
| Non-transitive | Each file must import directly from source |

See [Language Reference](language-reference.md#imports) for details.

---

## Triggers

| Syntax | Description |
|--------|-------------|
| `on: push` | Single trigger |
| `on: [push, pull_request]` | Multiple triggers |
| `on: workflow_dispatch` | Manual trigger |
| `on: schedule` | Cron-based |

### Trigger Configuration

```workpipe
triggers {
  on push {
    branches: ["main", "develop"]
    paths: ["src/**"]
  }

  on pull_request {
    branches: ["main"]
  }

  on workflow_dispatch {
    input version: string required
    input environment: string = "staging"
    input dry_run: bool = false
  }
}
```

### Common Triggers

| Trigger | Use Case |
|---------|----------|
| `push` | On commits to branches |
| `pull_request` | On PR events |
| `workflow_dispatch` | Manual runs with inputs |
| `schedule` | Cron jobs |
| `release` | On release publish |
| `issues` | On issue events |

---

## Jobs

### Basic Job

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell { npm run build }
  }
}
```

### Job Properties

| Property | Required | Description |
|----------|----------|-------------|
| `runs_on` | Yes | Runner (e.g., `ubuntu-latest`) |
| `steps` | Yes | Array of steps |
| `needs` | No | Job dependencies |
| `if` / `when` | No | Conditional execution |

### Job Dependencies

```workpipe
job test {
  runs_on: ubuntu-latest
  needs: [build]
  steps { ... }
}

job deploy {
  runs_on: ubuntu-latest
  needs: [lint, test, build]
  steps { ... }
}
```

### Conditional Jobs

```workpipe
job deploy {
  runs_on: ubuntu-latest
  if: github.ref == "refs/heads/main"
  steps { ... }
}
```

---

## Steps

WorkPipe supports two step syntaxes: **block syntax** (recommended) and **array syntax**.

### Block Syntax (Recommended)

```workpipe
steps {
  uses("actions/checkout@v4") {}

  shell {
    npm ci
    npm run build
    npm test
  }
}
```

> **IMPORTANT**: In block syntax, `uses()` requires a trailing `{}` block, even when no configuration is needed.
>
> ```workpipe
> // WRONG - will cause a parse error
> uses("actions/checkout@v4")
>
> // CORRECT
> uses("actions/checkout@v4") {}
> ```

### Shell Blocks

Write shell commands without quotes:

```workpipe
shell { echo "Hello, WorkPipe!" }

shell {
  npm ci
  npm run build
}
```

### Array Syntax (Also Supported)

```workpipe
steps: [
  uses("actions/checkout@v4"),
  run("npm install"),
  run("npm test")
]
```

### Use Actions

```workpipe
uses("actions/checkout@v4")

uses("actions/setup-node@v4") {
  with: { node-version: "20" }
}
```

### Named Steps

```workpipe
step "install" run("npm ci")
step "build" run("npm run build")
```

### Step with Environment

```workpipe
step "deploy" run("./deploy.sh") {
  env: {
    ENVIRONMENT: "production",
    API_KEY: secrets.API_KEY
  }
}
```

### Conditional Steps

```workpipe
step "notify" run("./notify.sh") {
  if: success()
}
```

---

## Conditionals

### Comparison Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` `>` | Less/greater than |
| `<=` `>=` | Less/greater or equal |

### Logical Operators

| Operator | Description |
|----------|-------------|
| `&&` | AND |
| `\|\|` | OR |
| `!` | NOT |

### Status Functions

| Function | Description |
|----------|-------------|
| `success()` | Previous steps succeeded |
| `failure()` | Any previous step failed |
| `always()` | Always run |

### Common Expressions

```workpipe
if: github.ref == "refs/heads/main"
if: contains(github.event.head_commit.message, "[skip ci]")
if: startsWith(github.ref, "refs/tags/")
when: github.event_name == "pull_request"
```

---

## Matrix Builds

```workpipe
job test matrix {
  axes {
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
  }

  max_parallel = 4
  fail_fast = false

  runs_on: matrix.os
  steps {
    uses("actions/setup-node@v4") {
      with: { node-version: matrix.node }
    }
    shell { npm test }
  }
}
```

| Property | Description |
|----------|-------------|
| `axes` | Matrix dimensions |
| `max_parallel` | Concurrent job limit |
| `fail_fast` | Stop on first failure |

---

## Artifacts

Artifacts are currently supported via agent task `output_artifact`:

```workpipe
agent_job review {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Review the code") {
      model: "claude-sonnet-4-20250514"
      output_schema: { rating: int, summary: string }
      output_artifact: "review_result"
    }
  }
}
```

The artifact is uploaded to `wp.<workflow>.<job>.<artifact>.${{ github.run_attempt }}`.

For job-to-job data passing, use typed outputs with `json`:

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: { metadata: json }
  steps {
    shell { echo "metadata={\"version\":\"1.0.0\"}" >> $GITHUB_OUTPUT }
  }
}
```

See [Language Reference](language-reference.md#the-json-type) for details.

---

## Cycles (Iterative Loops)

```workpipe
cycle refine {
  max_iters = 10
  key = "refinement-${github.run_id}"

  until guard_js """
    return state.quality_score > 0.95;
  """

  body {
    job analyze { ... }
    job improve {
      needs: [analyze]
      ...
    }
  }
}
```

| Property | Description |
|----------|-------------|
| `max_iters` | Maximum iterations |
| `until` | Termination condition |
| `key` | Concurrency group ID |
| `body` | Jobs to run each iteration |

---

## Agent Jobs

```workpipe
agent_job review {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Review the codebase") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: {
        allowed: ["Read", "Glob", "Grep"]
      }
      output_artifact: "review_result"
    }
  }
}
```

---

## Strings

| Type | Syntax | Use Case |
|------|--------|----------|
| Double-quoted | `"hello"` | Simple strings |
| Triple-quoted | `"""..."""` | Multi-line scripts |
| Template | `template("{{var}}")` | Variable interpolation |

---

## Types

### Primitive Types

| Type | Description |
|------|-------------|
| `string` | Text |
| `int` | Integer |
| `float` | Decimal |
| `bool` | true/false |
| `json` | Untyped JSON |
| `path` | File path |
| `secret<string>` | Secret value |
| `string?` | Optional string |
| `enum<"a", "b">` | Constrained values |

### User-Defined Types

Define reusable types at file level, before the `workflow` block:

```workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps {
      uses("actions/checkout@v4") {}
      shell {
        VERSION=$(cat package.json | jq -r .version)
        echo "info={\"version\":\"$VERSION\",\"commit\":\"${{ github.sha }}\",\"timestamp\":$(date +%s)}" >> $GITHUB_OUTPUT
      }
    }
  }
}
```

Use in agent task schemas (as quoted string):

```workpipe
agent_task("Review code") {
  output_schema: "ReviewResult"
}
```

See [Language Reference](language-reference.md#user-defined-types) for details.

---

## Escape Hatch

For unsupported GitHub Actions features:

```workpipe
job deploy {
  runs_on: ubuntu-latest

  raw_yaml {
    timeout-minutes: 30
    concurrency:
      group: production
      cancel-in-progress: false
  }

  steps {
    shell { ./deploy.sh }
  }
}
```

---

## Context Variables

| Variable | Description |
|----------|-------------|
| `github.ref` | Branch/tag ref |
| `github.event_name` | Trigger type |
| `github.event.*` | Event payload |
| `github.run_id` | Workflow run ID |
| `secrets.*` | Repository secrets |
| `needs.<job>.outputs.*` | Job outputs |
| `steps.<step>.outputs.*` | Step outputs |
| `matrix.*` | Matrix values |

---

## Comments

```workpipe
// Line comment

/*
  Block
  comment
*/
```
