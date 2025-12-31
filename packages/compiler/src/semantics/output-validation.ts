import { semanticError, type Diagnostic } from "../diagnostic/index.js";
import type {
  WorkflowNode,
  WorkPipeFileNode,
  AnyJobNode,
  OutputDeclaration,
  StepNode,
  Span,
} from "../ast/types.js";
import type { TypeRegistry } from "./type-registry.js";

interface JobOutputs {
  name: string;
  outputs: Map<string, OutputDeclaration>;
}

interface OutputReference {
  jobName: string;
  outputName: string;
  span: Span;
}

const OUTPUT_REF_PATTERN = /\$\{\{\s*needs\.(\w+)\.outputs\.(\w+)\s*\}\}/g;

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

function extractOutputReferences(text: string, span: Span): OutputReference[] {
  const references: OutputReference[] = [];
  let match: RegExpExecArray | null;

  OUTPUT_REF_PATTERN.lastIndex = 0;
  while ((match = OUTPUT_REF_PATTERN.exec(text)) !== null) {
    references.push({
      jobName: match[1],
      outputName: match[2],
      span,
    });
  }

  return references;
}

function extractReferencesFromStep(step: StepNode): OutputReference[] {
  switch (step.kind) {
    case "run":
      return extractOutputReferences(step.command, step.span);
    case "uses":
      return extractOutputReferences(step.action, step.span);
    case "agent_task":
      return extractOutputReferences(step.taskDescription, step.span);
    default:
      return [];
  }
}

function validateOutputReferencesInJob(
  job: AnyJobNode,
  jobOutputsMap: Map<string, JobOutputs>,
  cycleName?: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const allowedJobs = new Set(job.needs);

  for (const step of job.steps) {
    const references = extractReferencesFromStep(step);

    for (const ref of references) {
      if (!allowedJobs.has(ref.jobName)) {
        const context = cycleName ? ` in cycle '${cycleName}'` : "";
        diagnostics.push(
          semanticError(
            "WP2011",
            `Reference to output '${ref.outputName}' on job '${ref.jobName}' which is not in the needs list of job '${job.name}'${context}`,
            ref.span,
            `Add '${ref.jobName}' to the needs list of job '${job.name}'`
          )
        );
        continue;
      }

      const targetJob = jobOutputsMap.get(ref.jobName);
      if (!targetJob) {
        continue;
      }

      if (!targetJob.outputs.has(ref.outputName)) {
        const availableOutputs = Array.from(targetJob.outputs.keys());
        const hint =
          availableOutputs.length > 0
            ? `Available outputs on '${ref.jobName}': ${availableOutputs.join(", ")}`
            : `Job '${ref.jobName}' has no outputs defined`;

        const context = cycleName ? ` in cycle '${cycleName}'` : "";
        diagnostics.push(
          semanticError(
            "WP2011",
            `Reference to non-existent output '${ref.outputName}' on job '${ref.jobName}'${context}`,
            ref.span,
            hint
          )
        );
      }
    }
  }

  return diagnostics;
}

const PRIMITIVE_TYPES = new Set(["string", "int", "float", "bool", "json", "path"]);

function isPrimitiveType(name: string): boolean {
  return PRIMITIVE_TYPES.has(name);
}

function isFilePath(value: string): boolean {
  return value.endsWith(".json") || value.startsWith("./") || value.startsWith("../") || value.includes("/");
}

function validateOutputTypeReferencesInJob(
  job: AnyJobNode,
  registry: TypeRegistry,
  cycleName?: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const availableTypes = Array.from(registry.types.keys());

  for (const output of job.outputs) {
    if (output.typeReference) {
      if (!isPrimitiveType(output.typeReference) && !registry.has(output.typeReference)) {
        const hint =
          availableTypes.length > 0
            ? `Available types: ${availableTypes.join(", ")}`
            : "No user-defined types are available";

        const context = cycleName ? ` in cycle '${cycleName}'` : "";
        diagnostics.push(
          semanticError(
            "WP5002",
            `Unknown type '${output.typeReference}' for output '${output.name}' in job '${job.name}'${context}`,
            output.span,
            hint
          )
        );
      }
    }
  }

  for (const step of job.steps) {
    if (step.kind === "agent_task" && typeof step.outputSchema === "string") {
      const schemaRef = step.outputSchema;
      if (!isFilePath(schemaRef) && !registry.has(schemaRef)) {
        const hint =
          availableTypes.length > 0
            ? `Available types: ${availableTypes.join(", ")}`
            : "No user-defined types are available";

        const context = cycleName ? ` in cycle '${cycleName}'` : "";
        diagnostics.push(
          semanticError(
            "WP5002",
            `Unknown type '${schemaRef}' in output_schema of agent_task in job '${job.name}'${context}`,
            step.span,
            hint
          )
        );
      }
    }
  }

  return diagnostics;
}

export function validateOutputs(ast: WorkflowNode, registry?: TypeRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const jobOutputsMap = new Map<string, JobOutputs>();

  for (const job of ast.jobs) {
    diagnostics.push(...validateDuplicateOutputsInJob(job));
    if (registry) {
      diagnostics.push(...validateOutputTypeReferencesInJob(job, registry));
    }
    jobOutputsMap.set(job.name, collectJobOutputs(job));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      diagnostics.push(...validateDuplicateOutputsInJob(job, cycle.name));
      if (registry) {
        diagnostics.push(...validateOutputTypeReferencesInJob(job, registry, cycle.name));
      }
      const prefixedName = `${cycle.name}_body_${job.name}`;
      jobOutputsMap.set(prefixedName, collectJobOutputs(job));
      jobOutputsMap.set(job.name, collectJobOutputs(job));
    }
  }

  for (const job of ast.jobs) {
    diagnostics.push(...validateOutputReferencesInJob(job, jobOutputsMap));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      diagnostics.push(
        ...validateOutputReferencesInJob(job, jobOutputsMap, cycle.name)
      );
    }
  }

  return diagnostics;
}
