# Troubleshooting Guide

This guide helps you diagnose and fix common errors in WorkPipe files. Each section shows the problematic code, the error message you will see, and how to fix it.

For a complete list of all diagnostic codes, see the [Error Reference](errors.md).

---

## Syntax Errors

These errors occur when the WorkPipe parser encounters invalid syntax.

### Missing {} After uses() in Block Syntax

**Problem:** When using block syntax (`steps { }`), the `uses()` step requires a trailing block. Omitting it causes a parse error.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4")
      shell { npm test }
    }
  }
}
```

**Error message:**

```
error: expected '{' after uses() in block syntax
  --> workflow.workpipe:7:5
   |
 7 |       uses("actions/checkout@v4")
   |       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: Add '{}' after uses() when no configuration is needed
```

**Fix:**

Add an empty block `{}` after `uses()`:

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      shell { npm test }
    }
  }
}
```

With configuration, provide the block contents:

```workpipe
uses("actions/setup-node@v4") {
  with: { node-version: "20" }
}
```

**Why is this required?**

In block syntax, the parser needs a consistent way to determine where each step ends. The trailing block serves as the delimiter. In array syntax (`steps: [...]`), commas serve this purpose, so `uses()` does not require a trailing block there.

**Quick reference:**

| Syntax | Correct | Incorrect |
|--------|---------|-----------|
| Block syntax | `uses("action@v1") {}` | `uses("action@v1")` |
| Array syntax | `uses("action@v1"),` | (both work) |

---

## Common Type Errors

These errors occur when WorkPipe detects issues with typed job outputs or agent task schemas.

### WP2010: Duplicate Output Name

**Problem:** A job declares the same output name more than once.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      version: int
    }
    steps: [run("echo hello")]
  }
}
```

**Error message:**

```
error[WP2010]: Duplicate output 'version' in job 'build'
  --> workflow.workpipe:7:7
   |
 7 |       version: int
   |       ^^^^^^^
   |
   = help: Remove or rename one of the duplicate outputs named 'version'
```

**Fix:**

Each output name must be unique within a job. Remove the duplicate or rename one of them:

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      build_number: int
    }
    steps: [run("echo hello")]
  }
}
```

---

### WP2011: Reference to Non-Existent Output

**Problem:** A job references an output that does not exist on the dependency job, or references a job that is not in the `needs` list.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      artifact_path: string
    }
    steps: [run("echo version=1.0.0 >> $GITHUB_OUTPUT")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${{ needs.build.outputs.typo }}")
    ]
  }
}
```

**Error message:**

```
error[WP2011]: Reference to non-existent output 'typo' on job 'build'
  --> workflow.workpipe:17:11
    |
 17 |       run("echo ${{ needs.build.outputs.typo }}")
    |           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: Available outputs on 'build': version, artifact_path
```

The error message helpfully lists which outputs are actually available on the referenced job.

**Fix:**

Check the spelling and use an output that exists on the dependency job:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.version }}")
  ]
}
```

**Common causes:**
- Typos in the output name
- Referencing a job that is not in the `needs` list
- Copying code from another job without updating the output names

---

### WP2012: Type Mismatch in Comparison

**Problem:** A comparison expression uses operands with incompatible types, such as comparing an integer output to a string literal.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      count: int
    }
    steps: [run("echo count=42 >> $GITHUB_OUTPUT")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("if ${{ needs.build.outputs.count == 'hello' }}; then echo yes; fi")
    ]
  }
}
```

**Error message:**

```
error[WP2012]: Type mismatch in comparison: cannot compare 'int' with 'string'
  --> workflow.workpipe:17:15
    |
 17 |       run("if ${{ needs.build.outputs.count == 'hello' }}; then echo yes; fi")
    |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: Ensure both sides of the '==' comparison have compatible types
```

**Fix:**

Ensure both sides of the comparison have compatible types:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("if ${{ needs.build.outputs.count == 42 }}; then echo yes; fi")
  ]
}
```

**Compatible type combinations:**
- `int` with `int` or `float`
- `float` with `int` or `float`
- `string` with `string`
- `bool` with `bool`

**Note:** Numeric comparison operators (`<`, `>`, `<=`, `>=`) require both operands to be numeric types (`int` or `float`). Use `==` or `!=` for non-numeric comparisons.

---

### WP2013: Numeric Operation on Non-Numeric Type

**Problem:** An arithmetic operation (`+`, `-`, `*`, `/`) is used with operands that are not numeric types.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      name: string
    }
    steps: [run("echo name=myapp >> $GITHUB_OUTPUT")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${{ needs.build.outputs.name + 1 }}")
    ]
  }
}
```

**Error message:**

```
warning[WP2013]: Numeric operation on non-numeric type: left operand is 'string'
  --> workflow.workpipe:17:16
    |
 17 |       run("echo ${{ needs.build.outputs.name + 1 }}")
    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: Arithmetic operator '+' expects numeric operands (int or float)
```

**Note:** This is a warning, not an error. The workflow will still compile, but the behavior at runtime may be unexpected.

**Fix:**

Either change the output type to numeric if it represents a number, or avoid arithmetic operations on string values:

```workpipe
// Option 1: Use numeric output type if the value is actually a number
job build {
  runs_on: ubuntu-latest
  outputs: {
    build_number: int
  }
  steps: [run("echo build_number=42 >> $GITHUB_OUTPUT")]
}

job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.build_number + 1 }}")
  ]
}

// Option 2: Avoid arithmetic on strings
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.name }}")
  ]
}
```

---

## User-Defined Type Errors

These errors occur when working with user-defined types (the `type` keyword).

### WP5001: Duplicate Type Name

**Problem:** Two type definitions have the same name.

**Code that causes the error:**

```workpipe
type BuildInfo {
  version: string
}

type BuildInfo {
  status: string
}

workflow ci {
  on: push
}
```

**Error message:**

```
error[WP5001]: Duplicate type 'BuildInfo'
  --> workflow.workpipe:5:1
   |
 5 | type BuildInfo {
   | ^^^^^^^^^^^^^^
   |
   = help: Each type name must be unique within a file
```

**Fix:**

Rename one of the types to have a unique name:

```workpipe
type BuildInfo {
  version: string
}

type BuildStatus {
  status: string
}
```

---

### WP5002: Unknown Type Reference

**Problem:** A job output references a type that has not been defined.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }
}
```

**Error message:**

```
error[WP5002]: Unknown type 'BuildInfo'
  --> workflow.workpipe:8:13
   |
 8 |       info: BuildInfo
   |             ^^^^^^^^^
   |
   = help: Define the type before using it, or check the spelling
```

**Fix:**

Define the type before the workflow block:

```workpipe
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }
}
```

---

### WP5003: Property Does Not Exist on Type

**Problem:** An expression accesses a property that does not exist on the referenced type.

**Code that causes the error:**

```workpipe
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo version=1.0 >> $GITHUB_OUTPUT")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${{ needs.build.outputs.info.status }}")
    ]
  }
}
```

**Error message:**

```
error[WP5003]: Property 'status' does not exist on type 'BuildInfo'
  --> workflow.workpipe:21:11
    |
 21 |       run("echo ${{ needs.build.outputs.info.status }}")
    |           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
    = help: Available properties on 'BuildInfo': version, commit
```

**Fix:**

Use a property that exists on the type, or add the missing property to the type definition:

```workpipe
type BuildInfo {
  version: string
  commit: string
  status: string
}
```

---

## Schema Validation Errors

These errors occur when defining inline output schemas for agent tasks.

### WP3001: Unknown Primitive Type

**Problem:** An inline schema uses an unrecognized primitive type name.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  agent_job analyzer {
    runs_on: ubuntu-latest
    agent_task("Analyze the data") {
      output_schema: {
        count: integer
      }
    }
  }
}
```

**Error message:**

```
error[WP3001]: Unknown primitive type 'integer'
  --> workflow.workpipe:9:16
   |
 9 |         count: integer
   |                ^^^^^^^
   |
   = help: Valid primitive types are: string, int, float, bool
```

**Fix:**

Use one of the valid primitive types:

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  agent_task("Analyze the data") {
    output_schema: {
      count: int
    }
  }
}
```

**Valid primitive types:** `string`, `int`, `float`, `bool`

**Common mistakes:**
- `integer` instead of `int`
- `boolean` instead of `bool`
- `number` instead of `int` or `float`
- `str` instead of `string`

---

### WP3004: Duplicate Property Name in Schema

**Problem:** An object schema defines the same property name more than once.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  agent_job analyzer {
    runs_on: ubuntu-latest
    agent_task("Analyze the data") {
      output_schema: {
        name: string
        value: int
        name: string
      }
    }
  }
}
```

**Error message:**

```
error[WP3004]: Duplicate property name 'name' in schema
  --> workflow.workpipe:11:9
    |
 11 |         name: string
    |         ^^^^
    |
    = help: Remove or rename one of the duplicate properties named 'name'
```

**Fix:**

Remove or rename the duplicate property:

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  agent_task("Analyze the data") {
    output_schema: {
      name: string
      value: int
      display_name: string
    }
  }
}
```

---

## Required Field Errors

These errors occur when required fields are missing from your workflow definition.

### WP7001: Job Missing runs_on

**Problem:** A `job` block is missing the required `runs_on` field.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  job build {
    steps: [run("npm install")]
  }
}
```

**Error message:**

```
error[WP7001]: Job 'build' is missing required field 'runs_on'
  --> workflow.workpipe:4:3
   |
 4 |   job build {
   |   ^^^^^^^^^^^
   |
   = help: Add 'runs_on: ubuntu-latest' or another runner specification
```

**Fix:**

Add the `runs_on` field to specify a GitHub Actions runner:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [run("npm install")]
}
```

**Common runner values:**
- `ubuntu-latest` - Ubuntu Linux
- `windows-latest` - Windows Server
- `macos-latest` - macOS

---

### WP6001: Cycle Missing Termination Condition

**Problem:** A `cycle` block has neither `max_iters` nor `until` to ensure it terminates.

**Code that causes the error:**

```workpipe
workflow ci {
  on: push

  cycle refine {
    body {
      job work {
        runs_on: ubuntu-latest
        steps: [run("./refine.sh")]
      }
    }
  }
}
```

**Error message:**

```
error[WP6001]: Cycle 'refine' is missing termination condition
  --> workflow.workpipe:4:3
   |
 4 |   cycle refine {
   |   ^^^^^^^^^^^^^
   |
   = help: Add 'max_iters = N' or 'until guard_js "..."' to ensure cycle terminates
```

**Fix:**

Add at least one termination condition:

```workpipe
cycle refine {
  max_iters = 5

  body {
    job work {
      runs_on: ubuntu-latest
      steps: [run("./refine.sh")]
    }
  }
}
```

Or use a guard condition:

```workpipe
cycle refine {
  max_iters = 10
  until guard_js """
    return state.quality_score > 0.95;
  """

  body {
    job work {
      runs_on: ubuntu-latest
      steps: [run("./refine.sh")]
    }
  }
}
```

---

## See Also

- [Error Reference](errors.md) - Complete list of all diagnostic codes
- [Language Reference](language-reference.md) - Full syntax and semantics guide
- [VS Code Extension](vscode-extension.md) - Editor integration and diagnostics
