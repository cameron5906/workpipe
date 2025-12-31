import { warning, type Diagnostic } from "../diagnostic/index.js";
import type { CycleNode } from "../ast/types.js";

export function validateCycleTermination(cycle: CycleNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (cycle.until && !cycle.maxIters) {
    diagnostics.push(
      warning(
        "WP6005",
        `Cycle '${cycle.name}' has 'until' but no 'max_iters' - consider adding a maximum iteration limit as a safety rail`,
        cycle.span,
        "Add 'max_iters = N' to prevent infinite loops if the guard condition has a bug"
      )
    );
  }

  return diagnostics;
}
