import { stringify } from "yaml";
import type {
  WorkflowIR,
  JobIR,
  StepIR,
  TriggerIR,
  WorkflowDispatchInputIR,
} from "./yaml-ir.js";

function serializeStep(step: StepIR): Record<string, unknown> {
  switch (step.kind) {
    case "run": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.run = step.command;
      return result;
    }
    case "shell": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.run = step.run;
      return result;
    }
    case "uses": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.uses = step.action;
      return result;
    }
    case "uses_with": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.uses = step.action;
      result.with = { ...step.with };
      return result;
    }
    case "claude_code": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.name = step.name;
      result.uses = step.uses;
      result.with = { ...step.with };
      return result;
    }
    case "upload_artifact": {
      const result: Record<string, unknown> = {};
      if (step.id) {
        result.id = step.id;
      }
      result.name = step.name;
      result.uses = step.uses;
      result.with = { ...step.with };
      return result;
    }
    case "download_artifact": {
      const result: Record<string, unknown> = {
        name: step.name,
        uses: step.uses,
      };
      if (step.if) {
        result.if = step.if;
      }
      result.with = { ...step.with };
      if (step.id) {
        result.id = step.id;
      }
      return result;
    }
    case "script": {
      const result: Record<string, unknown> = {
        name: step.name,
      };
      if (step.id) {
        result.id = step.id;
      }
      result.run = step.run;
      if (step.if) {
        result.if = step.if;
      }
      if (step.shell) {
        result.shell = step.shell;
      }
      if (step.env) {
        result.env = { ...step.env };
      }
      return result;
    }
  }
}

function serializeJob(job: JobIR): Record<string, unknown> {
  const result: Record<string, unknown> = {
    "runs-on": job.runsOn,
  };

  if (job.needs && job.needs.length > 0) {
    result.needs = [...job.needs];
  }

  if (job.if) {
    result.if = job.if;
  }

  if (job.outputs) {
    result.outputs = { ...job.outputs };
  }

  if (job.strategy) {
    const strategyResult: Record<string, unknown> = {
      matrix: { ...job.strategy.matrix },
    };

    if (job.strategy.include && job.strategy.include.length > 0) {
      (strategyResult.matrix as Record<string, unknown>).include = job.strategy.include.map(c => ({ ...c }));
    }

    if (job.strategy.exclude && job.strategy.exclude.length > 0) {
      (strategyResult.matrix as Record<string, unknown>).exclude = job.strategy.exclude.map(c => ({ ...c }));
    }

    if (job.strategy["max-parallel"] !== undefined) {
      strategyResult["max-parallel"] = job.strategy["max-parallel"];
    }

    if (job.strategy["fail-fast"] !== undefined) {
      strategyResult["fail-fast"] = job.strategy["fail-fast"];
    }

    result.strategy = strategyResult;
  }

  result.steps = job.steps.map(serializeStep);

  return result;
}

function serializeTrigger(trigger: TriggerIR): unknown {
  if (trigger.workflowDispatch) {
    const result: Record<string, unknown> = {};

    if (trigger.events.length === 1) {
      result[trigger.events[0]] = null;
    } else if (trigger.events.length > 1) {
      for (const event of trigger.events) {
        result[event] = null;
      }
    }

    const inputs: Record<string, unknown> = {};
    for (const input of trigger.workflowDispatch.inputs) {
      const inputDef: Record<string, unknown> = {
        description: input.description,
        required: input.required,
      };
      if (input.default !== undefined) {
        inputDef.default = input.default;
      }
      inputs[input.name] = inputDef;
    }

    result.workflow_dispatch = { inputs };

    return result;
  }

  if (trigger.events.length === 1) {
    return trigger.events[0];
  }

  return [...trigger.events];
}

export function emit(ir: WorkflowIR): string {
  const doc: Record<string, unknown> = {
    name: ir.name,
    on: serializeTrigger(ir.on),
    ...(ir.concurrency && { concurrency: ir.concurrency }),
    jobs: Object.fromEntries(
      [...ir.jobs].map(([name, job]) => [name, serializeJob(job)])
    ),
  };

  return stringify(doc, { lineWidth: 0, sortMapEntries: false }) + "\n";
}
