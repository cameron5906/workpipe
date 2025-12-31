import { semanticError, warning, type Diagnostic } from "../diagnostic/index.js";
import type { WorkflowNode } from "../ast/types.js";

export function validateRequiredFields(ast: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const job of ast.jobs) {
    if (job.kind === "job" && job.runsOn === null) {
      diagnostics.push(
        semanticError(
          "WP7001",
          `Job '${job.name}' is missing required 'runs_on' field`,
          job.span,
          "Add 'runs_on: ubuntu-latest' or another runner to the job"
        )
      );
    }

    if (job.kind === "agent_job" && job.runsOn === null) {
      diagnostics.push(
        semanticError(
          "WP7002",
          `Agent job '${job.name}' is missing required 'runs_on' field`,
          job.span,
          "Add 'runs_on: ubuntu-latest' or another runner to the agent job"
        )
      );
    }
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      if (job.kind === "job" && job.runsOn === null) {
        diagnostics.push(
          semanticError(
            "WP7001",
            `Job '${job.name}' in cycle '${cycle.name}' is missing required 'runs_on' field`,
            job.span,
            "Add 'runs_on: ubuntu-latest' or another runner to the job"
          )
        );
      }

      if (job.kind === "agent_job" && job.runsOn === null) {
        diagnostics.push(
          semanticError(
            "WP7002",
            `Agent job '${job.name}' in cycle '${cycle.name}' is missing required 'runs_on' field`,
            job.span,
            "Add 'runs_on: ubuntu-latest' or another runner to the agent job"
          )
        );
      }
    }
  }

  if (ast.jobs.length === 0 && ast.cycles.length === 0) {
    diagnostics.push(
      warning(
        "WP7004",
        `Workflow '${ast.name}' has no jobs or cycles defined`,
        ast.span,
        "Add at least one job or cycle to the workflow"
      )
    );
  }

  return diagnostics;
}
