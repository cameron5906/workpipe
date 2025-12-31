import { describe, it, expect } from "vitest";
import {
  validateMatrixJobs,
  calculateMatrixJobCount,
} from "../semantics/matrix-validation.js";
import type {
  WorkflowNode,
  MatrixJobNode,
  MatrixCombination,
  CycleNode,
} from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10) {
  return { start, end };
}

function createMatrixJob(
  name: string,
  axes: Record<string, readonly (string | number)[]>,
  options: {
    include?: readonly MatrixCombination[];
    exclude?: readonly MatrixCombination[];
  } = {}
): MatrixJobNode {
  return {
    kind: "matrix_job",
    name,
    axes,
    include: options.include,
    exclude: options.exclude,
    runsOn: "ubuntu-latest",
    needs: [],
    condition: null,
    outputs: [],
    steps: [{ kind: "run", command: "echo test", span: createSpan() }],
    span: createSpan(0, 50),
  };
}

function createWorkflow(
  jobs: MatrixJobNode[] = [],
  cycles: CycleNode[] = []
): WorkflowNode {
  return {
    kind: "workflow",
    name: "test",
    trigger: { kind: "trigger", events: ["push"], span: createSpan() },
    jobs,
    cycles,
    span: createSpan(0, 100),
  };
}

function createCycle(name: string, jobs: MatrixJobNode[]): CycleNode {
  return {
    kind: "cycle",
    name,
    maxIters: 5,
    key: "phase",
    until: null,
    body: {
      kind: "cycle_body",
      jobs,
      span: createSpan(),
    },
    span: createSpan(),
  };
}

describe("calculateMatrixJobCount", () => {
  describe("basic Cartesian product", () => {
    it("calculates 3x3x3 = 27 jobs", () => {
      const job = createMatrixJob("test", {
        os: ["ubuntu", "windows", "macos"],
        node: [14, 16, 18],
        mode: ["dev", "prod", "test"],
      });

      expect(calculateMatrixJobCount(job)).toBe(27);
    });

    it("calculates 16x16 = 256 jobs (exact limit)", () => {
      const values = Array.from({ length: 16 }, (_, i) => i);
      const job = createMatrixJob("test", {
        a: values,
        b: values,
      });

      expect(calculateMatrixJobCount(job)).toBe(256);
    });

    it("calculates 17x16 = 272 jobs (over limit)", () => {
      const a = Array.from({ length: 17 }, (_, i) => i);
      const b = Array.from({ length: 16 }, (_, i) => i);
      const job = createMatrixJob("test", {
        a,
        b,
      });

      expect(calculateMatrixJobCount(job)).toBe(272);
    });

    it("calculates 15x15 = 225 jobs (approaching limit)", () => {
      const values = Array.from({ length: 15 }, (_, i) => i);
      const job = createMatrixJob("test", {
        a: values,
        b: values,
      });

      expect(calculateMatrixJobCount(job)).toBe(225);
    });

    it("handles single axis", () => {
      const job = createMatrixJob("test", {
        os: ["ubuntu", "windows", "macos"],
      });

      expect(calculateMatrixJobCount(job)).toBe(3);
    });

    it("handles empty axes", () => {
      const job = createMatrixJob("test", {});

      expect(calculateMatrixJobCount(job)).toBe(0);
    });

    it("handles axis with single value", () => {
      const job = createMatrixJob("test", {
        os: ["ubuntu"],
        node: [18],
      });

      expect(calculateMatrixJobCount(job)).toBe(1);
    });
  });

  describe("include effects", () => {
    it("adds jobs for include entries", () => {
      const job = createMatrixJob(
        "test",
        {
          os: ["ubuntu", "windows"],
          node: [16, 18],
        },
        {
          include: [
            { os: "macos", node: 18 },
            { os: "macos", node: 20 },
          ],
        }
      );

      expect(calculateMatrixJobCount(job)).toBe(6); // 2x2 + 2 = 6
    });

    it("handles include with empty base axes", () => {
      const job = createMatrixJob(
        "test",
        {},
        {
          include: [
            { os: "ubuntu", node: 16 },
            { os: "windows", node: 18 },
          ],
        }
      );

      expect(calculateMatrixJobCount(job)).toBe(2);
    });
  });

  describe("exclude effects", () => {
    it("removes jobs for exclude entries", () => {
      const job = createMatrixJob(
        "test",
        {
          os: ["ubuntu", "windows", "macos"],
          node: [16, 18],
        },
        {
          exclude: [
            { os: "macos", node: 16 },
            { os: "windows", node: 16 },
          ],
        }
      );

      expect(calculateMatrixJobCount(job)).toBe(4); // 3x2 - 2 = 4
    });

    it("clamps to zero when exclude exceeds count", () => {
      const job = createMatrixJob(
        "test",
        {
          os: ["ubuntu"],
          node: [16],
        },
        {
          exclude: [
            { os: "ubuntu", node: 16 },
            { os: "ubuntu", node: 18 },
            { os: "windows", node: 16 },
          ],
        }
      );

      expect(calculateMatrixJobCount(job)).toBe(0); // max(0, 1 - 3)
    });
  });

  describe("combined include and exclude", () => {
    it("correctly combines include and exclude", () => {
      const job = createMatrixJob(
        "test",
        {
          os: ["ubuntu", "windows"],
          node: [16, 18],
        },
        {
          include: [{ os: "macos", node: 18 }],
          exclude: [{ os: "windows", node: 16 }],
        }
      );

      expect(calculateMatrixJobCount(job)).toBe(4); // 2x2 + 1 - 1 = 4
    });
  });
});

describe("validateMatrixJobs", () => {
  describe("WP4001 - Matrix exceeds 256-job limit", () => {
    it("returns warning (not error) for exactly 256 jobs", () => {
      const values = Array.from({ length: 16 }, (_, i) => i);
      const job = createMatrixJob("test", { a: values, b: values });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002"); // Warning, not error (256 > 200 but <= 256)
      expect(diagnostics[0].severity).toBe("warning");
    });

    it("returns error for 257 jobs", () => {
      const a = Array.from({ length: 257 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4001");
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("test");
      expect(diagnostics[0].message).toContain("257");
      expect(diagnostics[0].message).toContain("256-job limit");
    });

    it("returns error for 17x16 = 272 jobs", () => {
      const a = Array.from({ length: 17 }, (_, i) => i);
      const b = Array.from({ length: 16 }, (_, i) => i);
      const job = createMatrixJob("build", { a, b });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4001");
      expect(diagnostics[0].message).toContain("build");
      expect(diagnostics[0].message).toContain("272");
    });

    it("includes cycle name in error message for matrix job in cycle", () => {
      const a = Array.from({ length: 300 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const cycle = createCycle("deploy_loop", [job]);
      const workflow = createWorkflow([], [cycle]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4001");
      expect(diagnostics[0].message).toContain("deploy_loop");
    });
  });

  describe("WP4002 - Matrix approaching limit (warning)", () => {
    it("returns no diagnostic for 200 jobs (exactly at warning threshold)", () => {
      const a = Array.from({ length: 200 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns warning for 201 jobs", () => {
      const a = Array.from({ length: 201 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002");
      expect(diagnostics[0].severity).toBe("warning");
      expect(diagnostics[0].message).toContain("test");
      expect(diagnostics[0].message).toContain("201");
      expect(diagnostics[0].message).toContain("approaching");
    });

    it("returns warning for 15x15 = 225 jobs", () => {
      const values = Array.from({ length: 15 }, (_, i) => i);
      const job = createMatrixJob("matrix_test", { a: values, b: values });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002");
      expect(diagnostics[0].severity).toBe("warning");
      expect(diagnostics[0].message).toContain("matrix_test");
      expect(diagnostics[0].message).toContain("225");
    });

    it("includes cycle name in warning for matrix job in cycle", () => {
      const a = Array.from({ length: 210 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const cycle = createCycle("review_loop", [job]);
      const workflow = createWorkflow([], [cycle]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002");
      expect(diagnostics[0].message).toContain("review_loop");
    });
  });

  describe("boundary conditions", () => {
    it("returns no diagnostic for 255 jobs (one below limit)", () => {
      const a = Array.from({ length: 255 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002"); // Warning only (255 > 200)
    });

    it("returns no diagnostic at all for 199 jobs", () => {
      const a = Array.from({ length: 199 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns error (not warning) for 256+ jobs", () => {
      const a = Array.from({ length: 300 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4001");
      expect(diagnostics[0].severity).toBe("error");
    });
  });

  describe("include/exclude effects on validation", () => {
    it("include pushes count over limit", () => {
      const values = Array.from({ length: 16 }, (_, i) => i);
      const job = createMatrixJob(
        "test",
        { a: values, b: values },
        {
          include: [{ a: 99, b: 99 }], // 256 + 1 = 257
        }
      );
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4001");
    });

    it("exclude brings count under limit", () => {
      const a = Array.from({ length: 17 }, (_, i) => i);
      const b = Array.from({ length: 16 }, (_, i) => i);
      const excludes: MatrixCombination[] = Array.from(
        { length: 17 },
        (_, i) => ({ a: i, b: 0 })
      );

      const job = createMatrixJob("test", { a, b }, { exclude: excludes });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      // 17*16 - 17 = 272 - 17 = 255
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].code).toBe("WP4002"); // Warning, not error
    });
  });

  describe("multiple matrix jobs", () => {
    it("validates all matrix jobs in workflow", () => {
      const over = Array.from({ length: 300 }, (_, i) => i);
      const warning = Array.from({ length: 210 }, (_, i) => i);
      const ok = Array.from({ length: 10 }, (_, i) => i);

      const workflow = createWorkflow([
        createMatrixJob("over_limit", { a: over }),
        createMatrixJob("warning_level", { a: warning }),
        createMatrixJob("under_threshold", { a: ok }),
      ]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics.find((d) => d.code === "WP4001")).toBeDefined();
      expect(diagnostics.find((d) => d.code === "WP4002")).toBeDefined();
    });

    it("validates matrix jobs in multiple cycles", () => {
      const over = Array.from({ length: 300 }, (_, i) => i);

      const workflow = createWorkflow(
        [],
        [
          createCycle("cycle1", [createMatrixJob("job1", { a: over })]),
          createCycle("cycle2", [createMatrixJob("job2", { a: over })]),
        ]
      );

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(2);
      expect(
        diagnostics.some((d) => d.message.includes("cycle1"))
      ).toBe(true);
      expect(
        diagnostics.some((d) => d.message.includes("cycle2"))
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns no diagnostics for workflow with no jobs", () => {
      const workflow = createWorkflow([], []);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no diagnostics for small matrix", () => {
      const job = createMatrixJob("test", {
        os: ["ubuntu", "windows"],
        node: [16, 18],
      });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("returns no diagnostics for empty matrix", () => {
      const job = createMatrixJob("test", {});
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(0);
    });

    it("handles mixed job types (only validates matrix jobs)", () => {
      const matrixJob = createMatrixJob("matrix", {
        a: Array.from({ length: 300 }, (_, i) => i),
      });

      const workflow: WorkflowNode = {
        kind: "workflow",
        name: "test",
        trigger: { kind: "trigger", events: ["push"], span: createSpan() },
        jobs: [
          {
            kind: "job",
            name: "regular",
            runsOn: "ubuntu-latest",
            needs: [],
            condition: null,
            outputs: [],
            steps: [{ kind: "run", command: "echo test", span: createSpan() }],
            span: createSpan(),
          },
          matrixJob,
        ],
        cycles: [],
        span: createSpan(0, 100),
      };

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain("matrix");
    });
  });

  describe("hint messages", () => {
    it("provides helpful hint for error", () => {
      const a = Array.from({ length: 300 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics[0].hint).toContain("Reduce");
      expect(diagnostics[0].hint).toContain("300");
      expect(diagnostics[0].hint).toContain("256");
    });

    it("provides helpful hint for warning", () => {
      const a = Array.from({ length: 210 }, (_, i) => i);
      const job = createMatrixJob("test", { a });
      const workflow = createWorkflow([job]);

      const diagnostics = validateMatrixJobs(workflow);

      expect(diagnostics[0].hint).toContain("reducing");
      expect(diagnostics[0].hint).toContain("210");
      expect(diagnostics[0].hint).toContain("200");
      expect(diagnostics[0].hint).toContain("256");
    });
  });
});
