import type { Span } from "../ast/types.js";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: Span;
  readonly hint?: string;
  readonly relatedSpans?: readonly Span[];
}

export type CompileResult<T> =
  | { readonly success: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly success: false; readonly diagnostics: readonly Diagnostic[] };

export type { Span };
