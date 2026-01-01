# Language Reference

This document provides a complete reference for the WorkPipe language syntax and semantics.

## File Structure

- **Extension:** `.workpipe` (primary) or `.wp` (alias)
- **Encoding:** UTF-8
- **Top-level:** A file may contain imports, type declarations, and exactly one `workflow` block

```workpipe
import { SharedType } from "./types.workpipe"

type LocalType {
  field: string
}

workflow my_workflow {
  // workflow contents
}
```

**File Order:**
1. Import declarations (optional)
2. Type declarations (optional)
3. Workflow block (required, unless file contains only types for importing)

---

## Imports

WorkPipe supports importing type definitions from other files. This enables type reuse across multiple workflows and promotes a clean separation between type definitions and workflow logic.

### Import Syntax

Import specific types from another file:

```workpipe
import { TypeName } from "./path/to/file.workpipe"
```

Import multiple types:

```workpipe
import { TypeA, TypeB, TypeC } from "./types.workpipe"
```

### Aliased Imports

Rename imported types to avoid name collisions or improve clarity:

```workpipe
import { BuildInfo as BI } from "./types.workpipe"
import { DeployConfig as Config } from "./shared.workpipe"
```

The alias becomes the local name for the type:

```workpipe
job build {
  outputs: { info: BI }  // Uses the alias
}
```

### Path Resolution Rules

| Rule | Example | Description |
|------|---------|-------------|
| Relative paths | `"./types.workpipe"` | Paths are relative to the importing file |
| Parent directory | `"../shared/common.workpipe"` | Use `../` to navigate up |
| Extension required | `"./types.workpipe"` | The `.workpipe` extension must be included |
| No absolute paths | Not allowed | Paths must start with `./` or `../` |
| Project-bound | Error if escapes root | Cannot import from outside the project directory |

### What Can Be Imported

Only **type declarations** can be imported. Workflows, jobs, and other constructs cannot be imported.

```workpipe
// types.workpipe - Types-only file (no workflow block)
type BuildInfo {
  version: string
  commit: string
}

type TestResult {
  passed: bool
  coverage: float
}
```

Files containing only type declarations do not produce YAML output when compiled.

### Non-Transitive Imports

Imports are **not transitive**. If file A imports `TypeX` from file B, and file C imports from file A, file C cannot access `TypeX` through file A.

```workpipe
// base.workpipe
type BaseType { id: string }

// middle.workpipe
import { BaseType } from "./base.workpipe"
type MiddleType { name: string }

// main.workpipe
import { BaseType } from "./middle.workpipe"  // ERROR: BaseType not exportable
import { MiddleType } from "./middle.workpipe"  // OK: MiddleType is defined in middle
import { BaseType } from "./base.workpipe"      // OK: Import directly from source
```

This design prevents "import pollution" where changing one file's imports could break unrelated downstream files.

### Using Imported Types

Imported types work exactly like locally-defined types:

**In job outputs:**

```workpipe
import { BuildInfo } from "./types.workpipe"

workflow ci {
  job build {
    outputs: { info: BuildInfo }
    steps: [...]
  }
}
```

**In agent task schemas:**

```workpipe
import { ReviewResult } from "./types.workpipe"

workflow review {
  agent_job reviewer {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Review the code") {
        output_schema: "ReviewResult"
      }
    ]
  }
}
```

### Import Errors

| Code | Description |
|------|-------------|
| [WP7001](errors.md#wp7001) | Circular import detected |
| [WP7002](errors.md#wp7002) | Import file not found |
| [WP7003](errors.md#wp7003) | Type not exported (doesn't exist or is itself imported) |
| [WP7004](errors.md#wp7004) | Duplicate import of same type |
| [WP7005](errors.md#wp7005) | Name collision with existing type |
| [WP7006](errors.md#wp7006) | Invalid import path (not relative) |
| [WP7007](errors.md#wp7007) | Import path escapes project root |

### Best Practices

**When to use imports:**

| Use imports when... | Use inline types when... |
|---------------------|-------------------------|
| Same type used in multiple workflows | Type used in only one file |
| Types represent a shared domain model | Quick prototyping |
| Team needs a single source of truth | Simple, one-off data shapes |

**Recommended project structure:**

```
workpipe/
  types/
    common.workpipe       # Shared type definitions
    domain.workpipe       # Domain-specific types
  workflows/
    ci.workpipe           # Imports from types/
    deploy.workpipe       # Imports from types/
```

For a complete example, see [examples/shared-types/](../examples/shared-types/).

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
| `runs_on` | Yes | The runner to execute on (e.g., `ubuntu-latest`). See [WP7001](errors.md#wp7001) if omitted. |
| `steps` | Yes | Array of steps to execute |
| `needs` | No | Array of job dependencies |
| `if` | No | Conditional execution expression |
| `outputs` | No | Typed outputs that other jobs can reference |

### Job Outputs

Jobs can declare typed outputs that other jobs can reference:

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
    build_number: int
    success: bool
  }
  steps: [...]
}

job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo Version: ${{ needs.build.outputs.version }}")
  ]
}
```

### Setting Output Values

To set output values from within a step, write to `$GITHUB_OUTPUT`:

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
    build_number: int
  }
  steps: [
    run("echo \"version=1.0.0\" >> $GITHUB_OUTPUT"),
    run("echo \"build_number=42\" >> $GITHUB_OUTPUT")
  ]
}
```

Each output is set by writing a line in the format `name=value` to `$GITHUB_OUTPUT`. The output names must match those declared in the `outputs` block.

**Supported Types:**

| Type | Description |
|------|-------------|
| `string` | Text value |
| `int` | Integer number |
| `float` | Decimal number |
| `bool` | Boolean (true/false) |
| `json` | JSON object or array |
| `path` | File path |

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

Agent jobs use the Claude Code GitHub Action for AI-powered tasks. The `runs_on` field is required; see [WP7002](errors.md#wp7002) if omitted.

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

### Inline Output Schemas

Instead of referencing external JSON Schema files, you can define schemas inline:

```workpipe
agent_task("Analyze code") {
  output_schema: {
    rating: int
    summary: string
    issues: [{
      file: string
      line: int
      severity: "error" | "warning" | null
    }]
  }
}
```

**Supported Types:**

| Type | Example | JSON Schema Equivalent |
|------|---------|----------------------|
| `string` | `name: string` | `{"type": "string"}` |
| `int` | `count: int` | `{"type": "integer"}` |
| `float` | `score: float` | `{"type": "number"}` |
| `bool` | `active: bool` | `{"type": "boolean"}` |
| `[T]` | `tags: [string]` | `{"type": "array", "items": ...}` |
| `{...}` | `meta: { key: string }` | Nested object |
| `T \| null` | `value: string \| null` | `{"oneOf": [...]}` |
| `"a" \| "b"` | `status: "pass" \| "fail"` | `{"enum": [...]}` |

**Notes:**
- All properties are required (per Claude's structured output spec)
- `additionalProperties` is always `false`
- You can still use `output_schema: "path/to/schema.json"` for complex schemas

For a complete example, see [examples/agent-task/](../examples/agent-task/).

---

## Steps

Steps are individual commands or actions within a job. WorkPipe provides two syntax forms for defining steps: **block syntax** (recommended) and **array syntax** (also supported).

### Block Syntax (Recommended)

The block syntax uses `steps { }` with `shell { }` blocks for shell commands. This is the recommended approach for new workflows:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}

    shell {
      npm ci
      npm run build
      npm test
    }
  }
}
```

Note: In block syntax, `uses()` requires a trailing block. Use `{}` for actions with no configuration.

**Benefits of block syntax:**
- No string quoting needed for shell commands
- Multi-line scripts are natural and readable
- Nested braces in shell code work transparently
- Cleaner visual separation between steps

### Array Syntax (Also Supported)

The original array syntax with `run()` steps remains fully supported for backward compatibility:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    uses("actions/checkout@v4"),
    run("npm ci"),
    run("npm run build"),
    run("npm test")
  ]
}
```

Both syntaxes produce identical YAML output. You can use whichever style you prefer, and you can mix styles across different jobs in the same project.

---

### Shell Blocks

The `shell { }` block allows you to write shell commands directly without string quoting:

```workpipe
shell {
  echo "Building project..."
  npm ci
  npm run build
}
```

**Single-line form:**

```workpipe
shell { echo "Hello, WorkPipe!" }
```

**Nested braces:** Braces inside shell code are handled transparently. The compiler counts brace depth to determine block boundaries:

```workpipe
shell {
  if [ -f package.json ]; then
    npm ci
  fi

  for file in *.js; do
    echo "Found: $file"
  done
}
```

**Indentation handling:** Leading whitespace common to all lines is automatically stripped when generating YAML. This means your shell blocks can be indented to match the surrounding WorkPipe code, and the output will be clean:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell {
      npm ci
      npm run build
    }
  }
}
```

Generates:

```yaml
steps:
  - run: |-
      npm ci
      npm run build
```

---

### Run Step (Array Syntax)

When using array syntax, execute shell commands with `run()`:

```workpipe
run("echo Hello, World!")
```

With a name:

```workpipe
step "greet" run("echo Hello, World!")
```

For multi-line commands in array syntax, use multiple `run()` steps or chain with `&&`:

```workpipe
steps: [
  run("npm ci"),
  run("npm run build"),
  run("npm test")
]
```

Or:

```workpipe
run("npm ci && npm run build && npm test")
```

---

### Uses Step

Invoke a GitHub Action with `uses()`.

**In array syntax:**

```workpipe
steps: [
  uses("actions/checkout@v4"),
  uses("actions/setup-node@v4") {
    with: { node-version: "20" }
  },
  run("npm test")
]
```

**In block syntax:**

When using block syntax, `uses()` requires a trailing block (use `{}` for actions with no configuration):

```workpipe
steps {
  uses("actions/checkout@v4") {}

  uses("actions/setup-node@v4") {
    with: { node-version: "20" }
  }

  shell { npm test }
}
```

---

### Step with Environment Variables

```workpipe
step "deploy" run("./deploy.sh") {
  env: {
    ENVIRONMENT: "production",
    API_KEY: secrets.API_KEY
  }
}
```

---

### Step with Condition

```workpipe
step "notify" run("./notify.sh") {
  if: success()
}
```

---

### Choosing Between Block and Array Syntax

| Use Block Syntax When... | Use Array Syntax When... |
|--------------------------|--------------------------|
| Writing multi-line shell scripts | You have simple one-liner commands |
| You want cleaner, more readable code | Migrating existing workflows gradually |
| Starting a new project | You prefer explicit string delimiters |
| Shell code contains quotes or escapes | Matching team style conventions |

**Recommendation:** For new workflows, prefer block syntax with `shell { }` blocks. It reduces noise and makes shell scripts more readable. The array syntax remains available and is not deprecated.

---

### Migrating from Array to Block Syntax

Both syntaxes are fully supported and produce identical output. You can migrate files incrementally or mix styles across different jobs.

**Before (array syntax):**

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    uses("actions/checkout@v4"),
    run("npm ci"),
    run("npm run build"),
    run("npm test")
  ]
}
```

**After (block syntax):**

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    shell {
      npm ci
      npm run build
      npm test
    }
  }
}
```

**Key differences:**

| Array Syntax | Block Syntax |
|--------------|--------------|
| `steps: [ ]` | `steps { }` |
| `run("...")` | `shell { ... }` |
| `uses("...")` | `uses("...") {}` (requires trailing block) |
| Commands need quotes | Commands are written directly |
| Commands separated by commas | No commas needed |

**Migration tips:**

1. **No forced migration**: Existing files continue to work unchanged
2. **Mix and match**: Different jobs can use different styles in the same project
3. **Gradual adoption**: Convert one file or one job at a time
4. **uses() requires block**: In block syntax, `uses()` needs a trailing `{}` even with no configuration

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
| `max_iters` | Yes* | Maximum number of iterations (safety limit). See [WP6005](errors.md#wp6005) for why this is recommended even with `until`. |
| `until` | Yes* | Termination predicate using `guard_js` |
| `key` | No | Concurrency group identifier |
| `body` | Yes | Block containing jobs to execute each iteration |

*At least one of `max_iters` or `until` is required. See [WP6001](errors.md#wp6001) if neither is provided.

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

For examples, see [examples/cycle-basic/](../examples/cycle-basic/) and [examples/iterative-refinement/](../examples/iterative-refinement/).

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

Multi-line strings that preserve whitespace. Currently only supported in `guard_js` blocks:

```workpipe
until guard_js """
  return state.score > 0.95 || state.iteration >= 5;
"""
```

Triple-quoted strings:
- Preserve all whitespace and newlines
- Do not process escape sequences
- Are ideal for JavaScript guards and prompts

**Note:** Triple-quoted strings are not currently supported in `run()` steps. For multi-line shell commands, use multiple `run()` steps or chain commands with `&&`.

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
after        agent_job    agent_task   as           axes
body         consumes     cycle        emit         emits
env          false        from         guard_js     if
import       inputs       job          key          matrix
max_iters    mcp          model        needs        on
output_artifact           output_schema             outputs
prompt       raw_yaml     run          runs_on      step
steps        system_prompt tools       triggers     true
type         until        uses         when         workflow
```

---

## Types

WorkPipe provides a type system for inputs, outputs, and artifacts.

### Type System Design Philosophy

WorkPipe's type system is designed with these core principles:

1. **Compile-time only**: All type checking happens during compilation. WorkPipe validates type annotations, checks output references, and catches type mismatches before your workflow runs. There is no runtime type enforcement.

2. **GitHub Actions constraint**: At runtime, GitHub Actions passes all job outputs as strings via `$GITHUB_OUTPUT`. This means:
   - Integers become `"42"` not `42`
   - Booleans become `"true"` or `"false"`
   - Complex data must be JSON-serialized as strings

3. **Documentation + validation**: Type annotations serve two purposes:
   - **Compile-time validation**: The compiler warns about undeclared output references and type mismatches
   - **Developer documentation**: Types communicate intent to other developers and enable IDE features

4. **Backward compatibility**: Types are always optional. Existing workflows without type annotations continue to work unchanged.

For the complete design rationale, see [ADR-0010: Type System for Data Flow](../adr/0010-type-system-for-data-flow.md).

### User-Defined Types

WorkPipe supports user-defined types that let you define complex data shapes once and reuse them across your workflow. Types are defined at file level before the `workflow` block.

#### Defining Types

Use the `type` keyword to define a named type:

```workpipe
type BuildInfo {
  version: string
  commit: string
  timestamp: int
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

workflow ci {
  on: push
  // ... jobs can now use BuildInfo and ReviewResult
}
```

#### Type Syntax

Types support all schema type features:

| Feature | Example | Description |
|---------|---------|-------------|
| Primitives | `field: string` | Basic types: `string`, `int`, `float`, `bool` |
| Objects | `field: { nested: string }` | Nested structures |
| Arrays | `items: [string]` | List of items |
| Object arrays | `items: [{ name: string }]` | List of objects |
| Unions | `value: string \| null` | Optional/alternative values |
| String literals | `status: "pass" \| "fail"` | Constrained string values |
| Type references | `config: OtherType` | Reference another defined type |

#### Using Types in Job Outputs

Reference a type by name in job outputs:

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
      info: BuildInfo  // Uses the type defined above
    }
    steps: [
      run("echo \"info={\\\"version\\\":\\\"1.0.0\\\",\\\"commit\\\":\\\"abc\\\",\\\"timestamp\\\":12345}\" >> $GITHUB_OUTPUT")
    ]
  }
}
```

**Note**: Like the `json` type, user-defined types are serialized as JSON strings at runtime. Use `fromJSON()` in expressions to access properties.

#### Using Types in Agent Task Schemas

Reference a type by name (as a quoted string) for agent task output schemas:

```workpipe
type ReviewResult {
  approved: bool
  summary: string
  issues: [{ filepath: string lineNum: int message: string }]
}

workflow review {
  on: pull_request

  agent_job code_review {
    runs_on: ubuntu-latest
    steps: [
      uses("actions/checkout@v4"),
      agent_task("Review the code changes") {
        output_schema: "ReviewResult"  // Compiler generates JSON Schema from type
      }
    ]
  }
}
```

The compiler resolves the type name and converts the type definition to JSON Schema automatically.

**Note**: Type references in `output_schema` use quoted strings (e.g., `"ReviewResult"`) to distinguish them from file paths.

#### Property Access Validation

The compiler validates property access on typed outputs at compile time:

```workpipe
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: { info: BuildInfo }
    steps: [run("...")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      // OK: version exists on BuildInfo
      run("echo ${{ fromJSON(needs.build.outputs.info).version }}"),

      // ERROR WP5003: 'timestamp' does not exist on BuildInfo
      run("echo ${{ fromJSON(needs.build.outputs.info).timestamp }}")
    ]
  }
}
```

See [WP5003](errors.md#wp5003) for details on property validation errors.

#### Type-Related Diagnostics

| Code | Severity | Description |
|------|----------|-------------|
| [WP5001](errors.md#wp5001) | Error | Duplicate type name |
| [WP5002](errors.md#wp5002) | Error | Unknown type reference |
| [WP5003](errors.md#wp5003) | Error | Property does not exist on type |

#### When to Use User-Defined Types

| Use types when... | Use primitives/json when... |
|-------------------|---------------------------|
| Same structure used in multiple places | Structure used only once |
| You want property access validation | Simple scalar values |
| Agent tasks need structured output | Quick prototyping |
| Type serves as documentation | Runtime validation not needed |

#### Limitations

- Types are **compile-time only**: No runtime type checking occurs
- **No generics**: Each type is a concrete definition
- **Structural typing**: Types with the same shape are compatible

#### Sharing Types Across Files

Types can be shared between files using the import system:

```workpipe
// types/common.workpipe
type BuildInfo {
  version: string
  commit: string
}

// workflows/ci.workpipe
import { BuildInfo } from "../types/common.workpipe"

workflow ci {
  job build {
    outputs: { info: BuildInfo }
  }
}
```

See [Imports](#imports) for complete documentation on the import system.

For complete examples, see [examples/user-defined-types/](../examples/user-defined-types/) and [examples/shared-types/](../examples/shared-types/).

### Primitive Types

| Type | Description | Use Case |
|------|-------------|----------|
| `string` | Text value | Names, versions, messages, identifiers |
| `int` | Integer number | Counts, build numbers, exit codes |
| `float` | Floating-point number | Scores, percentages, measurements |
| `bool` | Boolean (true/false) | Flags, success indicators, feature toggles |
| `json` | Untyped JSON blob | Complex structured data, nested objects, arrays |
| `path` | File system path | Artifact file locations, directory references |
| `secret<string>` | Secret value (from `secrets.*`) | API keys, tokens, credentials |

### The `path` Type

The `path` type represents file system paths and is primarily used for artifact declarations:

```workpipe
job build {
  emits build_output: path

  steps: [
    run("npm run build"),
    emit build_output from_file "dist/bundle.js"
  ]
}
```

**When to use `path` vs `string`:**

| Use `path` when... | Use `string` when... |
|-------------------|---------------------|
| Declaring artifact outputs that represent files | Passing arbitrary text between jobs |
| Referencing build output locations | Storing version strings or identifiers |
| Working with the `emit`/`emits` artifact system | The value happens to look like a path but is not an artifact |

**Note:** The `path` type is meaningful for artifact declarations where the compiler tracks file relationships. For job outputs (the `outputs:` block), prefer `string` unless you specifically need artifact semantics.

### The `json` Type

The `json` type allows you to pass complex structured data between jobs. Unlike simple primitives, JSON can represent objects, arrays, and nested structures.

**Declaring a json output:**

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    metadata: json
  }
  steps: [
    run("echo \"metadata={\\\"version\\\":\\\"1.0.0\\\",\\\"count\\\":42}\" >> $GITHUB_OUTPUT")
  ]
}
```

**Setting json output values:**

JSON must be serialized as a string when writing to `$GITHUB_OUTPUT`. This requires escaping quotes:

```workpipe
job gather_data {
  runs_on: ubuntu-latest
  outputs: {
    config: json
    items: json
  }
  steps: [
    run("echo \"config={\\\"env\\\":\\\"prod\\\",\\\"replicas\\\":3}\" >> $GITHUB_OUTPUT"),
    run("echo \"items=[\\\"a\\\",\\\"b\\\",\\\"c\\\"]\" >> $GITHUB_OUTPUT")
  ]
}
```

**Consuming json output in downstream jobs:**

Use the `fromJSON()` function in expressions to parse JSON and access its properties:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo Version: ${{ fromJSON(needs.build.outputs.metadata).version }}"),
    run("echo Count: ${{ fromJSON(needs.build.outputs.metadata).count }}")
  ]
}
```

For arrays, use bracket notation:

```workpipe
run("echo First item: ${{ fromJSON(needs.gather_data.outputs.items)[0] }}")
```

**Important caveats:**

| Caveat | Details |
|--------|---------|
| **Size limit** | GitHub Actions limits output values to approximately 1MB. For larger data, use artifacts instead. |
| **Must be valid JSON** | The value must be parseable JSON. Malformed JSON will cause `fromJSON()` to fail at runtime. |
| **String at runtime** | Like all outputs, JSON is passed as a string. You must use `fromJSON()` in expressions to access properties. |
| **No compile-time field checking** | WorkPipe cannot validate that `fromJSON(x).field` exists; that check happens at runtime. |
| **Shell escaping** | Building JSON inline requires careful escaping. Each quote level adds backslashes. |

**When to use `json` vs alternatives:**

| Use `json` when... | Use alternatives when... |
|-------------------|-------------------------|
| Data is under 1MB and needed in expressions | Data is large (use artifacts) |
| You need to access fields in `${{ }}` expressions | You only need to pass data to a script (use artifacts) |
| Data structure is relatively flat | Data is deeply nested (consider artifacts with file parsing) |
| Multiple downstream jobs need the same data | Only one job needs the data (consider direct file passing) |

For a complete example, see [examples/json-outputs/](../examples/json-outputs/).

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

### Job Output Types vs Agent Schema Types

WorkPipe has two different type contexts with different capabilities:

| Feature | Job Outputs (`outputs:` block) | Agent Task Schemas (`output_schema:`) |
|---------|-------------------------------|--------------------------------------|
| **Purpose** | Pass values between jobs via GitHub Actions | Define structured JSON output from Claude |
| **Runtime** | GitHub Actions (`$GITHUB_OUTPUT`) | Claude structured outputs (JSON) |
| **Primitive types** | `string`, `int`, `float`, `bool`, `json`, `path` | `string`, `int`, `float`, `bool` |
| **Objects** | Not supported (use `json`) | Supported: `{ field: type }` |
| **Arrays** | Not supported (use `json`) | Supported: `[type]` or `[{ ... }]` |
| **Union types** | Not supported | Supported: `"a" \| "b"` or `T \| null` |
| **Literal types** | Not supported | Supported: `"error" \| "warning"` |
| **Nullable** | Not supported | Supported: `type \| null` |

**Why the difference?**

- **Job outputs** flow through GitHub Actions, which serializes everything to strings. Complex types would be misleading since there is no runtime structure.

- **Agent task schemas** generate JSON Schema for Claude's structured output feature, which natively supports objects, arrays, and unions.

**Example: Job outputs (simple primitives)**

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
    build_number: int
    success: bool
    metadata: json       // For complex data, use json
  }
  steps: [...]
}
```

**Example: Agent task schema (rich structure)**

```workpipe
agent_task("Review code") {
  output_schema: {
    approved: bool
    comments: [{
      file: string
      line: int
      severity: "error" | "warning" | "info"
      message: string
    }]
    summary: string | null
  }
}
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
- [ADR-0010: Type System for Data Flow](../adr/0010-type-system-for-data-flow.md) - Design rationale for the type system
