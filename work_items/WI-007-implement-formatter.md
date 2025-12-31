# Implement WorkPipe Formatter (fmt command)

**ID**: WI-007
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: A+ (Post vertical slice polish)
**Phase**: 1 (Parser + AST + Formatter)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Implement the `workpipe fmt` command that formats WorkPipe source files with consistent style. This is the final CLI command to complete the command suite (build, check, fmt).

A good formatter is critical for adoption - it ensures consistent code style across teams and makes WorkPipe files more readable.

## Acceptance Criteria

- [x] `workpipe fmt` reads `.workpipe` files from disk
- [x] Default behavior: print formatted output to stdout
- [x] `--write` flag: write formatted output back to files
- [x] `--check` flag: exit with code 2 if files need formatting (for CI)
- [x] Formatting rules applied:
  - [x] Consistent indentation (2 spaces, configurable)
  - [x] Consistent brace placement
  - [x] Consistent spacing around operators
  - [x] Trailing newline
- [x] Preserves comments
- [x] Preserves triple-quoted strings exactly
- [x] Unit tests for fmt command behavior (44 format tests + 18 CLI tests)

## Technical Context

### Current State

The CLI fmt command exists at `packages/cli/src/commands/fmt.ts` with:
- File resolution via glob patterns
- Options parsing (--write, --check)
- Stub implementation with TODO comments

```typescript
// Current stub code (line 30-40):
// TODO: Invoke compiler format API once available
// For now, stub the behavior
if (check) {
  console.log(`[stub] Checking format: ${file}`);
} else if (write) {
  console.log(`[stub] Formatting: ${file}`);
} else {
  console.log(`[stub] Would format: ${file}`);
}
```

### Formatting Approach

There are two main approaches:

**Option A: CST-based formatting (recommended)**
Use the Lezer CST directly to preserve comments and whitespace:
```typescript
import { parse } from "@workpipe/lang";

function format(source: string): string {
  const tree = parse(source);
  // Walk tree and emit formatted output
  // Preserve comments by tracking whitespace tokens
}
```

**Option B: AST-based formatting**
Parse to AST, then pretty-print:
```typescript
import { buildAST } from "@workpipe/compiler";

function format(source: string): string {
  const workflows = buildAST(source);
  // Pretty-print AST to string
  // Note: loses comments since AST doesn't preserve them
}
```

### Recommended: CST-based with Printer

Create a printer that walks the CST and emits formatted output:

```typescript
// packages/compiler/src/format/printer.ts

import { parse } from "@workpipe/lang";
import type { TreeCursor } from "@lezer/common";

export function format(source: string): string {
  const tree = parse(source);
  const cursor = tree.cursor();
  const output: string[] = [];
  let indent = 0;

  function emit(text: string) {
    output.push("  ".repeat(indent) + text);
  }

  function walk(cursor: TreeCursor) {
    switch (cursor.name) {
      case "WorkflowDecl":
        emit(`workflow ${getIdentifier(cursor)} {`);
        indent++;
        // walk children
        indent--;
        emit("}");
        break;
      // ... handle other node types
    }
  }

  walk(cursor);
  return output.join("\n") + "\n";
}
```

### Formatting Rules

1. **Indentation**: 2 spaces per level
2. **Braces**: Opening brace on same line, closing on own line
3. **Colons**: No space before, one space after (`on: push`)
4. **Arrays**:
   - Short arrays on one line: `[push, pull_request]`
   - Long arrays with items on separate lines
5. **Steps**: Each step on its own line
6. **Blank lines**: One blank line between jobs
7. **Comments**: Preserve in place
8. **Triple-quoted strings**: Preserve exactly as-is

### Example Formatting

Input (messy):
```workpipe
workflow   test{
on:push
job  build{
runs_on:ubuntu-latest
steps:[run("npm install"),run("npm test")]
}
}
```

Output (formatted):
```workpipe
workflow test {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps: [
      run("npm install"),
      run("npm test")
    ]
  }
}
```

### CLI Integration

```typescript
// packages/cli/src/commands/fmt.ts

import { readFile, writeFile } from "fs/promises";
import { format } from "@workpipe/compiler";

export async function fmtAction(files: string[], options: FmtOptions): Promise<number> {
  const resolvedFiles = await resolveFiles(files);
  let needsFormatting = false;

  for (const file of resolvedFiles) {
    const source = await readFile(file, "utf-8");
    const formatted = format(source);

    if (options.check) {
      if (source !== formatted) {
        console.error(`${file}: needs formatting`);
        needsFormatting = true;
      }
    } else if (options.write) {
      if (source !== formatted) {
        await writeFile(file, formatted, "utf-8");
        console.log(`Formatted: ${file}`);
      }
    } else {
      // Print to stdout
      process.stdout.write(formatted);
    }
  }

  return needsFormatting ? EXIT_VALIDATION_FAILURE : EXIT_SUCCESS;
}
```

## Dependencies

- WI-004: Lezer grammar (complete) - provides parser
- WI-042: CLI build command (complete) - pattern to follow

## Files to Create/Modify

- `packages/compiler/src/format/printer.ts` - Formatting logic (new)
- `packages/compiler/src/format/index.ts` - Exports (new)
- `packages/compiler/src/index.ts` - Export format function
- `packages/cli/src/commands/fmt.ts` - Wire to formatter
- `packages/cli/src/commands/__tests__/fmt.test.ts` - Unit tests (new)

## Testing

```typescript
describe("format", () => {
  it("normalizes indentation", () => {
    const input = "workflow test{\njob a{}\n}";
    const expected = "workflow test {\n  job a {\n  }\n}\n";
    expect(format(input)).toBe(expected);
  });

  it("preserves comments", () => {
    const input = "// comment\nworkflow test {}";
    expect(format(input)).toContain("// comment");
  });

  it("preserves triple-quoted strings", () => {
    const input = 'run("""multi\nline""")';
    expect(format(input)).toContain('"""multi\nline"""');
  });
});

describe("fmt command", () => {
  it("--check returns 2 when files need formatting", async () => {
    // Write unformatted file
    // Run fmt --check
    // Expect EXIT_VALIDATION_FAILURE
  });

  it("--write updates files in place", async () => {
    // Write unformatted file
    // Run fmt --write
    // Read file, expect formatted
  });
});
```

## Notes

- Formatting should be idempotent: `format(format(x)) === format(x)`
- Consider adding a `.workpiperc` config file for formatting options (future)
- The formatter should not change semantics - only whitespace and style
- Error recovery: if parsing fails, leave file unchanged
- This is lower priority than the build/check commands but still valuable
