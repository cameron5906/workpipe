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

describe("WP2011 - Reference to non-existent output", () => {
  describe("validateOutputs with output references", () => {
    it("returns error when referencing non-existent output on a needed job", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version"), createOutput("artifact_path")]),
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.typo }}"',
                span: createSpan(100, 150),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("typo");
      expect(diagnostics[0].message).toContain("build");
      expect(diagnostics[0].hint).toContain("version");
      expect(diagnostics[0].hint).toContain("artifact_path");
    });

    it("returns no error when referencing valid output", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.version }}"',
                span: createSpan(),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error when referencing output on job not in needs", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createJob("deploy", []),
            needs: [],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.version }}"',
                span: createSpan(100, 150),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].message).toContain("build");
    });

    it("returns error for each invalid reference in the same step", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command:
                  'echo "${{ needs.build.outputs.foo }}" && echo "${{ needs.build.outputs.bar }}"',
                span: createSpan(),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.every((d) => d.code === "WP2011")).toBe(true);
    });

    it("validates references in uses step action strings", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "uses" as const,
                action: "some-action@${{ needs.build.outputs.invalid }}",
                span: createSpan(100, 150),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].message).toContain("invalid");
    });

    it("validates references in agent task descriptions", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createAgentJob("agent", []),
            needs: ["build"],
            steps: [
              {
                kind: "agent_task" as const,
                taskDescription:
                  "Deploy version ${{ needs.build.outputs.nonexistent }}",
                consumes: [],
                span: createSpan(100, 150),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].message).toContain("nonexistent");
    });

    it("validates references in jobs inside cycles", () => {
      const workflow = createWorkflow({
        jobs: [createJob("setup", [createOutput("config")])],
        cycles: [
          createCycle("loop", [
            {
              ...createJob("work", []),
              needs: ["setup"],
              steps: [
                {
                  kind: "run" as const,
                  command: 'echo "${{ needs.setup.outputs.missing }}"',
                  span: createSpan(),
                },
              ],
            },
          ]),
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].message).toContain("missing");
      expect(diagnostics[0].message).toContain("setup");
    });

    it("shows helpful message when job has no outputs", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", []),
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.version }}"',
                span: createSpan(),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].hint).toContain("no outputs");
    });

    it("validates multiple jobs referencing the same dependency", () => {
      const workflow = createWorkflow({
        jobs: [
          createJob("build", [createOutput("version")]),
          {
            ...createJob("test", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.version }}"',
                span: createSpan(),
              },
            ],
          },
          {
            ...createJob("deploy", []),
            needs: ["build"],
            steps: [
              {
                kind: "run" as const,
                command: 'echo "${{ needs.build.outputs.invalid }}"',
                span: createSpan(),
              },
            ],
          },
        ],
      });

      const diagnostics = validateOutputs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP2011");
      expect(diagnostics[0].message).toContain("invalid");
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

  it("returns WP2011 error for referencing non-existent output via compile()", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          version: string
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("echo $\{{ needs.build.outputs.typo }}")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.some((e) => e.code === "WP2011")).toBe(true);
    expect(errors.some((e) => e.message.includes("typo"))).toBe(true);
  });

  it("compiles successfully with valid output references", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          version: string
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("echo $\{{ needs.build.outputs.version }}")]
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
  });
});

describe("WP5002 - Type reference validation in job outputs", () => {
  describe("compile integration with output type references", () => {
    it("compiles successfully with type reference in output", () => {
      const source = `type BuildInfo {
  version: string
  commit: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(true);
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("returns WP5002 error for invalid type reference in output", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: NonExistentType
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors.some((e) => e.code === "WP5002")).toBe(true);
      expect(errors.some((e) => e.message.includes("NonExistentType"))).toBe(true);
      expect(errors.some((e) => e.message.includes("info"))).toBe(true);
      expect(errors.some((e) => e.message.includes("build"))).toBe(true);
    });

    it("shows available types in hint for invalid type reference", () => {
      const source = `type BuildInfo {
  version: string
}

type DeployConfig {
  env: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: UnknownType
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const error = result.diagnostics.find((d) => d.code === "WP5002");
      expect(error).toBeDefined();
      expect(error?.hint).toContain("BuildInfo");
      expect(error?.hint).toContain("DeployConfig");
    });

    it("allows primitive types in outputs", () => {
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
    });

    it("validates type references in multiple jobs", () => {
      const source = `type BuildInfo {
  version: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }
  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    outputs: {
      result: InvalidType
    }
    steps: [run("echo deploy")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const errors = result.diagnostics.filter((d) => d.code === "WP5002");
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("InvalidType");
      expect(errors[0].message).toContain("deploy");
    });

    it("validates type references in jobs inside cycles", () => {
      const source = `type CycleResult {
  status: string
}

workflow test {
  on: push
  cycle review_loop {
    max_iters = 5
    body {
      job review {
        runs_on: ubuntu-latest
        outputs: {
          result: InvalidCycleType
        }
        steps: [run("echo review")]
      }
    }
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const errors = result.diagnostics.filter((d) => d.code === "WP5002");
      expect(errors.some((e) => e.message.includes("InvalidCycleType"))).toBe(true);
      expect(errors.some((e) => e.message.includes("cycle 'review_loop'"))).toBe(true);
    });

    it("allows valid type reference in job inside cycle", () => {
      const source = `type CycleResult {
  status: string
}

workflow test {
  on: push
  cycle review_loop {
    max_iters = 5
    body {
      job review {
        runs_on: ubuntu-latest
        outputs: {
          result: CycleResult
        }
        steps: [run("echo review")]
      }
    }
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(true);
    });

    it("allows mix of primitive and type-referenced outputs", () => {
      const source = `type BuildInfo {
  version: string
  commit: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      status: string
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(true);
    });

    it("validates multiple type references in same job", () => {
      const source = `type TypeA {
  value: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      first: UnknownA
      second: TypeA
      third: UnknownB
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const errors = result.diagnostics.filter((d) => d.code === "WP5002");
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.message.includes("UnknownA"))).toBe(true);
      expect(errors.some((e) => e.message.includes("UnknownB"))).toBe(true);
    });

    it("shows helpful message when no types are available", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: SomeType
    }
    steps: [run("echo hello")]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const error = result.diagnostics.find((d) => d.code === "WP5002");
      expect(error).toBeDefined();
      expect(error?.hint).toContain("No user-defined types are available");
    });

    it("validates type references in agent_job outputs", () => {
      const source = `type AgentResult {
  response: string
}

workflow test {
  on: push
  agent_job reviewer {
    runs_on: ubuntu-latest
    outputs: {
      result: InvalidAgentType
    }
    steps: [
      agent_task("Review the code") {}
    ]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(false);
      const errors = result.diagnostics.filter((d) => d.code === "WP5002");
      expect(errors.some((e) => e.message.includes("InvalidAgentType"))).toBe(true);
      expect(errors.some((e) => e.message.includes("reviewer"))).toBe(true);
    });

    it("allows valid type reference in agent_job outputs", () => {
      const source = `type AgentResult {
  response: string
}

workflow test {
  on: push
  agent_job reviewer {
    runs_on: ubuntu-latest
    outputs: {
      result: AgentResult
    }
    steps: [
      agent_task("Review the code") {}
    ]
  }
}`;

      const result = compile(source);

      expect(result.success).toBe(true);
    });
  });
});
