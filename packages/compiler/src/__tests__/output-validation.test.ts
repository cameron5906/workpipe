import { describe, it, expect } from "vitest";
import { validateOutputs } from "../semantics/output-validation.js";
import { compile } from "../index.js";
import type {
  WorkflowNode,
  JobNode,
  AgentJobNode,
  CycleNode,
  OutputDeclaration,
} from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10) {
  return { start, end };
}

function createOutput(name: string, type: "string" = "string"): OutputDeclaration {
  return { name, type, span: createSpan() };
}

function createWorkflow(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    kind: "workflow",
    name: "test",
    trigger: { kind: "trigger", events: ["push"], span: createSpan() },
    jobs: [],
    cycles: [],
    span: createSpan(0, 100),
    ...overrides,
  };
}

function createJob(
  name: string,
  outputs: OutputDeclaration[] = []
): JobNode {
  return {
    kind: "job",
    name,
    runsOn: "ubuntu-latest",
    needs: [],
    condition: null,
    outputs,
    steps: [{ kind: "run", command: "echo hello", span: createSpan() }],
    span: createSpan(0, 50),
  };
}

function createAgentJob(
  name: string,
  outputs: OutputDeclaration[] = []
): AgentJobNode {
  return {
    kind: "agent_job",
    name,
    runsOn: "ubuntu-latest",
    needs: [],
    outputs,
    steps: [
      {
        kind: "agent_task",
        taskDescription: "Do something",
        consumes: [],
        span: createSpan(),
      },
    ],
    consumes: [],
    span: createSpan(0, 50),
  };
}

function createCycle(
  name: string,
  jobs: (JobNode | AgentJobNode)[]
): CycleNode {
  return {
    kind: "cycle",
    name,
    maxIters: 5,
    key: "phase",
    until: null,
    body: {
      kind: "cycle_body",
      jobs,
      span: createSpan(0, 100),
    },
    span: createSpan(0, 200),
  };
}

describe("validateOutputs", () => {
  describe("WP2010 - Duplicate output name in job", () => {
    it("returns error when job has duplicate output names", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [
            createOutput("version"),
            createOutput("version"),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2010");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("version");
      expect(diagnostics[0].message).toContain("build");
    });

    it("returns no error when job has unique output names", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [
            createOutput("version"),
            createOutput("sha"),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for each duplicate output", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [
            createOutput("version"),
            createOutput("version"),
            createOutput("version"),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP2010")).toBe(true);
    });

    it("returns error when agent_job has duplicate output names", () => {
      const workflow = createWorkflow({
        jobs: [
          createAgentJob("agent", [
            createOutput("result"),
            createOutput("result"),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2010");
      expect(diagnostics[0].message).toContain("result");
      expect(diagnostics[0].message).toContain("agent");
    });

    it("allows same output name in different jobs", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          createJob("test", [createOutput("version")]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error for duplicate in job inside cycle", () => {
      const workflow = createWorkflow({
        cycles: [
          createCycle("loop", [
            createJob("work", [
              createOutput("status"),
              createOutput("status"),
            ]),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2010");
      expect(diagnostics[0].message).toContain("status");
      expect(diagnostics[0].message).toContain("work");
      expect(diagnostics[0].message).toContain("cycle 'loop'");
    });
  });

  describe("multiple jobs with errors", () => {
    it("returns errors from all jobs with duplicates", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [
            createOutput("version"),
            createOutput("version"),
          ]),
          createJob("test", [
            createOutput("result"),
            createOutput("result"),
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP2010")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns no errors for job with no outputs", () => {
      const workflow = createWorkflow({
        jobs: [createJob("build", [])],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no errors for job with single output", () => {
      const workflow = createWorkflow({
        jobs: [createJob("build", [createOutput("version")])],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no errors for empty workflow", () => {
      const workflow = createWorkflow({
        jobs: [],
        cycles: [],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });
  });
});

describe("compile integration with output validation", () => {
  it("returns WP2010 error for duplicate outputs via compile()", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          version: string
          version: string
        }
        steps: [run("echo hello")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === "WP2010")).toBe(true);
    expect(errors.some((e) => e.message.includes("version"))).toBe(true);
    expect(errors.some((e) => e.message.includes("build"))).toBe(true);
  });

  it("compiles successfully with unique outputs", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          version: string
          sha: string
        }
        steps: [run("echo hello")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
