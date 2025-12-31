# Wire CLI Check Command to Compiler

**ID**: WI-043
**Status**: Completed
**Priority**: P1-High
**Milestone**: A+ (Post vertical slice polish)
**Phase**: 3 (Types + Outputs)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Connect the `workpipe check` CLI command to validate WorkPipe files without generating output. This command is essential for CI/CD integration and pre-commit hooks where users want to verify correctness without side effects.

The check command should:
- Parse and validate syntax
- Build AST and check for structural issues
- Report errors with file locations
- Exit with code 2 on validation failures (per CLI contract)

## Acceptance Criteria

- [x] `workpipe check` reads `.workpipe` files from disk
- [x] `workpipe check` parses files and builds AST
- [x] Syntax errors reported with file path
- [x] `--verbose` shows files being checked
- [x] Exit code 0 on success, 2 on validation failures, 1 on errors
- [x] Multiple files checked, all errors reported before exit
- [x] Unit tests for check command behavior

## Technical Context

### Current State

The CLI check command exists at `packages/cli/src/commands/check.ts` with:
- File resolution via glob patterns
- Options parsing (-v, --verbose)
- Stub implementation with TODO comments

```typescript
// Current stub code (line 40-42):
// TODO: Invoke compiler validation API once available
// For now, stub with success
console.log(`[stub] Checked: ${file}`);
```

### Validation Approach

For now, validation means "can parse and build AST without errors":

```typescript
import { compile, buildAST } from "@workpipe/compiler";
import { hasErrors, getErrors } from "@workpipe/lang";

// Option 1: Use buildAST directly
const workflows = buildAST(source);
// Check if AST was built (no workflow = parse error)

// Option 2: Use parser error detection
import { parse, hasErrors } from "@workpipe/lang";
const tree = parse(source);
if (hasErrors(tree)) {
  // Report errors
}
```

### Implementation

```typescript
import { readFile } from "fs/promises";
import { buildAST } from "@workpipe/compiler";
import { parse, hasErrors, getErrors } from "@workpipe/lang";

export async function checkAction(
  files: string[],
  options: CheckOptions
): Promise<number> {
  const resolvedFiles = await resolveFiles(files);

  if (resolvedFiles.length === 0) {
    console.error("No WorkPipe files found");
    return EXIT_ERROR;
  }

  let hasValidationErrors = false;

  for (const file of resolvedFiles) {
    log(`Checking: ${file}`, options.verbose);

    try {
      const source = await readFile(file, "utf-8");
      const tree = parse(source);

      if (hasErrors(tree)) {
        hasValidationErrors = true;
        const errors = getErrors(source);
        for (const error of errors) {
          console.error(`${file}: ${error.message}`);
        }
      } else {
        // Also try building AST to catch structural issues
        const workflows = buildAST(source);
        if (workflows.length === 0) {
          hasValidationErrors = true;
          console.error(`${file}: No workflow found`);
        } else {
          log(`${file}: OK`, options.verbose);
        }
      }
    } catch (error) {
      hasValidationErrors = true;
      console.error(`${file}: ${error.message}`);
    }
  }

  return hasValidationErrors ? EXIT_VALIDATION_FAILURE : EXIT_SUCCESS;
}
```

### Exit Codes (from ADR-0002)

- `0` (EXIT_SUCCESS): All files validated successfully
- `1` (EXIT_ERROR): System error (file not found, permission denied)
- `2` (EXIT_VALIDATION_FAILURE): One or more files have validation errors

## Dependencies

- WI-042: CLI build command (complete) - pattern to follow
- WI-004: Lezer grammar (complete) - provides parser error detection
- WI-005: AST builder (complete) - provides structural validation

## Files to Modify

- `packages/cli/src/commands/check.ts` - Main implementation
- `packages/cli/src/commands/__tests__/check.test.ts` - Unit tests (create)

## Testing

```typescript
describe("check command", () => {
  it("returns success for valid file", async () => {
    // Write valid .workpipe file
    // Run check
    // Expect EXIT_SUCCESS
  });

  it("returns validation failure for syntax error", async () => {
    // Write invalid .workpipe file
    // Run check
    // Expect EXIT_VALIDATION_FAILURE
  });

  it("reports all errors before exiting", async () => {
    // Write multiple invalid files
    // Run check
    // Expect all errors reported
  });
});
```

## Notes

- The check command is critical for CI integration
- Should be fast - no file writing overhead
- Consider caching parsed results for future watch mode
- Error messages should include file:line:column when diagnostics are improved (WI-006)
- This is simpler than build since no output writing is needed
