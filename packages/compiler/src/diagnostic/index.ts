export type {
  DiagnosticSeverity,
  Diagnostic,
  CompileResult,
  Span,
} from "./types.js";

export { SourceMap, type Position } from "./source-map.js";

export {
  createDiagnostic,
  parseError,
  semanticError,
  warning,
  info,
} from "./builder.js";

export {
  formatDiagnostic,
  formatDiagnostics,
  countDiagnostics,
  formatSummary,
  type DiagnosticCounts,
} from "./formatter.js";
