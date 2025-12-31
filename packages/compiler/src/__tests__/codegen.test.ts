import { describe, it, expect } from "vitest";
import { parse } from "@workpipe/lang";
import { buildAST } from "../ast/index.js";
import { transform, transformCycle, emit, serializeExpression } from "../codegen/index.js";
import { compile } from "../index.js";
import type { ExpressionNode, AgentJobNode, AgentTaskNode, CycleNode } from "../ast/types.js";
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
