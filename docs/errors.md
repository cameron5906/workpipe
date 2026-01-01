# Error Reference

WorkPipe uses diagnostic codes in the format `WPxxxx` to identify specific issues in your workflow files. This reference documents all diagnostic codes, their meanings, and how to resolve them.

## Code Categories

| Range | Category |
|-------|----------|
| WP0xxx | Parse/AST errors |
| WP2xxx | Output validation |
| WP3xxx | Schema validation |
| WP4xxx | Matrix validation |
| WP5xxx | Type validation |
| WP6xxx | Cycle validation |
| WP7xxx | Import validation |
| WP8xxx | Semantic validation (required fields) |

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

## WP2xxx - Output Validation

### WP2010: Duplicate Output Name

**Severity:** Error

**Description:** A job declares the same output name more than once.

**Example:**

```workpipe
job build {
  runs_on: ubuntu-latest
  outputs: {
    version: string
    version: int  // Error: duplicate
  }
}
```

**Solution:** Remove or rename the duplicate output declaration.

---

### WP2011: Reference to Non-Existent Output

**Severity:** Error

**Description:** A job references an output from another job using `${{ needs.<job>.outputs.<name> }}`, but the referenced output does not exist on that job, or the referenced job is not in the `needs` list.

**Example:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      artifact_path: string
    }
    steps: [run("echo hello")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${{ needs.build.outputs.typo }}")  // Error: 'typo' doesn't exist
    ]
  }
}
```

**Solution:** Check the spelling of the output name and ensure it matches a declared output on the referenced job:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.version }}")  // Correct: 'version' exists
  ]
}
```

If referencing a job not in your `needs` list, add it:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]  // Ensure the job is listed here
  steps: [
    run("echo ${{ needs.build.outputs.version }}")
  ]
}
```

The error message will list all available outputs on the referenced job to help identify the correct name.

---

### WP2012: Type Mismatch in Comparison

**Severity:** Error

**Description:** A comparison expression uses operands with incompatible types. This occurs when:
- Comparing a string output to a numeric literal (or vice versa)
- Comparing a boolean output to a numeric or string literal
- Using numeric comparison operators (`<`, `>`, `<=`, `>=`) with non-numeric types

**Example:**

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
      // Error: comparing int to string
    ]
  }
}
```

**Solution:** Ensure both sides of the comparison have compatible types:

```workpipe
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("if ${{ needs.build.outputs.count == 42 }}; then echo yes; fi")
    // Correct: comparing int to int
  ]
}
```

Compatible type combinations:
- `int` with `int` or `float`
- `float` with `int` or `float`
- `string` with `string`
- `bool` with `bool`

---

### WP2013: Numeric Operation on Non-Numeric Type

**Severity:** Warning

**Description:** An arithmetic operation (`+`, `-`, `*`, `/`) is used with operands that are not declared as numeric types (`int` or `float`). This may indicate a type error that could cause unexpected behavior at runtime.

**Example:**

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
      // Warning: arithmetic on string type
    ]
  }
}
```

**Solution:** Either change the output type to numeric, or avoid arithmetic operations on string values:

```workpipe
// Option 1: Use numeric output type
job build {
  outputs: {
    version: int
  }
}

// Option 2: Avoid arithmetic on strings
job deploy {
  steps: [
    run("echo ${{ needs.build.outputs.name }}")
  ]
}
```

---

## WP3xxx - Schema Validation

### WP3001: Unknown Primitive Type

**Severity:** Error

**Description:** An inline schema uses an unrecognized primitive type. WorkPipe schemas support only `string`, `int`, `float`, and `bool` as primitive types.

**Example:**

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      count: integer  // Error: 'integer' is not valid, use 'int'
    }
  }
}
```

**Solution:** Use one of the valid primitive types:

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      count: int  // Correct
    }
  }
}
```

Valid primitive types are: `string`, `int`, `float`, `bool`

---

### WP3002: Empty Object Schema

**Severity:** Error

**Description:** An `output_schema` is defined as an empty object `{}` with no properties. An empty schema serves no purpose and likely indicates a mistake.

**Example:**

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {}  // Error: empty schema
  }
}
```

**Solution:** Add at least one property to the schema, or remove the `output_schema` if not needed:

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      result: string
      confidence: float
    }
  }
}
```

---

### WP3003: Invalid Union Type

**Severity:** Error

**Description:** A union type in the schema contains incompatible or nonsensical type combinations. Unions should combine related types that make semantic sense together.

**Example:**

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      value: int | string  // Error: mixing numeric and string primitives
    }
  }
}
```

**Solution:** Use more specific type combinations:

```workpipe
// Option 1: Use string literals for known values
output_schema: {
  status: "pending" | "complete" | "failed"
}

// Option 2: Use nullable types
output_schema: {
  result: string | null
}

// Option 3: Use discriminated unions for complex cases
output_schema: {
  type: "success"
  value: string
} | {
  type: "error"
  message: string
}
```

Invalid union combinations include:
- Mixing primitive types like `int | string` or `bool | float`
- Mixing primitives with objects
- Mixing primitives with arrays
- Using string primitives with string literals (use just the literals)

---

### WP3004: Duplicate Property Name

**Severity:** Error

**Description:** The same property name appears more than once in an object schema definition.

**Example:**

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      name: string
      value: int
      name: string  // Error: duplicate property 'name'
    }
  }
}
```

**Solution:** Remove or rename the duplicate property:

```workpipe
agent_job analyzer {
  runs_on: ubuntu-latest
  task "Analyze the data" {
    output_schema: {
      name: string
      value: int
      display_name: string  // Renamed to avoid duplicate
    }
  }
}
```

---

## WP4xxx - Matrix Validation

### WP4001: Matrix Exceeds Job Limit

**Severity:** Error

**Description:** A matrix job's configuration would generate more than 256 jobs, which exceeds GitHub Actions' limit. GitHub Actions enforces a maximum of 256 jobs per matrix expansion.

**Example:**

```workpipe
workflow ci {
  on: push

  matrix_job test {
    matrix: {
      os: [ubuntu-latest, windows-latest, macos-latest]
      node: [14, 16, 18, 20]
      browser: [chrome, firefox, safari, edge]
      arch: [x64, arm64]
      mode: [development, production, test]
    }
    runs_on: ${{ matrix.os }}
    steps: [
      run("npm test")
    ]
  }
}
```

In this example: 3 x 4 x 4 x 2 x 3 = 288 jobs, which exceeds the 256 limit.

**Solution:** Reduce the matrix dimensions by:

1. **Combining related axes:**
```workpipe
matrix_job test {
  matrix: {
    os: [ubuntu-latest, windows-latest]
    node: [16, 18, 20]
    browser: [chrome, firefox]
  }
  # 2 x 3 x 2 = 12 jobs
}
```

2. **Using exclude to filter out unnecessary combinations:**
```workpipe
matrix_job test {
  matrix: {
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [14, 16, 18, 20]
    browser: [chrome, firefox, safari, edge]
  }
  exclude: [
    { os: windows-latest, browser: safari },
    { os: ubuntu-latest, browser: safari },
    { os: macos-latest, browser: edge }
  ]
}
```

3. **Splitting into multiple matrix jobs:**
```workpipe
matrix_job test_linux {
  matrix: { node: [14, 16, 18, 20], browser: [chrome, firefox] }
  runs_on: ubuntu-latest
}

matrix_job test_windows {
  matrix: { node: [16, 18], browser: [chrome, edge] }
  runs_on: windows-latest
}
```

---

### WP4002: Matrix Approaching Job Limit

**Severity:** Warning

**Description:** A matrix job would generate more than 200 jobs, which is approaching GitHub Actions' 256-job limit. While currently valid, adding more matrix dimensions could cause the workflow to fail.

**Example:**

```workpipe
workflow ci {
  on: push

  matrix_job test {
    matrix: {
      os: [ubuntu-latest, windows-latest, macos-latest]
      node: [14, 16, 18, 20]
      browser: [chrome, firefox, safari, edge]
      mode: [development, production, test]
    }
    runs_on: ${{ matrix.os }}
    steps: [
      run("npm test")
    ]
  }
}
```

In this example: 3 x 4 x 4 x 3 = 144 jobs. Adding one more 2-value axis would push it to 288 jobs.

**Solution:** Consider reducing matrix dimensions now to leave room for future expansion. See the solutions for WP4001 above.

---

## WP5xxx - Type Validation

### WP5001: Duplicate Type Name

**Severity:** Error

**Description:** A user-defined type with the same name has already been declared in this file. Type names must be unique within a workflow file.

**Example:**

```workpipe
type BuildInfo {
  version: string
  commit: string
}

type BuildInfo {  // Error: duplicate type name
  status: string
}
```

**Solution:** Rename one of the types to have a unique name:

```workpipe
type BuildInfo {
  version: string
  commit: string
}

type BuildStatus {  // Renamed to avoid collision
  status: string
}
```

If you intended to extend the original type, consider combining the properties into a single type definition.

---

### WP5002: Unknown Type Reference

**Severity:** Error

**Description:** A job output references a type that has not been defined. This occurs when you use a type name in an output declaration but no matching `type` block exists.

**Example:**

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo  // Error: BuildInfo is not defined
    }
    steps: [run("echo hello")]
  }
}
```

**Solution:** Define the type before using it, or fix the type name if it's a typo:

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
      info: BuildInfo  // Now valid - type is defined above
    }
    steps: [run("echo hello")]
  }
}
```

The error message will suggest similar type names if any are available. For example, if you typed `BuildInof` but defined `BuildInfo`, the hint will suggest the correct spelling.

---

### WP5003: Property Does Not Exist on Type

**Severity:** Error

**Description:** An expression accesses a property that does not exist on the referenced type. This occurs when using `${{ needs.<job>.outputs.<output>.<property> }}` syntax where the property is not part of the type definition.

**Example:**

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
      run("echo ${{ needs.build.outputs.info.status }}")  // Error: 'status' doesn't exist on BuildInfo
    ]
  }
}
```

**Solution:** Use a property that exists on the type, or add the missing property to the type definition:

```workpipe
type BuildInfo {
  version: string
  commit: string
  status: string  // Option 1: Add the missing property
}

// Or use an existing property:
job deploy {
  runs_on: ubuntu-latest
  needs: [build]
  steps: [
    run("echo ${{ needs.build.outputs.info.version }}")  // Option 2: Use existing property
  ]
}
```

The error message will list available properties on the type to help you choose the correct one.

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

## WP7xxx - Import Validation

### WP7001: Circular Import Detected

**Severity:** Error

**Description:** The import system detected a circular dependency between files. Circular imports occur when file A imports from file B, and file B (directly or indirectly) imports from file A.

**Example:**

```workpipe
// a.workpipe
import { TypeB } from "./b.workpipe"

type TypeA {
  ref: TypeB
}
```

```workpipe
// b.workpipe
import { TypeA } from "./a.workpipe"  // Error: Creates circular import

type TypeB {
  ref: TypeA
}
```

**Solution:** Extract shared types to a third file that both can import:

```workpipe
// shared.workpipe
type TypeA {
  value: string
}

type TypeB {
  value: string
}
```

```workpipe
// a.workpipe
import { TypeA, TypeB } from "./shared.workpipe"
```

```workpipe
// b.workpipe
import { TypeA, TypeB } from "./shared.workpipe"
```

---

### WP7002: Import File Not Found

**Severity:** Error

**Description:** The specified import path does not resolve to an existing file. This occurs when the file path is incorrect or the file has been moved/deleted.

**Example:**

```workpipe
import { Config } from "./missing.workpipe"  // Error: File does not exist
```

**Solution:** Check that:
1. The file path is spelled correctly
2. The file exists at the specified location
3. The path is relative (starts with `./` or `../`)
4. The `.workpipe` extension is included

---

### WP7003: Type Not Exported

**Severity:** Error

**Description:** The requested type does not exist in the source file, or the type was imported from another file and cannot be re-exported (types are not transitive).

**Example:**

```workpipe
// types.workpipe
type BuildInfo {
  version: string
}
```

```workpipe
// main.workpipe
import { BuildInof } from "./types.workpipe"  // Error: Typo - "BuildInof" instead of "BuildInfo"
```

**Solution:** The error message will suggest similar type names if a typo is detected:

```
error[WP7003]: Type 'BuildInof' does not exist in './types.workpipe'
  --> main.workpipe:1:10
   |
   = hint: Did you mean 'BuildInfo'? Available types: BuildInfo
```

If the type was imported from another file, import directly from the original source:

```workpipe
// Instead of importing through an intermediate file:
import { SharedType } from "./middle.workpipe"  // Error if SharedType was imported into middle.workpipe

// Import directly from the original source:
import { SharedType } from "./original.workpipe"
```

---

### WP7004: Duplicate Import

**Severity:** Error

**Description:** The same type is imported more than once in a file. This usually indicates a copy-paste error.

**Example:**

```workpipe
import { Config, Config } from "./types.workpipe"  // Error: Duplicate import
```

**Solution:** Remove the duplicate import:

```workpipe
import { Config } from "./types.workpipe"
```

---

### WP7005: Name Collision

**Severity:** Error

**Description:** An imported type name conflicts with a locally defined type or another import. Each type name must be unique within a file.

**Example:**

```workpipe
type Config {
  local: string
}

import { Config } from "./external.workpipe"  // Error: 'Config' already exists
```

**Solution:** Use an alias to rename the imported type:

```workpipe
type Config {
  local: string
}

import { Config as ExternalConfig } from "./external.workpipe"
```

---

### WP7006: Invalid Import Path

**Severity:** Error

**Description:** The import path is malformed. WorkPipe only allows relative import paths that start with `./` or `../`. Absolute paths and bare module names are not allowed.

**Example:**

```workpipe
import { Type } from "/absolute/path.workpipe"  // Error: Absolute path
import { Type } from "types.workpipe"           // Error: Missing ./
```

**Solution:** Use a relative path:

```workpipe
import { Type } from "./types.workpipe"
import { Type } from "../shared/types.workpipe"
```

---

### WP7007: Import Path Escapes Project Root

**Severity:** Error

**Description:** The resolved import path is outside the project directory. For security and portability, all imported files must be within the project root.

**Example:**

```workpipe
// In /project/src/main.workpipe
import { Secret } from "../../outside-project/secrets.workpipe"  // Error
```

**Solution:** Keep all imported files within the project directory. If you need to share types across projects, consider:
1. Creating a shared package
2. Copying the types into each project
3. Restructuring your project layout

---

## WP8xxx - Semantic Validation

### WP8001: Job Missing runs_on

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

### WP8002: Agent Job Missing runs_on

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

### WP8004: Empty Workflow

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
