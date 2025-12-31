import { describe, it, expect } from "vitest";
import { validateCycleTermination } from "../semantics/index.js";
import { transformCycle } from "../codegen/index.js";
import { compile } from "../index.js";
import type { CycleNode, WorkflowNode } from "../ast/types.js";

describe("validateCycleTermination", () => {
  it("returns WP6005 warning when cycle has 'until' but no 'max_iters'", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "risky_loop",
      maxIters: null,
      key: "phase",
      until: {
        kind: "guard_js",
        code: "return context.done === true;",
        span: { start: 50, end: 80 },
      },
      body: {
        kind: "cycle_body",
        jobs: [],
        span: { start: 100, end: 150 },
      },
      span: { start: 0, end: 200 },
    };

    const diagnostics = validateCycleTermination(cycle);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("WP6005");
    expect(diagnostics[0].severity).toBe("warning");
    expect(diagnostics[0].message).toContain("risky_loop");
    expect(diagnostics[0].message).toContain("max_iters");
    expect(diagnostics[0].hint).toContain("infinite loops");
  });

  it("returns no warnings when cycle has both 'until' and 'max_iters'", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "safe_loop",
      maxIters: 10,
      key: "phase",
      until: {
        kind: "guard_js",
        code: "return context.done === true;",
        span: { start: 50, end: 80 },
      },
      body: {
        kind: "cycle_body",
        jobs: [],
        span: { start: 100, end: 150 },
      },
      span: { start: 0, end: 200 },
    };

    const diagnostics = validateCycleTermination(cycle);

    expect(diagnostics).toHaveLength(0);
  });

  it("returns no warnings when cycle has only 'max_iters'", () => {
    const cycle: CycleNode = {
      kind: "cycle",
      name: "bounded_loop",
      maxIters: 5,
      key: "phase",
      until: null,
      body: {
        kind: "cycle_body",
        jobs: [],
        span: { start: 100, end: 150 },
      },
      span: { start: 0, end: 200 },
    };

    const diagnostics = validateCycleTermination(cycle);

    expect(diagnostics).toHaveLength(0);
  });
});

describe("decide job termination_reason output", () => {
  function createTestCycle(
    name: string,
    maxIters: number | null,
    guardCode: string | null
  ): CycleNode {
    return {
      kind: "cycle",
      name,
      maxIters,
      key: "phase",
      until: guardCode
        ? { kind: "guard_js", code: guardCode, span: { start: 0, end: 30 } }
        : null,
      body: {
        kind: "cycle_body",
        jobs: [
          {
            kind: "job",
            name: "work",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            steps: [{ kind: "run", command: "echo work", span: { start: 0, end: 10 } }],
            span: { start: 0, end: 50 },
          },
        ],
        span: { start: 0, end: 100 },
      },
      span: { start: 0, end: 200 },
    };
  }

  function createTestWorkflow(cycle: CycleNode): WorkflowNode {
    return {
      kind: "workflow",
      name: "test",
      trigger: { kind: "trigger", events: ["push"], span: { start: 0, end: 10 } },
      jobs: [],
      cycles: [cycle],
      span: { start: 0, end: 300 },
    };
  }

  it("decide job outputs termination_reason", () => {
    const cycle = createTestCycle("loop", 5, "return context.done === true;");
    const workflow = createTestWorkflow(cycle);
    const cycleJobs = transformCycle(cycle, workflow);

    const decideJob = cycleJobs.get("loop_decide")!;

    expect(decideJob.outputs).toHaveProperty("termination_reason");
    expect(decideJob.outputs!.termination_reason).toContain("termination_reason");
  });

  it("decide job script sets termination_reason to guard_satisfied when guard returns true", () => {
    const cycle = createTestCycle("loop", 5, "return context.done === true;");
    const workflow = createTestWorkflow(cycle);
    const cycleJobs = transformCycle(cycle, workflow);

    const decideJob = cycleJobs.get("loop_decide")!;
    const evalStep = decideJob.steps[0];

    expect(evalStep.kind).toBe("script");
    if (evalStep.kind === "script") {
      expect(evalStep.run).toContain("guard_satisfied");
      expect(evalStep.run).toContain("termination_reason");
    }
  });

  it("decide job script sets termination_reason to max_iterations when limit reached", () => {
    const cycle = createTestCycle("loop", 3, null);
    const workflow = createTestWorkflow(cycle);
    const cycleJobs = transformCycle(cycle, workflow);

    const decideJob = cycleJobs.get("loop_decide")!;
    const evalStep = decideJob.steps[0];

    expect(evalStep.kind).toBe("script");
    if (evalStep.kind === "script") {
      expect(evalStep.run).toContain("max_iterations");
      expect(evalStep.run).toContain("maxIters = 3");
    }
  });

  it("decide job script sets termination_reason to continue when neither condition met", () => {
    const cycle = createTestCycle("loop", 10, "return false;");
    const workflow = createTestWorkflow(cycle);
    const cycleJobs = transformCycle(cycle, workflow);

    const decideJob = cycleJobs.get("loop_decide")!;
    const evalStep = decideJob.steps[0];

    expect(evalStep.kind).toBe("script");
    if (evalStep.kind === "script") {
      expect(evalStep.run).toContain("terminationReason = 'continue'");
    }
  });

  it("decide job script writes termination_reason to file and output", () => {
    const cycle = createTestCycle("loop", 5, "return context.done;");
    const workflow = createTestWorkflow(cycle);
    const cycleJobs = transformCycle(cycle, workflow);

    const decideJob = cycleJobs.get("loop_decide")!;
    const evalStep = decideJob.steps[0];

    expect(evalStep.kind).toBe("script");
    if (evalStep.kind === "script") {
      expect(evalStep.run).toContain("termination_reason.txt");
      expect(evalStep.run).toContain("TERMINATION_REASON=$(cat .cycle-state/termination_reason.txt)");
      expect(evalStep.run).toContain('echo "termination_reason=$TERMINATION_REASON" >> $GITHUB_OUTPUT');
    }
  });
});

describe("compile integration with WP6005", () => {
  it("returns WP6005 warning for cycle with only until", () => {
    const source = `workflow test {
      on: push
      cycle risky {
        until guard_js """return context.done;"""
        body {
          job work {
            runs_on: ubuntu-latest
            steps: [run("echo work")]
          }
        }
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const warnings = result.diagnostics.filter((d) => d.severity === "warning");
    expect(warnings.some((w) => w.code === "WP6005")).toBe(true);
    expect(warnings.some((w) => w.message.includes("risky"))).toBe(true);
  });

  it("returns no WP6005 warning for cycle with both until and max_iters", () => {
    const source = `workflow test {
      on: push
      cycle safe {
        max_iters = 10
        until guard_js """return context.done;"""
        body {
          job work {
            runs_on: ubuntu-latest
            steps: [run("echo work")]
          }
        }
      }
    }`;

    const result = compile(source);

    expect(result.success).toBe(true);
    const wp6005Warnings = result.diagnostics.filter((d) => d.code === "WP6005");
    expect(wp6005Warnings).toHaveLength(0);
  });
});
