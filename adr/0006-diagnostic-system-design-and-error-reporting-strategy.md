# ADR-0006: Diagnostic System Design and Error Reporting Strategy

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WI-044 requires implementing a comprehensive diagnostic system for WorkPipe that provides meaningful, actionable error messages throughout the compilation pipeline. Good diagnostics are essential for developer experience, enabling users to quickly understand and fix issues in their `.workpipe` source files.

### Background

The WorkPipe compiler transforms source files through multiple stages (parse, AST build, semantic analysis, code generation). Each stage can produce errors, warnings, and informational messages. The diagnostic system must:

1. **Provide precise source locations**: Errors must point to the exact character range in the source file
2. **Support multiple diagnostics per file**: Users should see all errors at once, not just the first
3. **Enable continued compilation after non-fatal errors**: Parse one valid workflow even if another has errors
4. **Produce machine-readable output**: CI systems and editors need structured diagnostic data
5. **Produce human-readable output**: CLI users need formatted, colored output with source context

### Prior Decisions

- **ADR-0003**: Defined `Span` type for source locations: `{ start: number; end: number }`
- **ADR-0004**: Established exception-based error handling for Milestone A with plan to evolve to `CompileResult` type
- **ARCHITECTURE.md**: Documents error code ranges (WP1xxx-WP6xxx) and diagnostic structure

### Key Design Tensions

1. **Throwing vs. Collecting**: Should errors halt compilation immediately, or be collected for batch reporting?

2. **Span granularity**: Should spans point to tokens, expressions, or entire statements?

3. **Line/column computation**: Should line numbers be computed eagerly (at parse time) or lazily (at formatting time)?

4. **Error code stability**: How do we ensure error codes remain stable for documentation and tooling integration?

## Decision

### 1. Diagnostic Type Structure

**Decision**: Define a `Diagnostic` interface that captures all information needed for error reporting.

```typescript
// packages/compiler/src/diagnostics/types.ts

export interface Span {
  readonly start: number;  // 0-based byte offset
  readonly end: number;    // 0-based byte offset (exclusive)
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  readonly code: string;            // WPxxxx format
  readonly severity: DiagnosticSeverity;
  readonly message: string;         // Primary error message
  readonly span: Span;              // Location in source
  readonly hint?: string;           // Suggestion for fixing
  readonly relatedSpans?: readonly RelatedSpan[];
}

export interface RelatedSpan {
  readonly span: Span;
  readonly message: string;  // Explains why this location is related
}
```

**Key design choices**:

1. **Immutable (`readonly`)**: Diagnostics are data, not mutable state. Immutability prevents accidental modification.

2. **`code` as string**: The `WPxxxx` format is human-readable in output and stable for documentation. Numeric enums would require lookup for display.

3. **Optional `hint`**: Not all errors have obvious fixes. Hints are only provided when actionable.

4. **`relatedSpans` for multi-location errors**: Some errors involve multiple source locations (e.g., "duplicate job name 'build' first defined here").

**Rationale**:
- This structure mirrors established compiler diagnostic patterns (TypeScript, Rust, ESLint)
- All rendering decisions (colors, formatting) are deferred to the presentation layer
- The structure is JSON-serializable for machine consumption

### 2. Error Code Categories

**Decision**: Organize error codes into ranges by compilation phase and semantic category.

| Range | Category | Description |
|-------|----------|-------------|
| WP1xxx | Parse errors | Malformed syntax, unexpected tokens |
| WP2xxx | Semantic errors | Undefined references, type mismatches, duplicate declarations |
| WP3xxx | Codegen errors | Unsupported features, invalid output configurations |
| WP4xxx | Warnings | Unused variables, deprecated syntax, style issues |
| WP5xxx | Artifact errors | Invalid artifact names, missing artifact references |
| WP6xxx | Cycle errors | Invalid cycle configuration, termination issues |

**Initial error codes (Milestone A)**:

```typescript
// Parse errors (WP1xxx)
export const WP1001 = "WP1001";  // Unexpected token
export const WP1002 = "WP1002";  // Unterminated string
export const WP1003 = "WP1003";  // Invalid escape sequence
export const WP1004 = "WP1004";  // Missing closing brace
export const WP1005 = "WP1005";  // Missing closing bracket
export const WP1006 = "WP1006";  // Missing closing parenthesis
export const WP1007 = "WP1007";  // Expected identifier
export const WP1008 = "WP1008";  // Expected expression
export const WP1009 = "WP1009";  // Reserved keyword used as identifier

// Semantic errors (WP2xxx)
export const WP2001 = "WP2001";  // Undefined job reference
export const WP2002 = "WP2002";  // Undefined workflow reference
export const WP2003 = "WP2003";  // Duplicate job name
export const WP2004 = "WP2004";  // Duplicate workflow name
export const WP2005 = "WP2005";  // Circular job dependency
export const WP2006 = "WP2006";  // Type mismatch
export const WP2007 = "WP2007";  // Invalid output reference
export const WP2008 = "WP2008";  // Missing required property

// Codegen errors (WP3xxx)
export const WP3001 = "WP3001";  // Unsupported trigger type
export const WP3002 = "WP3002";  // Invalid runs_on value
export const WP3003 = "WP3003";  // Expression too complex for GHA

// Warnings (WP4xxx)
export const WP4001 = "WP4001";  // Missing cycle key (default derived)
export const WP4002 = "WP4002";  // Unused job
export const WP4003 = "WP4003";  // Unused variable
export const WP4004 = "WP4004";  // Deprecated syntax
export const WP4005 = "WP4005";  // Redundant needs clause

// Cycle errors (WP6xxx) - see ADR-0007
export const WP6001 = "WP6001";  // Cycle has no termination condition
export const WP6002 = "WP6002";  // Nested cycles not supported
export const WP6003 = "WP6003";  // Empty cycle body
export const WP6004 = "WP6004";  // Invalid max_iters value
```

**Code stability rules**:
- Once assigned, a code is never reused for a different error
- Deprecated codes are documented but not reassigned
- New codes are appended to their category range
- Codes are documented in a central registry file

**Rationale**:
- Numeric ranges enable quick categorization without parsing
- Stable codes enable documentation links, CI patterns, and IDE integrations
- Categories align with compiler phases for intuitive error understanding

### 3. CompileResult Pattern

**Decision**: Replace exception-based error handling with a discriminated union result type.

```typescript
// packages/compiler/src/diagnostics/result.ts

export type CompileResult<T> =
  | { readonly success: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly success: false; readonly diagnostics: readonly Diagnostic[] };
```

**Usage patterns**:

```typescript
// Successful compilation with warnings
const result: CompileResult<string> = {
  success: true,
  value: yamlOutput,
  diagnostics: [
    { code: "WP4001", severity: "warning", message: "Job 'test' is never used", span, hint: "Remove the job or add it to another job's needs" }
  ]
};

// Failed compilation with multiple errors
const result: CompileResult<string> = {
  success: false,
  diagnostics: [
    { code: "WP1001", severity: "error", message: "Unexpected token '}'", span },
    { code: "WP2001", severity: "error", message: "Undefined job 'build'", span }
  ]
};
```

**Helper functions**:

```typescript
export function success<T>(value: T, diagnostics: readonly Diagnostic[] = []): CompileResult<T> {
  return { success: true, value, diagnostics };
}

export function failure<T>(diagnostics: readonly Diagnostic[]): CompileResult<T> {
  return { success: false, diagnostics };
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(d => d.severity === "error");
}

export function partition(diagnostics: readonly Diagnostic[]): {
  errors: readonly Diagnostic[];
  warnings: readonly Diagnostic[];
  infos: readonly Diagnostic[];
} {
  return {
    errors: diagnostics.filter(d => d.severity === "error"),
    warnings: diagnostics.filter(d => d.severity === "warning"),
    infos: diagnostics.filter(d => d.severity === "info"),
  };
}
```

**Rationale**:
- Explicit result type forces callers to handle errors
- Warnings can accompany successful compilation
- Multiple diagnostics are naturally supported
- Type system ensures exhaustive handling
- Supersedes ADR-0004's exception-based approach for Milestone B+

### 4. Span-to-Line/Column Mapping

**Decision**: Compute line/column positions lazily from source text, caching line break positions for efficiency.

```typescript
// packages/compiler/src/diagnostics/source-map.ts

export interface Position {
  readonly line: number;    // 1-based
  readonly column: number;  // 1-based
}

export interface SourceLocation {
  readonly start: Position;
  readonly end: Position;
}

export class SourceMap {
  private readonly lineBreaks: readonly number[];

  constructor(private readonly source: string) {
    this.lineBreaks = this.computeLineBreaks();
  }

  private computeLineBreaks(): number[] {
    const breaks: number[] = [0];  // Line 1 starts at offset 0
    for (let i = 0; i < this.source.length; i++) {
      if (this.source[i] === "\n") {
        breaks.push(i + 1);
      }
    }
    return breaks;
  }

  positionAt(offset: number): Position {
    // Binary search for line
    let low = 0;
    let high = this.lineBreaks.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.lineBreaks[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    const line = low + 1;  // Convert to 1-based
    const column = offset - this.lineBreaks[low] + 1;  // Convert to 1-based
    return { line, column };
  }

  locationOf(span: Span): SourceLocation {
    return {
      start: this.positionAt(span.start),
      end: this.positionAt(span.end),
    };
  }

  getLineContent(line: number): string {
    const startOffset = this.lineBreaks[line - 1];
    const endOffset = this.lineBreaks[line] ?? this.source.length;
    return this.source.slice(startOffset, endOffset).replace(/\n$/, "");
  }
}
```

**Design choices**:

1. **1-based line/column**: Matches editor conventions (VS Code, GitHub) and user expectations

2. **Lazy computation via `SourceMap` class**: Line breaks are computed once when the SourceMap is created, then position lookups are O(log n)

3. **Binary search**: Efficient for large files with many lines

4. **`getLineContent` for context**: Enables source snippet display in error output

**Rationale**:
- Storing only byte offsets in Span keeps AST nodes small
- Line/column computation is deferred to formatting time
- Caching line breaks amortizes the cost across multiple diagnostics
- Binary search scales to large files without performance issues

### 5. CLI Output Formatting

**Decision**: Format diagnostics for terminal output with source context and color coding.

**Output format**:
```
file:line:column: severity[code]: message

   line_num | source line content
            | ^^^^ hint or underline

hint: suggestion text
```

**Example output**:
```
ci.workpipe:15:23: error[WP2001]: Undefined job 'build'

   15 | job deploy needs [build] {
      |                   ^^^^^ not found in this workflow

hint: Did you mean 'build_app'?
```

**Color scheme** (ANSI terminal colors):

| Element | Color | ANSI Code |
|---------|-------|-----------|
| `error` | Red | `\x1b[31m` |
| `warning` | Yellow | `\x1b[33m` |
| `info` | Cyan | `\x1b[36m` |
| Error code | Dim | `\x1b[2m` |
| Line number | Blue | `\x1b[34m` |
| Caret/underline | Error color | (matches severity) |

**Implementation**:

```typescript
// packages/cli/src/diagnostics/formatter.ts

export interface FormatOptions {
  readonly color: boolean;       // Enable ANSI colors
  readonly context: number;      // Lines of context (default: 1)
  readonly maxWidth: number;     // Terminal width for wrapping
}

export function formatDiagnostic(
  diagnostic: Diagnostic,
  sourceMap: SourceMap,
  filePath: string,
  options: FormatOptions
): string {
  const location = sourceMap.locationOf(diagnostic.span);
  const header = formatHeader(diagnostic, filePath, location, options.color);
  const snippet = formatSnippet(diagnostic, sourceMap, location, options);
  const hint = diagnostic.hint ? formatHint(diagnostic.hint, options.color) : "";

  return [header, snippet, hint].filter(Boolean).join("\n");
}

function formatHeader(
  diagnostic: Diagnostic,
  filePath: string,
  location: SourceLocation,
  color: boolean
): string {
  const pos = `${filePath}:${location.start.line}:${location.start.column}`;
  const sev = colorize(diagnostic.severity, getSeverityColor(diagnostic.severity), color);
  const code = colorize(`[${diagnostic.code}]`, "dim", color);
  return `${pos}: ${sev}${code}: ${diagnostic.message}`;
}
```

**Machine-readable format** (JSON lines):
```json
{"file":"ci.workpipe","line":15,"column":23,"severity":"error","code":"WP2001","message":"Undefined job 'build'"}
```

Enabled via `--format=json` CLI flag.

**Rationale**:
- Format matches `gcc`, `rustc`, and TypeScript conventions for familiarity
- Source snippets provide immediate context without opening the file
- Colors are optional for CI environments without TTY
- JSON format enables tooling integration

### 6. Collecting vs. Throwing: Error Accumulation Strategy

**Decision**: Collect diagnostics into an accumulator rather than throwing on first error.

```typescript
// packages/compiler/src/diagnostics/collector.ts

export class DiagnosticCollector {
  private readonly diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  error(code: string, message: string, span: Span, hint?: string): void {
    this.add({ code, severity: "error", message, span, hint });
  }

  warning(code: string, message: string, span: Span, hint?: string): void {
    this.add({ code, severity: "warning", message, span, hint });
  }

  info(code: string, message: string, span: Span): void {
    this.add({ code, severity: "info", message, span });
  }

  hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === "error");
  }

  getAll(): readonly Diagnostic[] {
    return this.diagnostics;
  }

  toResult<T>(value: T): CompileResult<T> {
    if (this.hasErrors()) {
      return failure(this.diagnostics);
    }
    return success(value, this.diagnostics);
  }
}
```

**Error recovery strategies by phase**:

| Phase | Recovery Strategy |
|-------|-------------------|
| Parse | Lezer's built-in error recovery; continue to next valid node |
| AST Build | Skip malformed subtrees; record error and continue |
| Name Binding | Record undefined references; use error placeholder in symbol table |
| Type Check | Record mismatches; infer `unknown` type to continue checking |
| Codegen | Skip jobs with errors; generate partial output if possible |

**Example: continuing after parse error**:

```typescript
function buildWorkflow(cursor: TreeCursor, collector: DiagnosticCollector): WorkflowNode | null {
  // Try to build the workflow
  const name = extractName(cursor);
  if (!name) {
    collector.error("WP1007", "Expected workflow name", getSpan(cursor));
    // Continue parsing - we can still process jobs
  }

  const jobs = buildJobs(cursor, collector);  // May add more errors

  if (!name) return null;  // Can't emit without a name

  return { kind: "workflow", name, jobs, span: getSpan(cursor) };
}
```

**Rationale**:
- **Better UX**: Users see all errors at once, reducing fix-recompile cycles
- **IDE compatibility**: Language servers need all diagnostics for display
- **Partial results**: Even with errors, valid parts can be analyzed (for editor features)
- **Deterministic**: Same input always produces same diagnostics in same order

### 7. Diagnostic Ordering and Deduplication

**Decision**: Report diagnostics in source order with optional deduplication.

**Ordering rules**:
1. Primary sort: By file path (alphabetical)
2. Secondary sort: By span start offset (ascending)
3. Tertiary sort: By severity (error > warning > info)

**Deduplication**: Same code + same span = duplicate (keep first occurrence)

```typescript
export function sortDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    // By span start
    if (a.span.start !== b.span.start) {
      return a.span.start - b.span.start;
    }
    // By severity (errors first)
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function deduplicateDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter(d => {
    const key = `${d.code}:${d.span.start}:${d.span.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

**Rationale**:
- Source order helps users read errors from top to bottom
- Errors before warnings prioritizes blocking issues
- Deduplication prevents noise from cascading errors

### 8. Module Organization

**Decision**: Organize diagnostic code into a dedicated subpackage within `@workpipe/compiler`.

```
packages/compiler/src/diagnostics/
  index.ts          # Public exports
  types.ts          # Diagnostic, Span, Severity types
  codes.ts          # Error code constants and registry
  result.ts         # CompileResult type and helpers
  collector.ts      # DiagnosticCollector class
  source-map.ts     # SourceMap for line/column mapping

packages/cli/src/diagnostics/
  formatter.ts      # CLI output formatting
  colors.ts         # ANSI color utilities
```

**Export strategy**:
```typescript
// packages/compiler/src/diagnostics/index.ts
export type { Diagnostic, DiagnosticSeverity, Span, RelatedSpan } from "./types.js";
export type { CompileResult } from "./result.js";
export { success, failure, hasErrors, partition } from "./result.js";
export { DiagnosticCollector } from "./collector.js";
export { SourceMap } from "./source-map.js";
export * as codes from "./codes.js";
```

**Rationale**:
- Separation of compiler diagnostics (data) from CLI formatting (presentation)
- `codes.ts` as central registry for documentation and lookup
- Clean public API via `index.ts` exports

## Alternatives Considered

### Alternative 1: Numeric Error Codes Instead of String Format

**Approach**: Use numeric enums for error codes.

```typescript
enum ErrorCode {
  UnexpectedToken = 1001,
  UnterminatedString = 1002,
  // ...
}
```

**Pros**:
- Type-safe code references
- Smaller serialized size
- Switch statement exhaustiveness checking

**Cons**:
- Requires lookup table for display (`ErrorCode[code]`)
- Less readable in output: `error[1001]` vs `error[WP1001]`
- Harder to grep/search documentation
- Enum maintenance burden

**Decision**: Rejected. String format (`WPxxxx`) is self-documenting in output and easier to reference in documentation.

### Alternative 2: Eager Line/Column Computation in Span

**Approach**: Store line/column directly in Span type.

```typescript
interface Span {
  start: { offset: number; line: number; column: number };
  end: { offset: number; line: number; column: number };
}
```

**Pros**:
- Line/column always available
- No lazy computation needed
- Simpler SourceMap (not needed)

**Cons**:
- Larger AST nodes (3x span size)
- Line/column computed even when not displayed
- Must pass source text through all parsing stages
- Wasted computation if output is machine-readable (uses offsets)

**Decision**: Rejected. Lazy computation saves memory and allows deferred work.

### Alternative 3: Throw on First Error (Status Quo)

**Approach**: Keep ADR-0004's exception-based approach.

```typescript
export function compile(source: string): string {
  // Throws on first error
}
```

**Pros**:
- Simpler implementation
- Clear fail-fast semantics
- No accumulator state management

**Cons**:
- User sees one error at a time
- Multiple recompilations needed to find all errors
- Poor IDE/language server experience
- Can't return warnings with successful compilation

**Decision**: Rejected (supersedes ADR-0004 Section 9). Collecting diagnostics provides significantly better UX.

### Alternative 4: Source Context in Diagnostic (Not Formatter)

**Approach**: Include source snippet directly in Diagnostic type.

```typescript
interface Diagnostic {
  // ...
  sourceContext: string;  // The relevant source lines
}
```

**Pros**:
- Diagnostic is self-contained for display
- No need to pass SourceMap to formatter

**Cons**:
- Bloats Diagnostic size
- Duplicates source text (already in memory)
- Context window is presentation concern
- Makes JSON output unnecessarily large

**Decision**: Rejected. Source context is a formatting concern, retrieved from SourceMap at display time.

### Alternative 5: Single Diagnostic Type with Optional Fields

**Approach**: Use a flat type with many optional fields.

```typescript
interface Diagnostic {
  code: string;
  severity: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  // ...
}
```

**Pros**:
- Direct mapping to JSON output
- No nested types

**Cons**:
- Mixed concerns (source location embedded)
- File not known at diagnostic creation time (added by CLI)
- Optional fields make validation complex
- Can't compose with other location systems

**Decision**: Rejected. Separating `Span` from file path allows the compiler to work with byte offsets while CLI adds file context.

## Consequences

### Positive

1. **Comprehensive error reporting**: Users see all errors and warnings at once, reducing fix-recompile cycles

2. **Precise source locations**: Span-based errors point to exact character ranges, enabling IDE integration

3. **Stable error codes**: The WPxxxx format provides stable identifiers for documentation, CI patterns, and editor plugins

4. **Flexible output**: Same diagnostic data can be formatted for terminals (with colors) or machines (JSON)

5. **Type-safe result handling**: `CompileResult<T>` forces callers to handle both success and failure cases

6. **Efficient line mapping**: Lazy computation with cached line breaks scales to large files

7. **IDE-ready architecture**: Collecting diagnostics enables language server protocol integration

### Negative

1. **Complexity increase**: Diagnostic collection adds state management compared to simple throws

2. **Memory overhead**: Accumulating diagnostics requires storing all errors until compilation completes

3. **Recovery complexity**: Each compiler phase needs error recovery logic to continue after errors

4. **API change**: Existing code using exception-based `compile()` must migrate to `CompileResult`

### Neutral

1. **1-based vs 0-based**: Line/column are 1-based (matching editors) while offsets are 0-based (matching string indexing)

2. **Color dependency**: CLI output quality depends on terminal color support

3. **Supersedes ADR-0004 Section 9**: Exception-based error handling is replaced by result type

## References

- ADR-0003: Span type definition (`{ start: number; end: number }`)
- ADR-0004 Section 9: Exception-based error handling (superseded by this ADR)
- ADR-0007: Cycle syntax and guard block design (defines WP6xxx cycle errors)
- ARCHITECTURE.md: Error code ranges documentation
- [TypeScript Diagnostic Interface](https://github.com/microsoft/TypeScript/blob/main/src/compiler/types.ts)
- [Rust Compiler Error Index](https://doc.rust-lang.org/error_codes/error-index.html)
- [ESLint Rule Metadata](https://eslint.org/docs/latest/extend/custom-rules#rule-structure)
- [Language Server Protocol Diagnostics](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic)

---

**Supersedes**: ADR-0004 Section 9 (Exception-Based Error Handling)
