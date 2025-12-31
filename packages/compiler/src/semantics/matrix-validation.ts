import { semanticError, warning, type Diagnostic } from "../diagnostic/index.js";
import type { WorkflowNode, MatrixJobNode, AnyJobNode } from "../ast/types.js";

const MATRIX_JOB_LIMIT = 256;
const MATRIX_WARNING_THRESHOLD = 200;

/**
 * Calculate the total number of jobs that a matrix job will expand to.
 *
 * The calculation follows these rules:
 * 1. Base count = Cartesian product of all axes
 * 2. Each include entry adds one job
 * 3. Each exclude entry removes one job
 * 4. Result is clamped to minimum of 0
 */
export function calculateMatrixJobCount(job: MatrixJobNode): number {
  const axisValues = Object.values(job.axes);

  let count: number;
  if (axisValues.length === 0) {
    count = 0;
  } else {
    count = axisValues.reduce((acc, vals) => acc * vals.length, 1);
  }

  if (job.include) {
    count += job.include.length;
  }

  if (job.exclude) {
    count -= job.exclude.length;
  }

  return Math.max(0, count);
}

function isMatrixJob(job: AnyJobNode): job is MatrixJobNode {
  return job.kind === "matrix_job";
}

function validateMatrixJob(
  job: MatrixJobNode,
  cycleName?: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const jobCount = calculateMatrixJobCount(job);
  const context = cycleName ? ` in cycle '${cycleName}'` : "";

  if (jobCount > MATRIX_JOB_LIMIT) {
    diagnostics.push(
      semanticError(
        "WP4001",
        `Matrix job '${job.name}' exceeds GitHub's 256-job limit (${jobCount} jobs)${context}`,
        job.span,
        `Reduce the matrix dimensions or use exclude to filter combinations. Current: ${jobCount}, Maximum: ${MATRIX_JOB_LIMIT}`
      )
    );
  } else if (jobCount > MATRIX_WARNING_THRESHOLD) {
    diagnostics.push(
      warning(
        "WP4002",
        `Matrix job '${job.name}' is approaching GitHub's 256-job limit (${jobCount} jobs)${context}`,
        job.span,
        `Consider reducing matrix dimensions. Current: ${jobCount}, Warning threshold: ${MATRIX_WARNING_THRESHOLD}, Maximum: ${MATRIX_JOB_LIMIT}`
      )
    );
  }

  return diagnostics;
}

/**
 * Validate all matrix jobs in a workflow to ensure they don't exceed GitHub's 256-job limit.
 * Returns diagnostics for any violations or warnings.
 */
export function validateMatrixJobs(ast: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const job of ast.jobs) {
    if (isMatrixJob(job)) {
      diagnostics.push(...validateMatrixJob(job));
    }
  }

  for (const cycle of ast.cycles) {
    for (const job of cycle.body.jobs) {
      if (isMatrixJob(job)) {
        diagnostics.push(...validateMatrixJob(job, cycle.name));
      }
    }
  }

  return diagnostics;
}
