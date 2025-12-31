# Language Reference

This document provides a complete reference for the WorkPipe language syntax and semantics.

## File Structure

- **Extension:** `.workpipe` (primary) or `.wp` (alias)
- **Encoding:** UTF-8
- **Top-level:** Each file must contain exactly one `workflow` block

```workpipe
workflow my_workflow {
  // workflow contents
}
```

---

## Workflow Block

The `workflow` block is the root construct of every WorkPipe file.

```workpipe
workflow <name> {
  on: <trigger>

  // jobs go here
}
```

**Properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `on` | Yes | Trigger configuration |

**Example:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps: [
      run("npm run build")
    ]
  }
}
```

---

## Triggers (on:)

Triggers define when a workflow runs. WorkPipe supports all GitHub Actions trigger types.

### Single Trigger

```workpipe
on: push
```

### Multiple Triggers

```workpipe
on: [push, pull_request]
```

### Trigger with Configuration

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
  }
}
```

### Common Triggers

| Trigger | Description |
|---------|-------------|
| `push` | Repository push events |
| `pull_request` | Pull request events |
| `workflow_dispatch` | Manual trigger with optional inputs |
| `schedule` | Cron-based scheduling |
| `issues` | Issue events (opened, closed, etc.) |
| `release` | Release events |

### Workflow Dispatch Inputs

Define inputs for manually triggered workflows:

```workpipe
triggers {
  on workflow_dispatch {
    input version: string required
    input environment: string = "production"
    input dry_run: bool = false
  }
}
```

---

## Jobs

Jobs define units of work that run on a runner. Jobs can run in parallel or depend on other jobs.

### Basic Job

```workpipe
job <name> {
  runs_on: <runner>
  steps: [
    // steps
  ]
}
```

**Properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `runs_on` | Yes | The runner to execute on (e.g., `ubuntu-latest`) |
| `steps` | Yes | Array of steps to execute |
| `needs` | No | Array of job dependencies |
| `if` | No | Conditional execution expression |

### Job Dependencies

Use `needs` to create job dependencies:

```workpipe
job test {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("npm test")
  ]
}
```

### Conditional Jobs

Use `when` or `if` for conditional execution:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  when: github.ref == "refs/heads/main"
  steps: [
    run("./deploy.sh")
  ]
}
```

### Agent Jobs

Agent jobs use the Claude Code GitHub Action for AI-powered tasks:

```workpipe
agent_job triage {
  runs_on: ubuntu-latest

  agent_task "reviewer" {
    model = "sonnet"
    max_turns = 10

    tools {
      allowed = ["Read", "Glob", "Grep"]
    }

    prompt = "Review the code changes in this PR"
    output_schema = file("schemas/review.json")
  }
}
```

---

## Steps

Steps are individual commands or actions within a job.

### Run Step

Execute a shell command:

```workpipe
run("echo Hello, World!")
```

With a name:

```workpipe
step "greet" run("echo Hello, World!")
```

### Multi-line Commands

Use triple-quoted strings for multi-line commands:

```workpipe
run("""
  npm ci
  npm run build
  npm test
""")
```

### Uses Step

Use a GitHub Action:

```workpipe
uses("actions/checkout@v4")
```

With configuration:

```workpipe
uses("actions/setup-node@v4") {
  with: {
    node-version: "20"
  }
}
```

### Step with Environment Variables

```workpipe
step "deploy" run("./deploy.sh") {
  env: {
    ENVIRONMENT: "production",
    API_KEY: secrets.API_KEY
  }
}
```

### Step with Condition

```workpipe
step "notify" run("./notify.sh") {
  if: success()
}
```

---

## Cycles

Cycles enable iterative workflows that span multiple GitHub Actions runs. They are useful for refinement loops, retry patterns, and convergence-based processing.

### Basic Cycle

```workpipe
cycle refine {
  max_iters = 10
  key = "refinement-${github.run_id}"

  until guard_js """
    return state.quality_score > 0.95;
  """

  body {
    job analyze {
      runs_on: ubuntu-latest
      steps: [
        run("./analyze.sh")
      ]
    }

    job improve {
      runs_on: ubuntu-latest
      needs: [analyze]
      steps: [
        run("./improve.sh")
      ]
    }
  }
}
```

**Cycle Properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `max_iters` | Yes* | Maximum number of iterations (safety limit) |
| `until` | Yes* | Termination predicate using `guard_js` |
| `key` | No | Concurrency group identifier |
| `body` | Yes | Block containing jobs to execute each iteration |

*At least one of `max_iters` or `until` is required.

### Guard JS Blocks

Guard JS blocks contain JavaScript that evaluates to a boolean:

```workpipe
until guard_js """
  return state.iteration >= 5 || state.score > 0.9;
"""
```

The guard receives a `state` object containing:
- `iteration`: Current iteration number
- Captured outputs from previous jobs

---

## Strings

WorkPipe supports three string forms:

### Double-Quoted Strings

Standard strings with escape sequences:

```workpipe
"Hello, World!"
"Path: /home/user"
"Line 1\nLine 2"
```

### Triple-Quoted Strings

Multi-line strings that preserve whitespace:

```workpipe
"""
This is a
multi-line string
"""
```

Triple-quoted strings:
- Preserve all whitespace and newlines
- Do not process escape sequences
- Are ideal for scripts and prompts

### Template Strings

Strings with variable interpolation:

```workpipe
template("Deploy to {{environment}}")
template("""
  Building version {{version}}
  Target: {{environment}}
""")
```

Template syntax uses `{{expression}}` for interpolation.

---

## Expressions

Expressions are used in conditions, templates, and property values.

### Property Access

```workpipe
github.ref
github.event.pull_request.number
needs.build.outputs.version
steps.test.outputs.result
```

### Comparison Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |

### Logical Operators

| Operator | Description |
|----------|-------------|
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `!` | Logical NOT |

### Function Calls

```workpipe
contains(github.event.head_commit.message, "[skip ci]")
startsWith(github.ref, "refs/tags/")
success()
failure()
always()
```

### Literals

```workpipe
"string value"
42
3.14
true
false
```

### Arrays

```workpipe
["main", "develop"]
[1, 2, 3]
```

---

## Comments

### Line Comments

```workpipe
// This is a line comment
workflow ci {
  on: push  // inline comment
}
```

### Block Comments

```workpipe
/*
  This is a block comment
  spanning multiple lines
*/
workflow ci {
  on: push
}
```

---

## Reserved Keywords

The following keywords are reserved and cannot be used as identifiers:

```
after        agent_job    agent_task   axes         body
consumes     cycle        emit         emits        env
false        guard_js     if           inputs       job
key          matrix       max_iters    mcp          model
needs        on           output_artifact           output_schema
outputs      prompt       raw_yaml     run          runs_on
step         steps        system_prompt tools       triggers
true         until        uses         when         workflow
```

---

## Types

WorkPipe provides a type system for inputs, outputs, and artifacts.

### Primitive Types

| Type | Description |
|------|-------------|
| `string` | Text value |
| `int` | Integer number |
| `float` | Floating-point number |
| `bool` | Boolean (true/false) |
| `json` | Untyped JSON blob |
| `path` | File system path |
| `secret<string>` | Secret value (from `secrets.*`) |

### Optional Types

Append `?` to make a type optional:

```workpipe
input version: string?
```

### Enum Types

Define constrained string values:

```workpipe
input environment: enum<"dev", "staging", "prod">
```

---

## Artifacts

Artifacts pass structured data between jobs.

### Emitting Artifacts

```workpipe
job build {
  emits build_output: json

  steps: [
    run("npm run build"),
    emit build_output from_file "build-info.json"
  ]
}
```

### Consuming Artifacts

```workpipe
job deploy {
  consumes build_output from build.build_output

  steps: [
    run("./deploy.sh")
  ]
}
```

---

## Matrices

Matrices run a job multiple times with different configurations.

```workpipe
job test matrix {
  axes {
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest]
  }

  max_parallel = 4
  fail_fast = false

  runs_on: matrix.os
  steps: [
    uses("actions/setup-node@v4") {
      with: {
        node-version: matrix.node
      }
    },
    run("npm test")
  ]
}
```

**Matrix Properties:**

| Property | Description |
|----------|-------------|
| `axes` | Defines matrix dimensions and values |
| `max_parallel` | Maximum parallel jobs |
| `fail_fast` | Stop all jobs if one fails |

---

## Escape Hatches

For features not yet supported in WorkPipe syntax, use `raw_yaml` blocks:

```workpipe
job deploy {
  runs_on: ubuntu-latest

  raw_yaml {
    timeout-minutes: 30
    concurrency:
      group: production
      cancel-in-progress: false
  }

  steps: [
    run("./deploy.sh")
  ]
}
```

---

## See Also

- [Getting Started](getting-started.md) - Installation and first workflow
- [CLI Reference](cli-reference.md) - Command-line interface documentation
