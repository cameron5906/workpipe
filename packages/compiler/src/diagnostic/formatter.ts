import type { Diagnostic } from "./types.js";
import { SourceMap } from "./source-map.js";

const ANSI_RESET = "\x1b[0m";
const ANSI_RED = "\x1b[31m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_BOLD = "\x1b[1m";
const ANSI_DIM = "\x1b[2m";

function severityColor(severity: "error" | "warning" | "info"): string {
  switch (severity) {
    case "error":
      return ANSI_RED;
    case "warning":
      return ANSI_YELLOW;
    case "info":
      return ANSI_CYAN;
  }
}

export function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  filename: string,
  useColor: boolean = true
): string {
  const sourceMap = new SourceMap(source);
  const startPos = sourceMap.positionAt(diagnostic.span.start);
  const endPos = sourceMap.positionAt(diagnostic.span.end);

  const lines: string[] = [];

  const severityText = diagnostic.severity;
  const header = useColor
    ? `${ANSI_BOLD}${filename}:${startPos.line}:${startPos.column}${ANSI_RESET}: ${severityColor(diagnostic.severity)}${severityText}[${diagnostic.code}]${ANSI_RESET}: ${diagnostic.message}`
    : `${filename}:${startPos.line}:${startPos.column}: ${severityText}[${diagnostic.code}]: ${diagnostic.message}`;

  lines.push(header);

  const sourceLine = sourceMap.getLine(startPos.line);
  if (sourceLine) {
    const lineNumWidth = String(startPos.line).length;
    const padding = " ".repeat(lineNumWidth);

    const linePrefix = useColor
      ? `${ANSI_DIM}${padding} |${ANSI_RESET}`
      : `${padding} |`;

    const sourcePrefix = useColor
      ? `${ANSI_DIM}${startPos.line} |${ANSI_RESET}`
      : `${startPos.line} |`;

    lines.push(linePrefix);
    lines.push(`${sourcePrefix} ${sourceLine}`);

    const underlineStart = startPos.column - 1;
    let underlineLength: number;
    if (startPos.line === endPos.line) {
      underlineLength = Math.max(1, endPos.column - startPos.column);
    } else {
      underlineLength = Math.max(1, sourceLine.length - underlineStart);
    }

    const spaces = " ".repeat(underlineStart);
    const carets = "^".repeat(underlineLength);

    const underline = useColor
      ? `${linePrefix} ${spaces}${severityColor(diagnostic.severity)}${carets}${ANSI_RESET}`
      : `${linePrefix} ${spaces}${carets}`;

    lines.push(underline);
  }

  if (diagnostic.hint) {
    const hintPrefix = useColor ? `${ANSI_CYAN}hint${ANSI_RESET}:` : "hint:";
    lines.push(`${hintPrefix} ${diagnostic.hint}`);
  }

  return lines.join("\n");
}

export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  source: string,
  filename: string,
  useColor: boolean = true
): string {
  return diagnostics
    .map((d) => formatDiagnostic(d, source, filename, useColor))
    .join("\n\n");
}

export interface DiagnosticCounts {
  errors: number;
  warnings: number;
  infos: number;
}

export function countDiagnostics(
  diagnostics: readonly Diagnostic[]
): DiagnosticCounts {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const d of diagnostics) {
    switch (d.severity) {
      case "error":
        errors++;
        break;
      case "warning":
        warnings++;
        break;
      case "info":
        infos++;
        break;
    }
  }

  return { errors, warnings, infos };
}

export function formatSummary(
  counts: DiagnosticCounts,
  useColor: boolean = true
): string {
  const parts: string[] = [];

  if (counts.errors > 0) {
    const text = `${counts.errors} error${counts.errors === 1 ? "" : "s"}`;
    parts.push(useColor ? `${ANSI_RED}${text}${ANSI_RESET}` : text);
  }

  if (counts.warnings > 0) {
    const text = `${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`;
    parts.push(useColor ? `${ANSI_YELLOW}${text}${ANSI_RESET}` : text);
  }

  if (counts.infos > 0) {
    const text = `${counts.infos} info${counts.infos === 1 ? "" : "s"}`;
    parts.push(useColor ? `${ANSI_CYAN}${text}${ANSI_RESET}` : text);
  }

  if (parts.length === 0) {
    return "no issues found";
  }

  return parts.join(", ");
}
