import { VERSION as LANG_VERSION, parse, hasErrors, getErrors } from "@workpipe/lang";
import { buildAST } from "./ast/index.js";
import type { WorkflowNode } from "./ast/index.js";
import { transform, emit } from "./codegen/index.js";
import { parseError, semanticError, type CompileResult, type Diagnostic } from "./diagnostic/index.js";
import { validateCycleTermination, validateRequiredFields, validateOutputs } from "./semantics/index.js";

export const VERSION = "0.0.1";
export { LANG_VERSION };

export * from "./ast/index.js";
export * from "./codegen/index.js";
export * from "./diagnostic/index.js";
export * from "./analysis/index.js";
export * from "./semantics/index.js";
export { format, type FormatOptions } from "./format/index.js";

function validateCycles(ast: WorkflowNode, diagnostics: Diagnostic[]): void {
  for (const cycle of ast.cycles) {
    if (cycle.maxIters === null && cycle.until === null) {
      diagnostics.push(
        semanticError(
          "WP6001",
          `Cycle '${cycle.name}' must have either 'max_iters' or 'until' specified`,
          cycle.span,
          "Add 'max_iters = N' or 'until guard_js \"\"\"...\"\"\"' to the cycle"
        )
      );
    }

    const terminationWarnings = validateCycleTermination(cycle);
    diagnostics.push(...terminationWarnings);
  }
}

export function compile(source: string): CompileResult<string> {
  const diagnostics: Diagnostic[] = [];

  const tree = parse(source);

  if (hasErrors(tree)) {
    const errors = getErrors(source);
    for (const error of errors) {
      diagnostics.push(
        parseError("WP0001", error.message, { start: error.from, end: error.to })
      );
    }
    return { success: false, diagnostics };
  }

  const ast = buildAST(tree, source);
  if (!ast) {
    diagnostics.push(
      parseError("WP0002", "Failed to build AST from parse tree", { start: 0, end: source.length })
    );
    return { success: false, diagnostics };
  }

  validateCycles(ast, diagnostics);
  diagnostics.push(...validateRequiredFields(ast));
  diagnostics.push(...validateOutputs(ast));

  const hasDiagnosticErrors = diagnostics.some((d) => d.severity === "error");
  if (hasDiagnosticErrors) {
    return { success: false, diagnostics };
  }

  const ir = transform(ast);
  const yaml = emit(ir);

  return { success: true, value: yaml, diagnostics };
}

export function compileToYaml(source: string): string {
  const result = compile(source);
  if (!result.success) {
    throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  }
  return result.value;
}
