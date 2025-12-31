# Wire CLI Build Command to Compiler

**ID**: WI-042
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A (Vertical slice - completion)
**Phase**: 2 (Minimal Workflow Codegen)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Connect the `workpipe build` CLI command to the compiler's `compile()` function. This makes the compiler usable from the command line, completing the user-facing vertical slice.

Currently, the CLI has the command structure in place but outputs stub messages. This work item wires it to the actual compiler and file I/O.

## Acceptance Criteria

- [x] `workpipe build` reads `.workpipe` files from disk
- [x] `workpipe build` invokes `compile()` from `@workpipe/compiler`
- [x] Output YAML written to `.github/workflows/<workflow-name>.yml`
- [x] `--output` flag specifies alternate output directory
- [x] `--dry-run` shows what would be generated without writing files
- [x] `--verbose` shows processing details
- [x] Error handling for:
  - [x] File not found
  - [x] Parse errors (display to stderr)
  - [x] Write failures
- [x] Exit codes follow contract (0=success, 1=error, 2=validation)
- [x] Integration test: compile fixture and verify output file created

## Technical Context

### Current State

The CLI build command exists at `packages/cli/src/commands/build.ts` with:
- File resolution via glob patterns
- Options parsing (-o, -w, --dry-run, -v)
- Stub implementation with TODO comments

```typescript
// Current stub code (line 45-46):
// TODO: Invoke compiler API once available
console.log(`[stub] Compiling: ${file} -> ${output}`);
```

### Compiler API (from WI-008)

The compiler exports:
```typescript
import { compile } from "@workpipe/compiler";

const yamlOutput: string = compile(workpipeSource);
```

### Implementation Steps

1. **Read source file:**
```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { basename, join, dirname } from "path";

const source = await readFile(file, "utf-8");
```

2. **Compile:**
```typescript
import { compile } from "@workpipe/compiler";

const yaml = compile(source);
```

3. **Determine output path:**
```typescript
// Extract workflow name from source or use filename
const workflowName = extractWorkflowName(source) || basename(file, ".workpipe");
const outputPath = join(options.output, `${workflowName}.yml`);
```

4. **Write output:**
```typescript
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, yaml, "utf-8");
```

### Error Handling

Parse/compile errors should be caught and reported:
```typescript
try {
  const yaml = compile(source);
  // ...write output
} catch (error) {
  console.error(`Error compiling ${file}:`);
  console.error(error.message);
  return EXIT_ERROR;
}
```

### Workflow Name Extraction

The workflow name should come from the AST or be parsed from source:
```typescript
function extractWorkflowName(source: string): string | null {
  // Quick regex extraction or use buildAST
  const match = source.match(/workflow\s+(\w+)\s*\{/);
  return match ? match[1] : null;
}
```

Or export a utility from compiler:
```typescript
import { buildAST } from "@workpipe/compiler";

const workflows = buildAST(source);
const name = workflows[0]?.name;
```

## Dependencies

- WI-008: YAML IR and emitter (complete) - provides `compile()` function
- WI-002: CLI interface (complete) - provides command structure

## Files to Modify

- `packages/cli/src/commands/build.ts` - Main implementation
- `packages/cli/package.json` - May need to add fs dependencies (should be built-in)

## Testing

Create an integration test that:
1. Creates a temp directory
2. Writes a `.workpipe` file
3. Runs `workpipe build`
4. Verifies `.github/workflows/*.yml` was created with correct content

```typescript
// packages/cli/src/__tests__/build.integration.test.ts

import { buildAction } from "../commands/build";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("build command integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "workpipe-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("compiles workpipe file to yaml", async () => {
    const inputPath = join(tempDir, "test.workpipe");
    await writeFile(inputPath, `
      workflow test {
        on: push
        job hello {
          runs_on: ubuntu-latest
          steps: [run("echo hello")]
        }
      }
    `);

    const outputDir = join(tempDir, ".github/workflows");
    const exitCode = await buildAction([inputPath], {
      output: outputDir,
      watch: false,
      dryRun: false,
      verbose: false,
    });

    expect(exitCode).toBe(0);

    const outputPath = join(outputDir, "test.yml");
    const yaml = await readFile(outputPath, "utf-8");
    expect(yaml).toContain("name: test");
    expect(yaml).toContain("on: push");
  });
});
```

## Notes

- This is the last piece to make WorkPipe usable end-to-end
- Keep error messages user-friendly with file paths
- Consider adding a `--check` mode to build command (validate without write) as shortcut to `workpipe check`
- Future: add source maps or comments indicating generated file origin
