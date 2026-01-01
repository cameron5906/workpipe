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

## Block Syntax Issues

These errors and unexpected behaviors relate to the block-based step syntax (`steps { }` with `shell { }` blocks).

### Brace Counting and Shell Variable Expansion

**Problem:** Users may wonder whether shell variable syntax like `${VAR}` will confuse the parser, since it contains braces.

**Good news:** This works correctly:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell {
      echo "Version: ${VERSION}"
      echo "Path: ${HOME}/.config"
      NAME="${FIRST}_${LAST}"
      echo "Name: $NAME"
    }
  }
}
```

**Why this works:** The shell tokenizer uses brace-counting. Each `{` increments a depth counter, and each `}` decrements it. Since `${VAR}` contains both an opening and closing brace, the count remains balanced, and the block ends correctly at the outer `}`.

**What does NOT work:** Literal unbalanced braces in your shell code:

```workpipe
// PROBLEMATIC: Unbalanced literal braces
shell {
  echo "{"        // This { has no matching }
}
```

If you need to output literal braces, balance them or use alternative approaches:

```workpipe
// WORKAROUND: Use printf with escaped brace
shell {
  printf '%s\n' '{'
  printf '%s\n' '}'
}

// OR: Balanced braces in output
shell {
  echo "{}"
}
```

---

### Nested Braces in Control Structures

**Problem:** Complex shell control structures with braces might seem risky.

**This works correctly:**

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell {
      if [ -f package.json ]; then
        npm ci
      fi

      for file in *.js; do
        echo "Processing: $file"
      done

      while read -r line; do
        echo "$line"
      done < input.txt
    }
  }
}
```

**Why it works:** Shell control structures like `if/then/fi`, `for/do/done`, and `while/do/done` do not use braces. The brace-counting only applies to actual `{` and `}` characters.

**Bash function definitions with braces also work:**

```workpipe
shell {
  my_function() {
    echo "Inside function"
  }
  my_function
}
```

The inner `{ }` around the function body is balanced, so the parser correctly identifies the outer `}` as the end of the shell block.

---

### Indentation Handling in Shell Blocks

**Problem:** Users may be unsure how indentation in shell blocks translates to the generated YAML.

**How it works:** The compiler automatically strips the common leading indentation from all non-empty lines in a shell block.

**WorkPipe source:**

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell {
      npm ci
      npm run build
      npm test
    }
  }
}
```

**Generated YAML:**

```yaml
steps:
  - run: |-
      npm ci
      npm run build
      npm test
```

**The algorithm:**
1. Split content into lines
2. Find the minimum indentation across all non-empty lines
3. Strip that many characters from the start of each line
4. Trim leading/trailing whitespace from the result

**What this means:**
- Your WorkPipe indentation does not appear in the output
- All lines are dedented by the same amount
- Empty lines are preserved (but not counted for minimum indent calculation)

**Edge case - mixed indentation:**

```workpipe
shell {
  echo "start"
    echo "indented in WorkPipe"
  echo "end"
}
```

Generates:

```yaml
run: |-
  echo "start"
    echo "indented in WorkPipe"
  echo "end"
```

The relative indentation between lines is preserved. Only the common leading indent is stripped.

---

### Here-Documents in Shell Blocks

**Problem:** Here-documents (heredocs) have their own delimiter syntax that might interact unexpectedly with block parsing.

**This works correctly:**

```workpipe
shell {
  cat <<EOF
  Line 1
  Line 2
  EOF
}
```

**Why it works:** The shell tokenizer only counts `{` and `}` characters. Heredoc delimiters like `<<EOF` and `EOF` are not braces and do not affect the block boundary detection.

**Heredocs with braces in content also work:**

```workpipe
shell {
  cat <<EOF
  {
    "key": "value"
  }
  EOF
}
```

The braces inside the heredoc are still counted, but since they are balanced (`{` and `}`), the block ends correctly.

---

### Single-Line vs Multi-Line Shell Blocks

**Problem:** Users may be unsure when to use single-line versus multi-line shell blocks.

**Single-line form:**

```workpipe
shell { echo "Hello, World!" }
```

**Multi-line form:**

```workpipe
shell {
  echo "Line 1"
  echo "Line 2"
}
```

**Recommendation:** Use single-line for simple, single commands. Use multi-line for scripts with multiple commands or complex logic.

**Note:** Both forms produce equivalent YAML. The multi-line form uses YAML block scalar syntax (`|-`), while single-line produces a simple string.

---

### Empty Shell Blocks

**Problem:** An empty shell block may cause unexpected behavior.

**Code that might surprise you:**

```workpipe
shell { }
```

**What happens:** This produces an empty `run:` step in YAML, which GitHub Actions will execute as a no-op. While not an error, it is probably not what you intended.

**Fix:** Either remove the empty shell block or add the intended commands:

```workpipe
shell {
  echo "Doing something useful"
}
```

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
- [Language Reference: Shell Blocks](language-reference.md#shell-blocks) - Shell block syntax details
- [VS Code Extension](vscode-extension.md) - Editor integration and diagnostics
