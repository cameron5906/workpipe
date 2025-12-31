import type { Diagnostic, DiagnosticSeverity, Span } from "./types.js";

export function createDiagnostic(
  code: string,
  message: string,
  span: Span,
  severity: DiagnosticSeverity = "error",
  hint?: string
): Diagnostic {
  return {
    code,
    severity,
    message,
    span,
    hint,
  };
}

export function parseError(
  code: string,
  message: string,
  span: Span,
  hint?: string
): Diagnostic {
  return createDiagnostic(code, message, span, "error", hint);
}

export function semanticError(
  code: string,
  message: string,
  span: Span,
  hint?: string
): Diagnostic {
  return createDiagnostic(code, message, span, "error", hint);
}

export function warning(
  code: string,
  message: string,
  span: Span,
  hint?: string
): Diagnostic {
  return createDiagnostic(code, message, span, "warning", hint);
}

export function info(
  code: string,
  message: string,
  span: Span,
  hint?: string
): Diagnostic {
  return createDiagnostic(code, message, span, "info", hint);
}
