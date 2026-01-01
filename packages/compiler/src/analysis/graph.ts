import type { WorkflowNode, AnyJobNode } from "../ast/types.js";
import { isConcreteJob } from "../ast/types.js";
import type { JobGraph, JobVertex } from "./types.js";

/**
 * Builds a job dependency graph from a workflow AST node.
 * Includes jobs from both the top-level workflow and jobs inside cycle blocks.
 */
export function buildJobGraph(workflow: WorkflowNode): JobGraph {
  const vertices = new Map<string, JobVertex>();

  function addJob(job: AnyJobNode): void {
    const dependencies: string[] = [...job.needs];

    if (job.kind === "agent_job" && job.after) {
      if (!dependencies.includes(job.after)) {
        dependencies.push(job.after);
      }
    }

    vertices.set(job.name, {
      name: job.name,
      dependencies,
    });
  }

  for (const job of workflow.jobs) {
    if (isConcreteJob(job)) {
      addJob(job);
    }
  }

  for (const cycle of workflow.cycles) {
    for (const job of cycle.body.jobs) {
      if (isConcreteJob(job)) {
        addJob(job);
      }
    }
  }

  return { vertices };
}
