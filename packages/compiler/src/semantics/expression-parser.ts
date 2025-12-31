import type { ExpressionNode, Span } from "../ast/types.js";

export interface ParsedInterpolation {
  expression: ExpressionNode;
  span: Span;
  rawText: string;
}

const INTERPOLATION_PATTERN = /\$\{\{\s*(.*?)\s*\}\}/g;

export function extractInterpolations(
  text: string,
  baseSpan: Span
): ParsedInterpolation[] {
  const results: ParsedInterpolation[] = [];
  let match: RegExpExecArray | null;

  INTERPOLATION_PATTERN.lastIndex = 0;
  while ((match = INTERPOLATION_PATTERN.exec(text)) !== null) {
    const rawText = match[0];
    const exprText = match[1];
    const matchStart = baseSpan.start + match.index;
    const matchEnd = matchStart + rawText.length;

    const expr = parseExpression(exprText, { start: matchStart, end: matchEnd });
    if (expr) {
      results.push({
        expression: expr,
        span: { start: matchStart, end: matchEnd },
        rawText,
      });
    }
  }

  return results;
}

function parseExpression(text: string, span: Span): ExpressionNode | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const comparison = tryParseComparison(trimmed, span);
  if (comparison) {
    return comparison;
  }

  const arithmetic = tryParseArithmetic(trimmed, span);
  if (arithmetic) {
    return arithmetic;
  }

  return parsePrimaryExpression(trimmed, span);
}

function tryParseComparison(text: string, span: Span): ExpressionNode | null {
  const operators = ["==", "!=", "<=", ">=", "<", ">"];

  for (const op of operators) {
    const index = findOperatorIndex(text, op);
    if (index !== -1) {
      const leftText = text.substring(0, index).trim();
      const rightText = text.substring(index + op.length).trim();

      const left = parsePrimaryExpression(leftText, span);
      const right = parsePrimaryExpression(rightText, span);

      if (left && right) {
        return {
          kind: "binary",
          operator: op as "==" | "!=" | "<" | ">" | "<=" | ">=",
          left,
          right,
          span,
        };
      }
    }
  }

  return null;
}

function tryParseArithmetic(text: string, span: Span): ExpressionNode | null {
  const operators = ["+", "-", "*", "/"];

  for (const op of operators) {
    const index = findOperatorIndex(text, op);
    if (index !== -1) {
      const leftText = text.substring(0, index).trim();
      const rightText = text.substring(index + op.length).trim();

      const left = parsePrimaryExpression(leftText, span);
      const right = parsePrimaryExpression(rightText, span);

      if (left && right) {
        return {
          kind: "binary",
          operator: op as "+" | "-" | "*" | "/",
          left,
          right,
          span,
        };
      }
    }
  }

  return null;
}

function findOperatorIndex(text: string, op: string): number {
  let parenDepth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === stringChar && text[i - 1] !== "\\") {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === "(") {
      parenDepth++;
      continue;
    }

    if (char === ")") {
      parenDepth--;
      continue;
    }

    if (parenDepth === 0 && text.substring(i, i + op.length) === op) {
      if (op.length === 1 && (op === "<" || op === ">")) {
        if (text[i + 1] === "=" || (op === "<" && text[i - 1] === "<") || (op === ">" && text[i - 1] === ">")) {
          continue;
        }
      }
      return i;
    }
  }

  return -1;
}

function parsePrimaryExpression(text: string, span: Span): ExpressionNode | null {
  const trimmed = text.trim();

  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return parseExpression(trimmed.substring(1, trimmed.length - 1), span);
  }

  if (trimmed === "true") {
    return { kind: "boolean", value: true, span };
  }

  if (trimmed === "false") {
    return { kind: "boolean", value: false, span };
  }

  const numericMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
  if (numericMatch) {
    const value = parseFloat(trimmed);
    const isFloat = trimmed.includes(".");
    return { kind: "number", value, isFloat, span };
  }

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    const value = trimmed.substring(1, trimmed.length - 1);
    return { kind: "string", value, span };
  }

  const propertyPath = parsePropertyPath(trimmed);
  if (propertyPath) {
    return { kind: "property", path: propertyPath, span };
  }

  return null;
}

function parsePropertyPath(text: string): readonly string[] | null {
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  const parts = text.split(".");

  if (parts.length === 0) {
    return null;
  }

  for (const part of parts) {
    if (!identifierPattern.test(part)) {
      return null;
    }
  }

  return parts;
}
