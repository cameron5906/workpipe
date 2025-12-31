# Implement Diagnostic System with Span Tracking

**ID**: WI-044
**Status**: Completed
**Priority**: P1-High
**Milestone**: A++ (Production quality)
**Phase**: 3 (Types + Outputs)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30
**Consolidates**: WI-006, WI-015

## Description

Implement a comprehensive diagnostic system that provides structured error reporting with source location tracking. This consolidates the work previously split between WI-006 (span tracking) and WI-015 (diagnostics framework) into a single coherent deliverable.

Good diagnostics are critical infrastructure:
- Makes debugging easier for users
- Enables IDE integration (VS Code extension)
- Provides actionable error messages
- Required foundation before implementing complex features (cycles)

## Acceptance Criteria

### Phase 1: Diagnostic Foundation
- [x] `Diagnostic` type defined with:
  - [x] `code` - stable error code (e.g., WP0001)
  - [x] `severity` - error | warning | info
  - [x] `message` - human-readable description
  - [x] `span` - source location (start, end offsets)
  - [x] `file` - optional file path
  - [x] `hint` - optional suggestion for fix
- [x] Error code registry with categories:
  - [x] WP0xxx - Parse errors
  - [x] WP1xxx - Semantic errors (type, reference)
  - [x] WP2xxx - Codegen errors
  - [x] WP3xxx - Warnings
- [x] `CompileResult<T>` discriminated union:
  - [x] `{ ok: true, value: T, diagnostics: Diagnostic[] }`
  - [x] `{ ok: false, diagnostics: Diagnostic[] }`
- [x] Span-to-line/column mapping utility (SourceMap class)
- [x] Diagnostic formatting utilities with color support

### Phase 2: Integration
- [x] Refactor `compile()` to return `CompileResult<string>`
- [x] Backward compatibility via `compileToYaml()` function
- [x] Parser errors converted to diagnostics with spans
- [x] Transform/emit errors converted to diagnostics
- [x] CLI updated to format and display diagnostics
- [x] Check command shows all diagnostics before exit
- [x] Build command shows diagnostics on failure
- [x] Added `--no-color` option to CLI commands

### Phase 3: Testing & Documentation
- [x] Unit tests for diagnostic types and utilities (45 tests)
- [x] Integration tests for error scenarios
- [x] ADR-0006 documenting diagnostic system design
- [x] Update ARCHITECTURE.md with diagnostics section

## Technical Context

### Error Code Categories

| Range | Category | Examples |
|-------|----------|----------|
| WP1000-1999 | Parse | Syntax error, unexpected token, unclosed brace |
| WP2000-2999 | Semantic | Unknown job reference, type mismatch, missing required field |
| WP3000-3999 | Codegen | Invalid YAML output, unsupported feature |
| WP4000-4999 | Warning | Unused job, deprecated syntax |

### Diagnostic Type Definition

```typescript
// packages/compiler/src/diagnostic/types.ts

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface SourceLocation {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
}

export interface Diagnostic {
  readonly code: string;           // e.g., "WP1001"
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly file?: string;
  readonly hint?: string;
}

export type CompileResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };
```

### Span to Line/Column Mapping

```typescript
// packages/compiler/src/diagnostic/source-map.ts

export interface SourceMap {
  readonly source: string;
  readonly lineStarts: readonly number[];
}

export function createSourceMap(source: string): SourceMap {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }
  return { source, lineStarts };
}

export function offsetToLocation(map: SourceMap, offset: number): SourceLocation {
  let line = 0;
  for (let i = 1; i < map.lineStarts.length; i++) {
    if (map.lineStarts[i] > offset) break;
    line = i;
  }
  const column = offset - map.lineStarts[line];
  return { offset, line: line + 1, column: column + 1 }; // 1-based
}
```

### Diagnostic Formatting

```typescript
// packages/compiler/src/diagnostic/format.ts

export function formatDiagnostic(diagnostic: Diagnostic, source?: string): string {
  const { code, severity, message, span, file, hint } = diagnostic;
  const location = file
    ? `${file}:${span.start.line}:${span.start.column}`
    : `${span.start.line}:${span.start.column}`;

  let output = `${severity}: ${message} [${code}]\n`;
  output += `  --> ${location}\n`;

  if (source) {
    // Show source context with caret
    const lines = source.split("\n");
    const lineText = lines[span.start.line - 1] || "";
    output += `   |\n`;
    output += `${span.start.line.toString().padStart(3)} | ${lineText}\n`;
    output += `   | ${" ".repeat(span.start.column - 1)}^\n`;
  }

  if (hint) {
    output += `  = hint: ${hint}\n`;
  }

  return output;
}
```

### Refactored compile() Function

```typescript
// packages/compiler/src/index.ts

export function compile(source: string, file?: string): CompileResult<string> {
  const sourceMap = createSourceMap(source);
  const diagnostics: Diagnostic[] = [];

  // Parse
  const tree = parse(source);
  if (hasErrors(tree)) {
    const errors = getErrors(source);
    for (const error of errors) {
      diagnostics.push({
        code: "WP1001",
        severity: "error",
        message: error.message,
        span: offsetsToSpan(sourceMap, error.from, error.to),
        file,
      });
    }
    return { ok: false, diagnostics };
  }

  // Build AST
  const workflows = buildAST(source);
  if (workflows.length === 0) {
    diagnostics.push({
      code: "WP2001",
      severity: "error",
      message: "No workflow found in source",
      span: offsetsToSpan(sourceMap, 0, source.length),
      file,
    });
    return { ok: false, diagnostics };
  }

  // Transform and emit
  try {
    const ir = transform(workflows[0]);
    const yaml = emit(ir);
    return { ok: true, value: yaml, diagnostics };
  } catch (error) {
    diagnostics.push({
      code: "WP3001",
      severity: "error",
      message: error.message,
      span: offsetsToSpan(sourceMap, 0, 0),
      file,
    });
    return { ok: false, diagnostics };
  }
}
```

### CLI Integration

```typescript
// packages/cli/src/commands/build.ts

import { compile, formatDiagnostic } from "@workpipe/compiler";

const result = compile(source, file);

for (const diagnostic of result.diagnostics) {
  const formatted = formatDiagnostic(diagnostic, source);
  if (diagnostic.severity === "error") {
    console.error(formatted);
  } else {
    console.warn(formatted);
  }
}

if (!result.ok) {
  return EXIT_VALIDATION_FAILURE;
}

// Write result.value to output file
```

## Dependencies

- WI-005: AST transformation (complete) - spans already exist on AST nodes
- WI-004: Lezer grammar (complete) - parser provides error positions
- WI-042: CLI build command (complete) - will be refactored
- WI-043: CLI check command (complete) - will be refactored

## Files to Create

- `packages/compiler/src/diagnostic/types.ts` - Core types
- `packages/compiler/src/diagnostic/source-map.ts` - Span utilities
- `packages/compiler/src/diagnostic/format.ts` - Formatting utilities
- `packages/compiler/src/diagnostic/codes.ts` - Error code registry
- `packages/compiler/src/diagnostic/index.ts` - Barrel export
- `docs/adr/ADR-0006-diagnostic-system.md` - Architecture decision record

## Files to Modify

- `packages/compiler/src/index.ts` - Refactor compile()
- `packages/cli/src/commands/build.ts` - Use CompileResult
- `packages/cli/src/commands/check.ts` - Use CompileResult
- `ARCHITECTURE.md` - Add diagnostics section

## Example Output

```
error: Unexpected token, expected '}' [WP1001]
  --> examples/broken.workpipe:5:3
   |
 5 |   job build
   |   ^
  = hint: Did you forget to close the workflow block?

error: Unknown job 'deploy' referenced in needs [WP2002]
  --> examples/broken.workpipe:12:11
   |
12 |     needs: [deploy]
   |            ^
  = hint: Available jobs: build, test
```

## Success Metrics

- All existing tests continue to pass
- New diagnostic tests pass
- Error messages include file:line:column
- Error messages include stable error codes
- CLI output is human-readable and actionable

## Notes

- Error codes must be stable (don't renumber)
- Consider adding URL to documentation for each error code (future)
- Warnings should not cause non-zero exit by default
- Consider `--max-errors` flag to limit output (future)
- This unblocks VS Code extension work (Milestone E)
