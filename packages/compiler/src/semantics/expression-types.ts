import type {
  ExpressionNode,
  OutputType,
  OutputDeclaration,
  Span,
} from "../ast/types.js";
import { semanticError, warning, type Diagnostic } from "../diagnostic/index.js";

export type InferredType = OutputType | "unknown";

export interface TypeContext {
  readonly jobOutputs: Map<string, Map<string, OutputDeclaration>>;
}

const NUMERIC_TYPES: ReadonlySet<OutputType> = new Set(["int", "float"]);
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(["==", "!=", "<", ">", "<=", ">="]);
const NUMERIC_COMPARISON_OPERATORS: ReadonlySet<string> = new Set(["<", ">", "<=", ">="]);
const ARITHMETIC_OPERATORS: ReadonlySet<string> = new Set(["+", "-", "*", "/"]);

export function inferExpressionType(
  expr: ExpressionNode,
  context: TypeContext
): InferredType {
  switch (expr.kind) {
    case "string":
      return "string";

    case "boolean":
      return "bool";

    case "number":
      return expr.isFloat ? "float" : "int";

    case "property":
      return inferPropertyAccessType(expr.path, context);

    case "binary":
      return inferBinaryExpressionType(expr, context);

    default:
      return "unknown";
  }
}

function inferPropertyAccessType(
  path: readonly string[],
  context: TypeContext
): InferredType {
  if (path.length >= 4 && path[0] === "needs" && path[2] === "outputs") {
    const jobName = path[1];
    const outputName = path[3];

    const jobOutputs = context.jobOutputs.get(jobName);
    if (!jobOutputs) {
      return "unknown";
    }

    const outputDecl = jobOutputs.get(outputName);
    if (!outputDecl) {
      return "unknown";
    }

    return outputDecl.type;
  }

  return "unknown";
}

function inferBinaryExpressionType(
  expr: ExpressionNode & { kind: "binary" },
  context: TypeContext
): InferredType {
  if (COMPARISON_OPERATORS.has(expr.operator)) {
    return "bool";
  }

  if (ARITHMETIC_OPERATORS.has(expr.operator)) {
    const leftType = inferExpressionType(expr.left, context);
    const rightType = inferExpressionType(expr.right, context);

    if (leftType === "float" || rightType === "float") {
      return "float";
    }
    if (leftType === "int" && rightType === "int") {
      return "int";
    }
    return "unknown";
  }

  return "unknown";
}

export function isNumericType(type: InferredType): boolean {
  return type === "int" || type === "float";
}

export function areTypesCompatible(left: InferredType, right: InferredType): boolean {
  if (left === "unknown" || right === "unknown") {
    return true;
  }

  if (left === right) {
    return true;
  }

  if (isNumericType(left) && isNumericType(right)) {
    return true;
  }

  return false;
}

export function checkComparisonTypes(
  expr: ExpressionNode & { kind: "binary" },
  context: TypeContext
): Diagnostic | null {
  if (!COMPARISON_OPERATORS.has(expr.operator)) {
    return null;
  }

  const leftType = inferExpressionType(expr.left, context);
  const rightType = inferExpressionType(expr.right, context);

  if (leftType === "unknown" || rightType === "unknown") {
    return null;
  }

  if (!areTypesCompatible(leftType, rightType)) {
    return semanticError(
      "WP2012",
      `Type mismatch in comparison: cannot compare '${leftType}' with '${rightType}'`,
      expr.span,
      `Ensure both sides of the '${expr.operator}' comparison have compatible types`
    );
  }

  if (NUMERIC_COMPARISON_OPERATORS.has(expr.operator)) {
    if (!isNumericType(leftType)) {
      return semanticError(
        "WP2012",
        `Type mismatch: operator '${expr.operator}' requires numeric types, but left side is '${leftType}'`,
        expr.span,
        `Use '==' or '!=' for non-numeric comparisons, or ensure the value is numeric`
      );
    }
    if (!isNumericType(rightType)) {
      return semanticError(
        "WP2012",
        `Type mismatch: operator '${expr.operator}' requires numeric types, but right side is '${rightType}'`,
        expr.span,
        `Use '==' or '!=' for non-numeric comparisons, or ensure the value is numeric`
      );
    }
  }

  return null;
}

export function checkNumericOperation(
  expr: ExpressionNode & { kind: "binary" },
  context: TypeContext
): Diagnostic | null {
  if (!ARITHMETIC_OPERATORS.has(expr.operator)) {
    return null;
  }

  const leftType = inferExpressionType(expr.left, context);
  const rightType = inferExpressionType(expr.right, context);

  if (leftType === "unknown" || rightType === "unknown") {
    return null;
  }

  if (!isNumericType(leftType)) {
    return warning(
      "WP2013",
      `Numeric operation on non-numeric type: left operand is '${leftType}'`,
      expr.span,
      `Arithmetic operator '${expr.operator}' expects numeric operands (int or float)`
    );
  }

  if (!isNumericType(rightType)) {
    return warning(
      "WP2013",
      `Numeric operation on non-numeric type: right operand is '${rightType}'`,
      expr.span,
      `Arithmetic operator '${expr.operator}' expects numeric operands (int or float)`
    );
  }

  return null;
}

export function checkExpressionTypes(
  expr: ExpressionNode,
  context: TypeContext
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (expr.kind === "binary") {
    const comparisonDiag = checkComparisonTypes(expr, context);
    if (comparisonDiag) {
      diagnostics.push(comparisonDiag);
    }

    const numericDiag = checkNumericOperation(expr, context);
    if (numericDiag) {
      diagnostics.push(numericDiag);
    }

    diagnostics.push(...checkExpressionTypes(expr.left, context));
    diagnostics.push(...checkExpressionTypes(expr.right, context));
  }

  return diagnostics;
}
