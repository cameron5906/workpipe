import { semanticError, type Diagnostic } from "../diagnostic/index.js";
import type { WorkflowNode, AnyJobNode, OutputDeclaration } from "../ast/types.js";

interface JobOutputs {
  name: string;
  outputs: Map<string, OutputDeclaration>;
}

function collectJobOutputs(job: AnyJobNode): JobOutputs {
  const outputs = new Map<string, OutputDeclaration>();
  for (const output of job.outputs) {
    outputs.set(output.name, output);
  }
  return { name: job.name, outputs };
}

function validateDuplicateOutputsInJob(
  job: AnyJobNode,
  cycleName?: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, OutputDeclaration>();

  for (const output of job.outputs) {
    const existing = seen.get(output.name);
    if (existing) {
      const context = cycleName
        ? ` in cycle '${cycleName}'`
        : "";
      diagnostics.push(
        semanticError(
          "WP2010",
          `Duplicate output '${output.name}' in job '${job.name}'${context}`,
          output.span,
          `Remove or rename one of the duplicate outputs named '${output.name}'`
        )
      );
    } else {
      seen.set(output.name, output);
    }
  }

  return diagnostics;
}

export function validateOutputs(ast: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const jobOutputsMap = new Map<string, JobOutputs>();

  for (const job of ast.jobs) {
    diagnostics.push(...validateDuplicateOutputsInJob(job));
    jobOutputsMap.set(job.name, collectJobOutputs(job));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      diagnostics.push(...validateDuplicateOutputsInJob(job, cycle.name));
      const prefixedName = `${cycle.name}_body_${job.name}`;
      jobOutputsMap.set(prefixedName, collectJobOutputs(job));
      jobOutputsMap.set(job.name, collectJobOutputs(job));
    }
  }

  return diagnostics;
}
