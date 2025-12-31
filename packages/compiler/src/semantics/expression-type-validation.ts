import type { Diagnostic } from "../diagnostic/index.js";
import type {
  WorkflowNode,
  AnyJobNode,
  StepNode,
  OutputDeclaration,
  Span,
} from "../ast/types.js";
import { extractInterpolations } from "./expression-parser.js";
import {
  checkExpressionTypes,
  type TypeContext,
} from "./expression-types.js";

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

function buildTypeContext(
  jobOutputsMap: Map<string, JobOutputs>
): TypeContext {
  const jobOutputs = new Map<string, Map<string, OutputDeclaration>>();

  for (const [jobName, jobData] of jobOutputsMap) {
    jobOutputs.set(jobName, jobData.outputs);
  }

  return { jobOutputs };
}

function extractTextFromStep(step: StepNode): { text: string; span: Span }[] {
  switch (step.kind) {
    case "run":
      return [{ text: step.command, span: step.span }];
    case "uses":
      return [{ text: step.action, span: step.span }];
    case "agent_task":
      return [{ text: step.taskDescription, span: step.span }];
    case "guard_js_step":
      return [{ text: step.code, span: step.span }];
    default:
      return [];
  }
}

function validateExpressionsInJob(
  job: AnyJobNode,
  context: TypeContext
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (job.condition) {
    diagnostics.push(...checkExpressionTypes(job.condition, context));
  }

  for (const step of job.steps) {
    const textSources = extractTextFromStep(step);

    for (const { text, span } of textSources) {
      const interpolations = extractInterpolations(text, span);

      for (const interp of interpolations) {
        diagnostics.push(...checkExpressionTypes(interp.expression, context));
      }
    }
  }

  return diagnostics;
}

export function validateExpressionTypes(ast: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const jobOutputsMap = new Map<string, JobOutputs>();

  for (const job of ast.jobs) {
    jobOutputsMap.set(job.name, collectJobOutputs(job));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      const prefixedName = `${cycle.name}_body_${job.name}`;
      jobOutputsMap.set(prefixedName, collectJobOutputs(job));
      jobOutputsMap.set(job.name, collectJobOutputs(job));
    }
  }

  const context = buildTypeContext(jobOutputsMap);

  for (const job of ast.jobs) {
    diagnostics.push(...validateExpressionsInJob(job, context));
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      diagnostics.push(...validateExpressionsInJob(job, context));
    }
  }

  return diagnostics;
}
