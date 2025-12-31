import { describe, it, expect } from "vitest";
import { parse } from "@workpipe/lang";
import { buildAST } from "../ast/index.js";
import { transform, transformCycle, emit, serializeExpression, inlineSchemaToJsonSchema, generateMatrixFingerprint } from "../codegen/index.js";
import { compile } from "../index.js";
import type { ExpressionNode, AgentJobNode, AgentTaskNode, CycleNode, SchemaObjectNode, GuardJsStepNode, JobNode, MatrixJobNode } from "../ast/types.js";
import type { WorkflowNode } from "../ast/types.js";

describe("serializeExpression", () => {
  it("serializes property access", () => {
    const expr: ExpressionNode = {
      kind: "property",
      path: ["github", "ref"],
      span: { start: 0, end: 10 },
    };
    expect(serializeExpression(expr)).toBe("github.ref");
  });

  it("serializes string literal with single quotes", () => {
    const expr: ExpressionNode = {
      kind: "string",
      value: "refs/heads/main",
      span: { start: 0, end: 17 },
    };
    expect(serializeExpression(expr)).toBe("'refs/heads/main'");
  });

  it("serializes boolean literal", () => {
    const trueExpr: ExpressionNode = {
      kind: "boolean",
      value: true,
      span: { start: 0, end: 4 },
    };
    const falseExpr: ExpressionNode = {
      kind: "boolean",
      value: false,
      span: { start: 0, end: 5 },
    };
    expect(serializeExpression(trueExpr)).toBe("true");
    expect(serializeExpression(falseExpr)).toBe("false");
  });

  it("serializes binary expression with ==", () => {
    const expr: ExpressionNode = {
      kind: "binary",
      operator: "==",
      left: {
        kind: "property",
        path: ["github", "ref"],
        span: { start: 0, end: 10 },
      },
      right: {
        kind: "string",
        value: "refs/heads/main",
        span: { start: 14, end: 31 },
      },
      span: { start: 0, end: 31 },
    };
    expect(serializeExpression(expr)).toBe("github.ref == 'refs/heads/main'");
  });

  it("serializes binary expression with !=", () => {
    const expr: ExpressionNode = {
      kind: "binary",
      operator: "!=",
      left: {
        kind: "property",
        path: ["github", "event_name"],
        span: { start: 0, end: 17 },
      },
      right: {
        kind: "string",
        value: "pull_request",
        span: { start: 21, end: 35 },
      },
      span: { start: 0, end: 35 },
    };
    expect(serializeExpression(expr)).toBe("github.event_name != 'pull_request'");
  });
});

describe("transform", () => {
  it("transforms minimal workflow to IR", () => {
    const source = `workflow test {
      on: push
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo hi")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    expect(ast).not.toBeNull();

    const ir = transform(ast!);
    expect(ir.name).toBe("test");
    expect(ir.on.events).toEqual(["push"]);
    expect(ir.jobs.size).toBe(1);
    expect(ir.jobs.has("hello")).toBe(true);

    const job = ir.jobs.get("hello")!;
    expect(job.runsOn).toBe("ubuntu-latest");
    expect(job.steps).toHaveLength(1);
    expect(job.steps[0]).toEqual({ kind: "run", command: "echo hi" });
  });

  it("transforms workflow with multiple events", () => {
    const source = `workflow test {
      on: [push, pull_request]
      job build {
        runs_on: ubuntu-latest
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    expect(ir.on.events).toEqual(["push", "pull_request"]);
  });

  it("transforms job with needs and condition", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        steps: [run("npm build")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        if: github.ref == "refs/heads/main"
        steps: [run("npm deploy")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    expect(ir.jobs.size).toBe(2);

    const deploy = ir.jobs.get("deploy")!;
    expect(deploy.needs).toEqual(["build"]);
    expect(deploy.if).toBe("github.ref == 'refs/heads/main'");
  });

  it("transforms uses steps", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        steps: [uses("actions/checkout@v4")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("build")!;
    expect(job.steps[0]).toEqual({ kind: "uses", action: "actions/checkout@v4" });
  });

  it("preserves job order", () => {
    const source = `workflow test {
      on: push
      job alpha {
        runs_on: ubuntu-latest
        steps: [run("echo alpha")]
      }
      job beta {
        runs_on: ubuntu-latest
        steps: [run("echo beta")]
      }
      job gamma {
        runs_on: ubuntu-latest
        steps: [run("echo gamma")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const jobNames = [...ir.jobs.keys()];
    expect(jobNames).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("emit", () => {
  it("emits single event as scalar", () => {
    const source = `workflow test {
      on: push
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo hi")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("on: push");
    expect(yaml).not.toContain("on:\n  - push");
  });

  it("emits multiple events as array", () => {
    const source = `workflow test {
      on: [push, pull_request]
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo hi")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("- push");
    expect(yaml).toContain("- pull_request");
  });

  it("emits trailing newline", () => {
    const source = `workflow test {
      on: push
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo hi")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml.endsWith("\n\n")).toBe(true);
  });

  it("emits runs-on with hyphen", () => {
    const source = `workflow test {
      on: push
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo hi")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("runs-on: ubuntu-latest");
  });
});

describe("compile", () => {
  it("compiles minimal workflow", () => {
    const source = `workflow minimal {
      on: push
      job hello {
        runs_on: ubuntu-latest
        steps: [run("echo Hello")]
      }
    }`;

    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("name: minimal");
      expect(result.value).toContain("on: push");
      expect(result.value).toContain("runs-on: ubuntu-latest");
      expect(result.value).toContain("run: echo Hello");
    }
  });

  it("returns failure on parse errors", () => {
    const source = "workflow {";
    const result = compile(source);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("compiles workflow with condition using single quotes", () => {
    const source = `workflow test {
      on: push
      job deploy {
        runs_on: ubuntu-latest
        if: github.ref == "refs/heads/main"
        steps: [run("deploy")]
      }
    }`;

    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("if: github.ref == 'refs/heads/main'");
    }
  });
});

describe("agent transforms", () => {
  it("transforms AgentJobNode with basic AgentTaskNode", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Review the code",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "review",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);

    expect(ir.jobs.size).toBe(1);
    const job = ir.jobs.get("review")!
    expect(job.runsOn).toBe("ubuntu-latest");
    expect(job.steps).toHaveLength(1);
    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      name: "review-task",
      uses: "anthropics/claude-code-action@v1",
      with: {
        prompt: "Review the code",
      },
    });
  });

  it("transforms AgentTaskNode with tools config", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Run tests",
      tools: {
        allowed: ["Bash", "Read"],
        disallowed: ["Write"],
      },
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "test-runner",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("test-runner")!

    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: {
        prompt: "Run tests",
        allowed_tools: '["Bash","Read"]',
        disallowed_tools: '["Write"]',
      },
    });
  });

  it("transforms AgentTaskNode with model and max_turns", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Complex analysis",
      model: "claude-sonnet-4-20250514",
      maxTurns: 10,
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "analyze",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("analyze")!

    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: {
        prompt: "Complex analysis",
        model: "claude-sonnet-4-20250514",
        max_turns: 10,
      },
    });
  });

  it("transforms AgentTaskNode with outputArtifact", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Generate report",
      outputArtifact: "report.json",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "reporter",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("reporter")!

    expect(job.steps).toHaveLength(2);
    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: { prompt: "Generate report" },
    });
    expect(job.steps[1]).toMatchObject({
      kind: "upload_artifact",
      name: "Upload report.json",
      uses: "actions/upload-artifact@v4",
      with: {
        name: "report.json",
        path: "report.json",
      },
    });
  });

  it("transforms AgentTaskNode with prompt override", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Default task description",
      prompt: { kind: "literal", value: "Custom prompt text" },
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "custom",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("custom")!

    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: {
        prompt: "Custom prompt text",
      },
    });
  });

  it("transforms AgentJobNode with needs", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Deploy application",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "deploy",
      runsOn: "ubuntu-latest",
      needs: ["build", "test"],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("deploy")!;

    expect(job.needs).toEqual(["build", "test"]);
  });

  it("emits ClaudeCodeStepIR correctly", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Fix the bug",
      model: "claude-sonnet-4-20250514",
      maxTurns: 5,
      tools: { allowed: ["Bash", "Edit"] },
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "bugfix",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("name: bugfix-task");
    expect(yaml).toContain("uses: anthropics/claude-code-action@v1");
    expect(yaml).toContain("prompt: Fix the bug");
    expect(yaml).toContain('allowed_tools: \'["Bash","Edit"]\'');
    expect(yaml).toContain("max_turns: 5");
    expect(yaml).toContain("model: claude-sonnet-4-20250514");
  });

  it("emits UploadArtifactStepIR correctly", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Create artifact",
      outputArtifact: "output.zip",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "artifact-job",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("name: Upload output.zip");
    expect(yaml).toContain("uses: actions/upload-artifact@v4");
    expect(yaml).toContain("name: output.zip");
    expect(yaml).toContain("path: output.zip");
  });
});

describe("job outputs", () => {
  it("transforms job with outputs to IR with outputs", () => {
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
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("build")!;
    expect(job.outputs).toBeDefined();
    expect(job.outputs!.version).toBe("${{ steps.set_outputs.outputs.version }}");
    expect(job.outputs!.sha).toBe("${{ steps.set_outputs.outputs.sha }}");
  });

  it("emits outputs in YAML correctly", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          version: string
        }
        steps: [run("echo hello")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("outputs:");
    expect(yaml).toContain("version: ${{ steps.set_outputs.outputs.version }}");
  });

  it("does not emit outputs block when job has no outputs", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        steps: [run("echo hello")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    const jobSection = yaml.split("build:")[1].split("steps:")[0];
    expect(jobSection).not.toContain("outputs:");
  });
});

describe("concurrency generation", () => {
  it("does not generate concurrency for workflows without cycles", () => {
    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "no-cycles",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [],
      span: { start: 0, end: 100 },
    };

    const ir = transform(workflow);
    expect(ir.concurrency).toBeUndefined();
  });

  it("generates concurrency with cycle key when present", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "test_loop",
      maxIters: 3,
      key: "iteration",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "with-cycle",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    expect(ir.concurrency).toBeDefined();
    expect(ir.concurrency!.group).toBe("${{ inputs._cycle_key || 'iteration' }}");
    expect(ir.concurrency!["cancel-in-progress"]).toBe(false);
  });

  it("generates concurrency with workflow fallback when no key", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "test_loop",
      maxIters: 3,
      key: null,
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "with-cycle",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    expect(ir.concurrency).toBeDefined();
    expect(ir.concurrency!.group).toBe("${{ github.workflow }}-${{ inputs._cycle_phase || 'bootstrap' }}");
    expect(ir.concurrency!["cancel-in-progress"]).toBe(false);
  });

  it("emits concurrency block in YAML output", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "loop",
      maxIters: 3,
      key: "phase",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "cycle-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("concurrency:");
    expect(yaml).toContain("group: ${{ inputs._cycle_key || 'phase' }}");
    expect(yaml).toContain("cancel-in-progress: false");
  });
});

describe("cycle transforms", () => {
  it("transforms a basic cycle into four jobs", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "test_loop",
      maxIters: 3,
      key: "phase",
      until: {
        kind: "guard_js",
        code: "return context.done === true;",
        span: { start: 0, end: 30 },
      },
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "process",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo processing", span: { start: 0, end: 20 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "cycle-test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const cycleJobs = transformCycle(cycle, workflow);

    expect(cycleJobs.size).toBe(4);
    expect(cycleJobs.has("test_loop_hydrate")).toBe(true);
    expect(cycleJobs.has("test_loop_body_process")).toBe(true);
    expect(cycleJobs.has("test_loop_decide")).toBe(true);
    expect(cycleJobs.has("test_loop_dispatch")).toBe(true);
  });

  it("hydrate job has correct structure", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "my_cycle",
      maxIters: null,
      key: "iteration",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const cycleJobs = transformCycle(cycle, workflow);
    const hydrateJob = cycleJobs.get("my_cycle_hydrate")!;

    expect(hydrateJob.runsOn).toBe("ubuntu-latest");
    expect(hydrateJob.outputs).toHaveProperty("phase");
    expect(hydrateJob.steps).toHaveLength(2);
    expect(hydrateJob.steps[0].kind).toBe("download_artifact");
    expect(hydrateJob.steps[1].kind).toBe("script");
  });

  it("body jobs depend on hydrate job", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "loop",
      maxIters: 5,
      key: "step",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "first",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo first", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
          {
            kind: "job",
            name: "second",
            runsOn: "ubuntu-latest",
            needs: ["first"],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo second", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 150 },
      },
      span: { start: 0, end: 250 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 350 },
    };

    const cycleJobs = transformCycle(cycle, workflow);

    const firstJob = cycleJobs.get("loop_body_first")!;
    expect(firstJob.needs).toContain("loop_hydrate");

    const secondJob = cycleJobs.get("loop_body_second")!;
    expect(secondJob.needs).toContain("loop_hydrate");
    expect(secondJob.needs).toContain("loop_body_first");
  });

  it("decide job has guard evaluation and state upload", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "refine",
      maxIters: 10,
      key: "iter",
      until: {
        kind: "guard_js",
        code: "return context.score > 0.9;",
        span: { start: 0, end: 30 },
      },
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "analyze",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo analyze", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const cycleJobs = transformCycle(cycle, workflow);
    const decideJob = cycleJobs.get("refine_decide")!;

    expect(decideJob.needs).toContain("refine_body_analyze");
    expect(decideJob.outputs).toHaveProperty("continue");
    expect(decideJob.steps).toHaveLength(2);

    const evalStep = decideJob.steps[0];
    expect(evalStep.kind).toBe("script");
    if (evalStep.kind === "script") {
      expect(evalStep.run).toContain("context.score > 0.9");
    }

    const uploadStep = decideJob.steps[1];
    expect(uploadStep.kind).toBe("upload_artifact");
  });

  it("dispatch job has conditional execution with max_iters", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "bounded_loop",
      maxIters: 5,
      key: "phase",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const cycleJobs = transformCycle(cycle, workflow);
    const dispatchJob = cycleJobs.get("bounded_loop_dispatch")!;

    expect(dispatchJob.needs).toContain("bounded_loop_decide");
    expect(dispatchJob.needs).toContain("bounded_loop_hydrate");
    expect(dispatchJob.if).toContain("continue == 'true'");
    expect(dispatchJob.if).toContain("< 5");

    const dispatchStep = dispatchJob.steps[0];
    expect(dispatchStep.kind).toBe("script");
    if (dispatchStep.kind === "script") {
      expect(dispatchStep.run).toContain("gh workflow run");
    }
  });

  it("transform adds workflow_dispatch trigger for cycles", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "loop",
      maxIters: 3,
      key: "iter",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);

    expect(ir.on.events).toContain("push");
    expect(ir.on.workflowDispatch).toBeDefined();
    expect(ir.on.workflowDispatch!.inputs.length).toBeGreaterThan(0);

    const iterInput = ir.on.workflowDispatch!.inputs.find((i) => i.name === "iter");
    expect(iterInput).toBeDefined();
    expect(iterInput!.required).toBe(false);
    expect(iterInput!.default).toBe("0");

    const runIdInput = ir.on.workflowDispatch!.inputs.find((i) => i.name === "run_id");
    expect(runIdInput).toBeDefined();
  });

  it("emit produces valid YAML with workflow_dispatch", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "loop",
      maxIters: 3,
      key: "phase",
      until: {
        kind: "guard_js",
        code: "return context.done;",
        span: { start: 0, end: 20 },
      },
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo working", span: { start: 0, end: 15 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "cycle-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("name: cycle-workflow");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("inputs:");
    expect(yaml).toContain("phase:");
    expect(yaml).toContain("run_id:");
    expect(yaml).toContain("loop_hydrate:");
    expect(yaml).toContain("loop_body_work:");
    expect(yaml).toContain("loop_decide:");
    expect(yaml).toContain("loop_dispatch:");
    expect(yaml).toContain("actions/download-artifact@v4");
    expect(yaml).toContain("actions/upload-artifact@v4");
    expect(yaml).toContain("gh workflow run");
  });
});

describe("inlineSchemaToJsonSchema", () => {
  it("transforms primitive string field to JSON Schema", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "name",
          type: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
          span: { start: 0, end: 12 },
        },
      ],
      span: { start: 0, end: 20 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
  });

  it("transforms all primitive types correctly", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "text",
          type: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
          span: { start: 0, end: 12 },
        },
        {
          name: "count",
          type: { kind: "primitive", type: "int", span: { start: 0, end: 3 } },
          span: { start: 0, end: 10 },
        },
        {
          name: "price",
          type: { kind: "primitive", type: "float", span: { start: 0, end: 5 } },
          span: { start: 0, end: 12 },
        },
        {
          name: "active",
          type: { kind: "primitive", type: "bool", span: { start: 0, end: 4 } },
          span: { start: 0, end: 12 },
        },
      ],
      span: { start: 0, end: 100 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        text: { type: "string" },
        count: { type: "integer" },
        price: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["text", "count", "price", "active"],
      additionalProperties: false,
    });
  });

  it("transforms array types", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "tags",
          type: {
            kind: "array",
            elementType: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
            span: { start: 0, end: 10 },
          },
          span: { start: 0, end: 16 },
        },
      ],
      span: { start: 0, end: 30 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["tags"],
      additionalProperties: false,
    });
  });

  it("transforms union with null (nullable type)", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "description",
          type: {
            kind: "union",
            types: [
              { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
              { kind: "null", span: { start: 0, end: 4 } },
            ],
            span: { start: 0, end: 15 },
          },
          span: { start: 0, end: 25 },
        },
      ],
      span: { start: 0, end: 40 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        description: {
          oneOf: [{ type: "string" }, { type: "null" }],
        },
      },
      required: ["description"],
      additionalProperties: false,
    });
  });

  it("transforms string literal enums", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "status",
          type: {
            kind: "union",
            types: [
              { kind: "stringLiteral", value: "pending", span: { start: 0, end: 9 } },
              { kind: "stringLiteral", value: "active", span: { start: 0, end: 8 } },
              { kind: "stringLiteral", value: "done", span: { start: 0, end: 6 } },
            ],
            span: { start: 0, end: 30 },
          },
          span: { start: 0, end: 40 },
        },
      ],
      span: { start: 0, end: 60 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        status: { enum: ["pending", "active", "done"] },
      },
      required: ["status"],
      additionalProperties: false,
    });
  });

  it("transforms nested object types", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "user",
          type: {
            kind: "object",
            fields: [
              {
                name: "id",
                type: { kind: "primitive", type: "int", span: { start: 0, end: 3 } },
                span: { start: 0, end: 8 },
              },
              {
                name: "name",
                type: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
                span: { start: 0, end: 12 },
              },
            ],
            span: { start: 0, end: 30 },
          },
          span: { start: 0, end: 40 },
        },
      ],
      span: { start: 0, end: 60 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
          required: ["id", "name"],
          additionalProperties: false,
        },
      },
      required: ["user"],
      additionalProperties: false,
    });
  });

  it("transforms array of objects", () => {
    const schema: SchemaObjectNode = {
      kind: "object",
      fields: [
        {
          name: "items",
          type: {
            kind: "array",
            elementType: {
              kind: "object",
              fields: [
                {
                  name: "label",
                  type: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
                  span: { start: 0, end: 14 },
                },
                {
                  name: "value",
                  type: { kind: "primitive", type: "int", span: { start: 0, end: 3 } },
                  span: { start: 0, end: 12 },
                },
              ],
              span: { start: 0, end: 35 },
            },
            span: { start: 0, end: 40 },
          },
          span: { start: 0, end: 50 },
        },
      ],
      span: { start: 0, end: 70 },
    };

    const result = inlineSchemaToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "integer" },
            },
            required: ["label", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    });
  });
});

describe("agent task with inline schema", () => {
  it("transforms AgentTaskNode with inline outputSchema to JSON Schema", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Analyze the data",
      outputSchema: {
        kind: "object",
        fields: [
          {
            name: "result",
            type: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
            span: { start: 0, end: 15 },
          },
          {
            name: "score",
            type: { kind: "primitive", type: "float", span: { start: 0, end: 5 } },
            span: { start: 0, end: 13 },
          },
        ],
        span: { start: 0, end: 40 },
      },
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "analyzer",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("analyzer")!;

    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: {
        prompt: "Analyze the data",
        output_schema: {
          type: "object",
          properties: {
            result: { type: "string" },
            score: { type: "number" },
          },
          required: ["result", "score"],
          additionalProperties: false,
        },
      },
    });
  });

  it("emits output_schema correctly in YAML", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Process request",
      outputSchema: {
        kind: "object",
        fields: [
          {
            name: "status",
            type: {
              kind: "union",
              types: [
                { kind: "stringLiteral", value: "success", span: { start: 0, end: 9 } },
                { kind: "stringLiteral", value: "error", span: { start: 0, end: 7 } },
              ],
              span: { start: 0, end: 20 },
            },
            span: { start: 0, end: 30 },
          },
          {
            name: "data",
            type: {
              kind: "array",
              elementType: { kind: "primitive", type: "string", span: { start: 0, end: 6 } },
              span: { start: 0, end: 10 },
            },
            span: { start: 0, end: 18 },
          },
        ],
        span: { start: 0, end: 60 },
      },
      consumes: [],
      span: { start: 0, end: 150 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "processor",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 250 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "schema-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 350 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("output_schema:");
    expect(yaml).toContain("type: object");
    expect(yaml).toContain("properties:");
    expect(yaml).toContain("status:");
    expect(yaml).toContain("enum:");
    expect(yaml).toContain("- success");
    expect(yaml).toContain("- error");
    expect(yaml).toContain("data:");
    expect(yaml).toContain("type: array");
    expect(yaml).toContain("items:");
    expect(yaml).toContain("required:");
    expect(yaml).toContain("additionalProperties: false");
  });

  it("handles string schema path reference", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Use external schema",
      outputSchema: "./schemas/my-schema.json",
      consumes: [],
      span: { start: 0, end: 80 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "external-schema-job",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 160 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "ref-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 240 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("external-schema-job")!;

    expect(job.steps[0]).toMatchObject({
      kind: "claude_code",
      with: {
        prompt: "Use external schema",
        output_schema: { $ref: "./schemas/my-schema.json" },
      },
    });
  });
});

describe("matrix job transforms", () => {
  it("transforms matrix job with include to IR", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        include [
          { os: ubuntu-latest, node: 22, experimental: true }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("test")!;
    expect(job.strategy).toBeDefined();
    expect(job.strategy!.matrix).toEqual({
      os: ["ubuntu-latest", "macos-latest"],
      node: [18, 20],
    });
    expect(job.strategy!.include).toHaveLength(1);
    expect(job.strategy!.include![0]).toEqual({
      os: "ubuntu-latest",
      node: 22,
      experimental: true,
    });
  });

  it("transforms matrix job with exclude to IR", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        exclude [
          { os: macos-latest, node: 18 }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("test")!;
    expect(job.strategy).toBeDefined();
    expect(job.strategy!.exclude).toHaveLength(1);
    expect(job.strategy!.exclude![0]).toEqual({
      os: "macos-latest",
      node: 18,
    });
  });

  it("transforms matrix job with both include and exclude to IR", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        include [
          { os: ubuntu-latest, node: 22, experimental: true }
        ]
        exclude [
          { os: macos-latest, node: 18 }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("test")!;
    expect(job.strategy!.include).toHaveLength(1);
    expect(job.strategy!.exclude).toHaveLength(1);
  });

  it("emits matrix job with include in YAML", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        include [
          { os: ubuntu-latest, node: 22, experimental: true }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("strategy:");
    expect(yaml).toContain("matrix:");
    expect(yaml).toContain("include:");
    expect(yaml).toContain("os: ubuntu-latest");
    expect(yaml).toContain("node: 22");
    expect(yaml).toContain("experimental: true");
  });

  it("emits matrix job with exclude in YAML", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        exclude [
          { os: macos-latest, node: 18 }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("strategy:");
    expect(yaml).toContain("matrix:");
    expect(yaml).toContain("exclude:");
    expect(yaml).toContain("os: macos-latest");
    expect(yaml).toContain("node: 18");
  });

  it("emits full matrix job with include and exclude matching target YAML", () => {
    const source = `workflow test {
      on: push
      job test matrix {
        axes {
          os: [ubuntu-latest, macos-latest]
          node: [18, 20]
        }
        include [
          { os: ubuntu-latest, node: 22, experimental: true }
        ]
        exclude [
          { os: macos-latest, node: 18 }
        ]
        steps: [run("npm test")]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("strategy:");
    expect(yaml).toContain("matrix:");
    expect(yaml).toContain("- ubuntu-latest");
    expect(yaml).toContain("- macos-latest");
    expect(yaml).toContain("- 18");
    expect(yaml).toContain("- 20");
    expect(yaml).toContain("include:");
    expect(yaml).toContain("exclude:");
  });
});

describe("guard_js step transforms", () => {
  it("transforms guard_js step to ScriptStepIR", () => {
    const guardStep: GuardJsStepNode = {
      kind: "guard_js_step",
      id: "decide",
      code: "return context.event.issue?.labels?.some(l => l.name === 'priority');",
      span: { start: 0, end: 100 },
    };

    const job: JobNode = {
      kind: "job",
      name: "guard",
      runsOn: "ubuntu-latest",
      needs: [],
      condition: null,
      outputs: [],
      steps: [guardStep],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "guard-test",
      trigger: { kind: "trigger", events: ["issues"], span: { start: 0, end: 10 } },
      jobs: [job],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const irJob = ir.jobs.get("guard")!;

    expect(irJob.steps).toHaveLength(1);
    expect(irJob.steps[0]).toMatchObject({
      kind: "script",
      name: "Evaluate guard",
      id: "decide",
      shell: "bash",
    });
  });

  it("emits guard_js step as node script with GITHUB_OUTPUT", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "decide" guard_js """
            return context.event.issue?.labels?.some(l => l.name === 'priority');
          """
        ]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("name: Evaluate guard");
    expect(yaml).toContain("id: decide");
    expect(yaml).toContain("run:");
    expect(yaml).toContain("node -e");
    expect(yaml).toContain("GITHUB_OUTPUT");
    expect(yaml).toContain("shell: bash");
  });

  it("transforms guard_js step with branch check logic", () => {
    const source = `workflow test {
      on: push
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check_branch" guard_js """
            return context.ref === 'refs/heads/main';
          """
        ]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);

    const job = ir.jobs.get("guard")!;
    expect(job.steps[0]).toMatchObject({
      kind: "script",
      id: "check_branch",
    });
  });

  it("compiles workflow with guard_js step and outputs", () => {
    const source = `workflow test {
  on: issues
  job guard {
    runs_on: ubuntu-latest
    outputs: {
      should_run: bool
    }
    steps: [
      step "decide" guard_js """
        return context.event.action === 'opened';
      """
    ]
  }
  job process {
    runs_on: ubuntu-latest
    needs: guard
    steps: [
      run("echo Processing...")
    ]
  }
}`;
    const result = compile(source);
    if (!result.success) {
      console.log("Diagnostics:", JSON.stringify(result.diagnostics, null, 2));
    }
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("guard:");
      expect(result.value).toContain("process:");
      expect(result.value).toContain("needs:");
      expect(result.value).toContain("id: decide");
    }
  });

  it("guard_js step includes context with event and ref", () => {
    const source = `workflow test {
      on: push
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return context.event && context.ref;
          """
        ]
      }
    }`;
    const tree = parse(source);
    const ast = buildAST(tree, source);
    const ir = transform(ast!);
    const yaml = emit(ir);

    expect(yaml).toContain("GITHUB_EVENT_PATH");
    expect(yaml).toContain("GITHUB_REF");
    expect(yaml).toContain("context.event && context.ref");
  });
});

describe("guards namespace in guard_js", () => {
  it("injects guards namespace into generated guard script", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.hasLabel('priority');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("const guards = {");
      expect(result.value).toContain("hasLabel(name)");
    }
  });

  it("guards.hasLabel helper appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.hasLabel('bug');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("guards.hasLabel('bug')");
      expect(result.value).toContain("context.event?.issue?.labels || context.event?.pull_request?.labels");
    }
  });

  it("guards.hasAnyLabel helper appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.hasAnyLabel('bug', 'feature');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("hasAnyLabel(...names)");
      expect(result.value).toContain("guards.hasAnyLabel('bug', 'feature')");
    }
  });

  it("guards.hasAllLabels helper appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.hasAllLabels('reviewed', 'approved');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("hasAllLabels(...names)");
    }
  });

  it("guards.isBranch helper appears in output", () => {
    const source = `workflow test {
      on: push
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.isBranch('main');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isBranch(name)");
      expect(result.value).toContain("refs/heads/");
    }
  });

  it("guards.isDefaultBranch helper appears in output", () => {
    const source = `workflow test {
      on: push
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.isDefaultBranch();
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isDefaultBranch()");
      expect(result.value).toContain("context.event?.repository?.default_branch");
    }
  });

  it("guards.isPullRequest helper appears in output", () => {
    const source = `workflow test {
      on: pull_request
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.isPullRequest();
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isPullRequest()");
      expect(result.value).toContain("context.event?.pull_request");
    }
  });

  it("guards.isIssue helper appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.isIssue();
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isIssue()");
    }
  });

  it("guards.isDraft helper appears in output", () => {
    const source = `workflow test {
      on: pull_request
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return !guards.isDraft();
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isDraft()");
      expect(result.value).toContain("context.event?.pull_request?.draft");
    }
  });

  it("guards.isAction helper appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.isAction('opened');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("isAction(action)");
      expect(result.value).toContain("context.event?.action === action");
    }
  });

  it("guards.actor getter appears in output", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.actor === 'dependabot[bot]';
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("get actor()");
      expect(result.value).toContain("context.event?.sender?.login");
    }
  });

  it("guards.event getter provides access to context.event", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.event.action === 'opened';
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("get event() { return context.event; }");
    }
  });

  it("guards.ref getter provides access to context.ref", () => {
    const source = `workflow test {
      on: push
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.ref.startsWith('refs/heads/');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("get ref() { return context.ref; }");
    }
  });

  it("guards.inputs getter provides access to context.inputs", () => {
    const source = `workflow test {
      on: workflow_dispatch
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.inputs.environment === 'production';
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("get inputs() { return context.inputs; }");
    }
  });

  it("guards namespace can be combined with raw context access", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check" guard_js """
            return guards.hasLabel('priority') && context.event.issue.title.includes('[urgent]');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("guards.hasLabel('priority')");
      expect(result.value).toContain("context.event.issue.title");
    }
  });
});

describe("guard_js auto-generated outputs", () => {
  it("auto-generates output for job with guard_js step", () => {
    const guardStep: GuardJsStepNode = {
      kind: "guard_js_step",
      id: "check_labels",
      code: "return context.event.issue?.labels?.some(l => l.name === 'priority');",
      span: { start: 0, end: 100 },
    };

    const job: JobNode = {
      kind: "job",
      name: "guard",
      runsOn: "ubuntu-latest",
      needs: [],
      condition: null,
      outputs: [],
      steps: [guardStep],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "guard-test",
      trigger: { kind: "trigger", events: ["issues"], span: { start: 0, end: 10 } },
      jobs: [job],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const irJob = ir.jobs.get("guard")!;

    expect(irJob.outputs).toBeDefined();
    expect(irJob.outputs!.check_labels_result).toBe("${{ steps.check_labels.outputs.result }}");
  });

  it("auto-generates multiple outputs for multiple guard_js steps", () => {
    const guardStep1: GuardJsStepNode = {
      kind: "guard_js_step",
      id: "check_labels",
      code: "return context.event.issue?.labels?.some(l => l.name === 'priority');",
      span: { start: 0, end: 100 },
    };

    const guardStep2: GuardJsStepNode = {
      kind: "guard_js_step",
      id: "check_author",
      code: "return context.event.issue?.user?.login === 'admin';",
      span: { start: 0, end: 100 },
    };

    const job: JobNode = {
      kind: "job",
      name: "guard",
      runsOn: "ubuntu-latest",
      needs: [],
      condition: null,
      outputs: [],
      steps: [guardStep1, guardStep2],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "guard-test",
      trigger: { kind: "trigger", events: ["issues"], span: { start: 0, end: 10 } },
      jobs: [job],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const irJob = ir.jobs.get("guard")!;

    expect(irJob.outputs).toBeDefined();
    expect(irJob.outputs!.check_labels_result).toBe("${{ steps.check_labels.outputs.result }}");
    expect(irJob.outputs!.check_author_result).toBe("${{ steps.check_author.outputs.result }}");
  });

  it("merges auto-generated outputs with user-declared outputs", () => {
    const guardStep: GuardJsStepNode = {
      kind: "guard_js_step",
      id: "check_labels",
      code: "return context.event.issue?.labels?.some(l => l.name === 'priority');",
      span: { start: 0, end: 100 },
    };

    const job: JobNode = {
      kind: "job",
      name: "guard",
      runsOn: "ubuntu-latest",
      needs: [],
      condition: null,
      outputs: [
        { name: "custom_output", type: "string", span: { start: 0, end: 10 } },
      ],
      steps: [guardStep],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "guard-test",
      trigger: { kind: "trigger", events: ["issues"], span: { start: 0, end: 10 } },
      jobs: [job],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const irJob = ir.jobs.get("guard")!;

    expect(irJob.outputs).toBeDefined();
    expect(irJob.outputs!.check_labels_result).toBe("${{ steps.check_labels.outputs.result }}");
    expect(irJob.outputs!.custom_output).toBe("${{ steps.set_outputs.outputs.custom_output }}");
  });

  it("does not generate outputs for jobs without guard_js steps", () => {
    const job: JobNode = {
      kind: "job",
      name: "build",
      runsOn: "ubuntu-latest",
      needs: [],
      condition: null,
      outputs: [],
      steps: [{ kind: "run", command: "echo hi", span: { start: 0, end: 10 } }],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "build-test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [job],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const irJob = ir.jobs.get("build")!;

    expect(irJob.outputs).toBeUndefined();
  });

  it("emits auto-generated outputs in YAML correctly", () => {
    const source = `workflow test {
      on: issues
      job guard {
        runs_on: ubuntu-latest
        steps: [
          step "check_labels" guard_js """
            return context.event.issue?.labels?.some(l => l.name === 'priority');
          """
        ]
      }
    }`;
    const result = compile(source);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("outputs:");
      expect(result.value).toContain("check_labels_result: ${{ steps.check_labels.outputs.result }}");
    }
  });
});

describe("generateMatrixFingerprint", () => {
  it("generates fingerprint with single axis", () => {
    const axes = { os: ["ubuntu-latest", "macos-latest"] };
    const fingerprint = generateMatrixFingerprint(axes);
    expect(fingerprint).toBe("${{ matrix.os }}");
  });

  it("generates fingerprint with multiple axes in sorted order", () => {
    const axes = {
      os: ["ubuntu-latest", "macos-latest"],
      node: [18, 20],
    };
    const fingerprint = generateMatrixFingerprint(axes);
    expect(fingerprint).toBe("${{ matrix.node }}-${{ matrix.os }}");
  });

  it("generates fingerprint with axes in alphabetical order regardless of input order", () => {
    const axes = {
      zoo: ["a", "b"],
      alpha: [1, 2],
      middle: ["x", "y"],
    };
    const fingerprint = generateMatrixFingerprint(axes);
    expect(fingerprint).toBe("${{ matrix.alpha }}-${{ matrix.middle }}-${{ matrix.zoo }}");
  });

  it("generates empty string for empty axes", () => {
    const axes = {};
    const fingerprint = generateMatrixFingerprint(axes);
    expect(fingerprint).toBe("");
  });
});

describe("matrix job with agent task artifact fingerprinting", () => {
  it("appends matrix fingerprint to outputArtifact name in matrix job", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Run tests",
      outputArtifact: "test_results",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const matrixJob: MatrixJobNode = {
      kind: "matrix_job",
      name: "test",
      axes: {
        os: ["ubuntu-latest", "macos-latest"],
        node: [18, 20],
      },
      runsOn: null,
      needs: [],
      condition: null,
      outputs: [],
      steps: [agentTask],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [matrixJob],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("test")!;

    expect(job.steps).toHaveLength(2);
    expect(job.steps[1]).toMatchObject({
      kind: "upload_artifact",
      name: "Upload test_results",
      with: {
        name: "test_results-${{ matrix.node }}-${{ matrix.os }}",
        path: "test_results",
      },
    });
  });

  it("emits fingerprinted artifact name in YAML for matrix job", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Build package",
      outputArtifact: "dist",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const matrixJob: MatrixJobNode = {
      kind: "matrix_job",
      name: "build",
      axes: {
        os: ["ubuntu-latest", "windows-latest"],
      },
      runsOn: null,
      needs: [],
      condition: null,
      outputs: [],
      steps: [agentTask],
      span: { start: 0, end: 200 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "build-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [matrixJob],
      cycles: [],
      span: { start: 0, end: 300 },
    };

    const ir = transform(workflow);
    const yaml = emit(ir);

    expect(yaml).toContain("name: dist-${{ matrix.os }}");
    expect(yaml).toContain("path: dist");
  });

  it("does not fingerprint artifact names in non-matrix jobs", () => {
    const agentTask: AgentTaskNode = {
      kind: "agent_task",
      taskDescription: "Generate report",
      outputArtifact: "report.json",
      consumes: [],
      span: { start: 0, end: 50 },
    };

    const agentJob: AgentJobNode = {
      kind: "agent_job",
      name: "reporter",
      runsOn: "ubuntu-latest",
      needs: [],
      outputs: [],
      steps: [agentTask],
      consumes: [],
      span: { start: 0, end: 100 },
    };

    const workflow: WorkflowNode = {
      kind: "workflow",
      name: "test-workflow",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [agentJob],
      cycles: [],
      span: { start: 0, end: 200 },
    };

    const ir = transform(workflow);
    const job = ir.jobs.get("reporter")!;

    expect(job.steps[1]).toMatchObject({
      kind: "upload_artifact",
      with: {
        name: "report.json",
        path: "report.json",
      },
    });
  });
});
