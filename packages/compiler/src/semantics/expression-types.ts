import type {
  ExpressionNode,
  OutputType,
  OutputDeclaration,
  Span,
  TypeDeclarationNode,
  TypeFieldNode,
  TypeExpressionNode,
} from "../ast/types.js";
import { semanticError, warning, type Diagnostic } from "../diagnostic/index.js";
import type { TypeRegistry } from "./type-registry.js";

export type InferredType = OutputType | "unknown";

export interface TypeContext {
  readonly jobOutputs: Map<string, Map<string, OutputDeclaration>>;
  readonly typeRegistry?: TypeRegistry;
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

const PRIMITIVE_OUTPUT_TYPES: ReadonlySet<string> = new Set([
  "string", "int", "float", "bool", "json", "path"
]);

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

    if (PRIMITIVE_OUTPUT_TYPES.has(outputDecl.type)) {
      return outputDecl.type as OutputType;
    }
    return "unknown";
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

  if (expr.kind === "property") {
    diagnostics.push(...checkPropertyAccess(expr.path, expr.span, context));
  }

  return diagnostics;
}

interface ResolvedTypeInfo {
  readonly fields: readonly TypeFieldNode[];
  readonly typeName: string;
}

function getFieldsFromTypeExpression(
  typeExpr: TypeExpressionNode,
  registry: TypeRegistry
): ResolvedTypeInfo | null {
  switch (typeExpr.kind) {
    case "type_reference": {
      const typeDecl = registry.resolve(typeExpr.name);
      if (typeDecl) {
        return { fields: typeDecl.fields, typeName: typeExpr.name };
      }
      return null;
    }
    case "object_type":
      return { fields: typeExpr.fields, typeName: "inline object" };
    case "array_type":
      return getFieldsFromTypeExpression(typeExpr.elementType, registry);
    default:
      return null;
  }
}

function findFieldInType(
  fieldName: string,
  typeInfo: ResolvedTypeInfo
): TypeFieldNode | null {
  for (const field of typeInfo.fields) {
    if (field.name === fieldName) {
      return field;
    }
  }
  return null;
}

function getAvailablePropertyNames(typeInfo: ResolvedTypeInfo): string[] {
  return typeInfo.fields.map((f) => f.name);
}

export function checkPropertyAccess(
  path: readonly string[],
  span: Span,
  context: TypeContext
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!context.typeRegistry) {
    return diagnostics;
  }

  if (path.length < 5 || path[0] !== "needs" || path[2] !== "outputs") {
    return diagnostics;
  }

  const jobName = path[1];
  const outputName = path[3];
  const propertyPath = path.slice(4);

  if (propertyPath.length === 0) {
    return diagnostics;
  }

  const jobOutputs = context.jobOutputs.get(jobName);
  if (!jobOutputs) {
    return diagnostics;
  }

  const outputDecl = jobOutputs.get(outputName);
  if (!outputDecl) {
    return diagnostics;
  }

  if (!outputDecl.typeReference) {
    return diagnostics;
  }

  const typeDecl = context.typeRegistry.resolve(outputDecl.typeReference);
  if (!typeDecl) {
    return diagnostics;
  }

  let currentTypeInfo: ResolvedTypeInfo = {
    fields: typeDecl.fields,
    typeName: outputDecl.typeReference,
  };

  for (let i = 0; i < propertyPath.length; i++) {
    const propName = propertyPath[i];
    const field = findFieldInType(propName, currentTypeInfo);

    if (!field) {
      const availableProps = getAvailablePropertyNames(currentTypeInfo);
      const hint =
        availableProps.length > 0
          ? `Available properties: ${availableProps.join(", ")}`
          : `Type '${currentTypeInfo.typeName}' has no accessible properties`;

      diagnostics.push(
        semanticError(
          "WP5003",
          `Property '${propName}' does not exist on type '${currentTypeInfo.typeName}'`,
          span,
          hint
        )
      );
      return diagnostics;
    }

    if (i < propertyPath.length - 1) {
      const nextTypeInfo = getFieldsFromTypeExpression(
        field.type,
        context.typeRegistry
      );

      if (!nextTypeInfo) {
        return diagnostics;
      }

      currentTypeInfo = nextTypeInfo;
    }
  }

  return diagnostics;
}
