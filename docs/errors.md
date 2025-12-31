# Error Reference

WorkPipe uses diagnostic codes in the format `WPxxxx` to identify specific issues in your workflow files. This reference documents all diagnostic codes, their meanings, and how to resolve them.

## Code Categories

| Range | Category |
|-------|----------|
| WP0xxx | Parse/AST errors |
| WP6xxx | Cycle validation |
| WP7xxx | Semantic validation (required fields) |

---

## WP0xxx - Parse Errors

### WP0001: Syntax Error

**Severity:** Error

**Description:** The parser encountered invalid syntax that does not conform to the WorkPipe grammar.

**Example:**

```workpipe
workflow ci {
  on push  # Missing colon

  job build {
    runs_on: ubuntu-latest
  }
}
```

**Solution:** Check the syntax at the indicated location. Common causes include:
- Missing colons after field names (`on:` not `on`)
- Unclosed braces or brackets
- Invalid keywords or identifiers
- Missing commas in lists

---

### WP0002: AST Build Failure

**Severity:** Error

**Description:** The parser produced a valid parse tree, but the compiler could not construct an Abstract Syntax Tree from it. This typically indicates an internal compiler issue or a malformed structure that passed initial parsing.

**Example:** This error is rare and usually indicates an edge case in the grammar.

**Solution:** If you encounter this error:
1. Simplify your workflow to isolate the problematic construct
2. Check for unusual combinations of syntax elements
3. Report the issue if it persists with valid-looking code

---

## WP6xxx - Cycle Validation

### WP6001: Cycle Missing Termination Condition

**Severity:** Error

**Description:** A cycle must have at least one termination condition to prevent infinite loops. Cycles require either `max_iters` (maximum iteration count) or `until` (guard condition), or both.

**Example:**

```workpipe
workflow ci {
  on: push

  cycle review_loop {
    # Error: No termination condition
    agent_job reviewer {
      runs_on: ubuntu-latest
      prompt: "Review the code"
    }
  }
}
```

**Solution:** Add a termination condition to the cycle:

```workpipe
cycle review_loop {
  max_iters = 5  # Option 1: Fixed iteration limit

  agent_job reviewer {
    runs_on: ubuntu-latest
    prompt: "Review the code"
  }
}
```

Or use a guard condition:

```workpipe
cycle review_loop {
  until guard_js """
    return context.approved === true;
  """

  agent_job reviewer {
    runs_on: ubuntu-latest
    prompt: "Review the code"
  }
}
```

---

### WP6005: Cycle Missing Safety Rail

**Severity:** Warning

**Description:** A cycle has an `until` guard condition but no `max_iters` safety limit. While the cycle will terminate when the guard condition is met, a bug in the guard logic could cause an infinite loop.

**Example:**

```workpipe
workflow ci {
  on: push

  cycle review_loop {
    until guard_js """
      return context.approved === true;
    """

    agent_job reviewer {
      runs_on: ubuntu-latest
      prompt: "Review the code"
    }
  }
}
```

**Solution:** Add `max_iters` as a safety rail alongside your `until` condition:

```workpipe
cycle review_loop {
  max_iters = 10  # Safety limit
  until guard_js """
    return context.approved === true;
  """

  agent_job reviewer {
    runs_on: ubuntu-latest
    prompt: "Review the code"
  }
}
```

This ensures the cycle will terminate even if the guard condition never evaluates to true.

---

## WP7xxx - Semantic Validation

### WP7001: Job Missing runs_on

**Severity:** Error

**Description:** A `job` block is missing the required `runs_on` field. Every job must specify which GitHub Actions runner to use.

**Example:**

```workpipe
workflow ci {
  on: push

  job build {
    # Error: Missing runs_on
    steps: [
      run("npm install")
    ]
  }
}
```

**Solution:** Add the `runs_on` field to specify a runner:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run("npm install")
  ]
}
```

Common runner values:
- `ubuntu-latest` - Ubuntu Linux
- `windows-latest` - Windows Server
- `macos-latest` - macOS

---

### WP7002: Agent Job Missing runs_on

**Severity:** Error

**Description:** An `agent_job` block is missing the required `runs_on` field. Like regular jobs, agent jobs must specify which GitHub Actions runner to use.

**Example:**

```workpipe
workflow ci {
  on: push

  agent_job coder {
    # Error: Missing runs_on
    prompt: "Write the code"
  }
}
```

**Solution:** Add the `runs_on` field:

```workpipe
agent_job coder {
  runs_on: ubuntu-latest
  prompt: "Write the code"
}
```

---

### WP7004: Empty Workflow

**Severity:** Warning

**Description:** A workflow is defined but contains no jobs or cycles. While syntactically valid, an empty workflow serves no purpose.

**Example:**

```workpipe
workflow ci {
  on: push
  # Warning: No jobs or cycles
}
```

**Solution:** Add at least one job or cycle to the workflow:

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps: [
      run("echo Hello, World!")
    ]
  }
}
```

---

## Diagnostic Output Format

When WorkPipe reports diagnostics, they appear in the following format:

```
error[WP0001]: Unexpected token
  --> workflow.workpipe:3:5
   |
 3 |   on push
   |      ^^^^
   |
   = help: Expected ':' after 'on'
```

The output includes:
- **Severity and code** (`error[WP0001]`)
- **Message** describing the issue
- **Location** (file, line, column)
- **Source snippet** with the problematic region highlighted
- **Help text** (when available) suggesting a fix
