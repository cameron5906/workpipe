import { describe, it, expect } from "vitest";
import { validateRequiredFields } from "../semantics/required-fields.js";
import { compile } from "../index.js";
import { SEMANTIC_DIAGNOSTICS } from "../diagnostics/index.js";
import type { WorkflowNode, JobNode, AgentJobNode, CycleNode } from "../ast/types.js";

function createWorkflow(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    kind: "workflow",
    name: "test",
    trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
    jobs: [],
    cycles: [],
    span: { start: 0, end: 100 },
    ...overrides,
  };
}

function createJob(name: string, runsOn: string | null): JobNode {
  return {
    kind: "job",
    name,
    runsOn,
    needs: [],
    condition: null,
    outputs: [],
    steps: [{ kind: "run", command: "echo hello", span: { start: 0, end: 10 } }],
    span: { start: 0, end: 50 },
  };
}

function createAgentJob(name: string, runsOn: string | null): AgentJobNode {
  return {
    kind: "agent_job",
    name,
    runsOn,
    needs: [],
    outputs: [],
    steps: [
      {
        kind: "agent_task",
        taskDescription: "Do something",
        consumes: [],
        span: { start: 0, end: 30 },
      },
    ],
    consumes: [],
    span: { start: 0, end: 50 },
  };
}

function createCycle(name: string, jobs: (JobNode | AgentJobNode)[]): CycleNode {
  return {
    kind: "cycle",
    name,
    maxIters: 5,
    key: "phase",
    until: null,
    body: {
      kind: "cycle_body",
      jobs,
      span: { start: 0, end: 100 },
    },
    span: { start: 0, end: 200 },
  };
}

describe("validateRequiredFields", () => {
  describe("WP8001 - Job missing runs_on", () => {
    it("returns error when job is missing runs_on", () => {
      const workflow = createWorkflow({
        jobs: [createJob("build", null)],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(SEMANTIC_DIAGNOSTICS.JOB_MISSING_RUNS_ON.code);
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("build");
      expect(diagnostics[0].message).toContain("runs_on");
    });

    it("returns no error when job has runs_on", () => {
      const workflow = createWorkflow({
        jobs: [createJob("build", "ubuntu-latest")],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for job missing runs_on inside a cycle", () => {
      const workflow = createWorkflow({
        cycles: [createCycle("loop", [createJob("work", null)])],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(SEMANTIC_DIAGNOSTICS.JOB_MISSING_RUNS_ON.code);
      expect(diagnostics[0].message).toContain("work");
      expect(diagnostics[0].message).toContain("cycle 'loop'");
    });
  });

  describe("WP8002 - Agent job missing runs_on", () => {
    it("returns error when agent_job is missing runs_on", () => {
      const workflow = createWorkflow({
        jobs: [createAgentJob("agent", null)],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(SEMANTIC_DIAGNOSTICS.AGENT_JOB_MISSING_RUNS_ON.code);
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("agent");
      expect(diagnostics[0].message).toContain("runs_on");
    });

    it("returns no error when agent_job has runs_on", () => {
      const workflow = createWorkflow({
        jobs: [createAgentJob("agent", "ubuntu-latest")],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for agent_job missing runs_on inside a cycle", () => {
      const workflow = createWorkflow({
        cycles: [createCycle("loop", [createAgentJob("agent_work", null)])],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(SEMANTIC_DIAGNOSTICS.AGENT_JOB_MISSING_RUNS_ON.code);
      expect(diagnostics[0].message).toContain("agent_work");
      expect(diagnostics[0].message).toContain("cycle 'loop'");
    });
  });

  describe("WP8004 - Workflow has no jobs or cycles", () => {
    it("returns warning when workflow has no jobs or cycles", () => {
      const workflow = createWorkflow({
        jobs: [],
        cycles: [],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe(SEMANTIC_DIAGNOSTICS.EMPTY_WORKFLOW.code);
      expect(diagnostics[0].severity).toBe("warning");
      expect(diagnostics[0].message).toContain("test");
      expect(diagnostics[0].message).toContain("no jobs or cycles");
    });

    it("returns no warning when workflow has jobs", () => {
      const workflow = createWorkflow({
        jobs: [createJob("build", "ubuntu-latest")],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no warning when workflow has cycles", () => {
      const workflow = createWorkflow({
        cycles: [createCycle("loop", [createJob("work", "ubuntu-latest")])],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("multiple errors", () => {
    it("returns multiple errors for multiple missing fields", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", null),
          createAgentJob("agent", null),
        ],
      });

      const diagnostics = validateRequiredFields(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.map((d) => d.code).sort()).toEqual([
        SEMANTIC_DIAGNOSTICS.JOB_MISSING_RUNS_ON.code,
        SEMANTIC_DIAGNOSTICS.AGENT_JOB_MISSING_RUNS_ON.code,
      ].sort());
    });
  });
});

describe("compile integration with required field validation", () => {
  it("returns WP8001 error for job missing runs_on", () => {
    const source = `workflow test {
      on: push
      job build {
        steps: [run("echo hello")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === SEMANTIC_DIAGNOSTICS.JOB_MISSING_RUNS_ON.code)).toBe(true);
    expect(errors.some((e) => e.message.includes("build"))).toBe(true);
  });

  it("returns WP8002 error for agent_job missing runs_on", () => {
    const source = `workflow test {
      on: push
      agent_job agent {
        steps: [
          agent_task("Do something") {
            model: "claude-sonnet-4-20250514"
          }
        ]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === SEMANTIC_DIAGNOSTICS.AGENT_JOB_MISSING_RUNS_ON.code)).toBe(true);
    expect(errors.some((e) => e.message.includes("agent"))).toBe(true);
  });

  it("returns WP8004 warning for empty workflow", () => {
    const source = `workflow empty {
      on: push
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const warnings = result.diagnostics.filter((d) => d.severity === "warning");
    expect(warnings.some((w) => w.code === SEMANTIC_DIAGNOSTICS.EMPTY_WORKFLOW.code)).toBe(true);
    expect(warnings.some((w) => w.message.includes("empty"))).toBe(true);
  });

  it("compiles successfully with valid runs_on", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        steps: [run("echo hello")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
