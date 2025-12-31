import { describe, it, expect } from "vitest";
import { buildJobGraph } from "../analysis/graph.js";
import { findSCCs, analyzeGraph, computeTopologicalOrder } from "../analysis/scc.js";
import type { WorkflowNode, JobNode, CycleNode, AnyJobNode } from "../ast/types.js";
import type { JobGraph, SCC } from "../analysis/types.js";

function createMinimalJob(name: string, needs: string[] = []): JobNode {
  return {
    kind: "job",
    name,
    runsOn: "ubuntu-latest",
    needs,
    condition: null,
    steps: [],
    span: { start: 0, end: 0 },
  };
}

function createMinimalWorkflow(
  jobs: AnyJobNode[],
  cycles: CycleNode[] = []
): WorkflowNode {
  return {
    kind: "workflow",
    name: "test",
    trigger: null,
    jobs,
    cycles,
    span: { start: 0, end: 0 },
  };
}

function createCycle(name: string, jobs: AnyJobNode[]): CycleNode {
  return {
    kind: "cycle",
    name,
    maxIters: 5,
    key: null,
    until: null,
    body: {
      kind: "cycle_body",
      jobs,
      span: { start: 0, end: 0 },
    },
    span: { start: 0, end: 0 },
  };
}

describe("Graph Builder", () => {
  describe("buildJobGraph", () => {
    it("builds graph from single job with no dependencies", () => {
      const workflow = createMinimalWorkflow([createMinimalJob("A")]);
      const graph = buildJobGraph(workflow);

      expect(graph.vertices.size).toBe(1);
      expect(graph.vertices.get("A")).toEqual({
        name: "A",
        dependencies: [],
      });
    });

    it("builds graph with dependencies from needs", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
      ]);
      const graph = buildJobGraph(workflow);

      expect(graph.vertices.size).toBe(2);
      expect(graph.vertices.get("B")?.dependencies).toEqual(["A"]);
    });

    it("builds graph with multiple dependencies", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B"),
        createMinimalJob("C", ["A", "B"]),
      ]);
      const graph = buildJobGraph(workflow);

      expect(graph.vertices.get("C")?.dependencies).toEqual(["A", "B"]);
    });

    it("includes jobs from cycle blocks", () => {
      const workflow = createMinimalWorkflow(
        [createMinimalJob("setup")],
        [createCycle("review_loop", [createMinimalJob("review", ["setup"])])]
      );
      const graph = buildJobGraph(workflow);

      expect(graph.vertices.size).toBe(2);
      expect(graph.vertices.has("setup")).toBe(true);
      expect(graph.vertices.has("review")).toBe(true);
      expect(graph.vertices.get("review")?.dependencies).toEqual(["setup"]);
    });

    it("handles agent_job with after clause as dependency", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("setup"),
        {
          kind: "agent_job",
          name: "analyze",
          after: "setup",
          runsOn: "ubuntu-latest",
          needs: [],
          steps: [],
          consumes: [],
          span: { start: 0, end: 0 },
        },
      ]);
      const graph = buildJobGraph(workflow);

      expect(graph.vertices.get("analyze")?.dependencies).toEqual(["setup"]);
    });

    it("combines after and needs dependencies without duplicates", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("setup"),
        createMinimalJob("build"),
        {
          kind: "agent_job",
          name: "analyze",
          after: "setup",
          runsOn: "ubuntu-latest",
          needs: ["build", "setup"],
          steps: [],
          consumes: [],
          span: { start: 0, end: 0 },
        },
      ]);
      const graph = buildJobGraph(workflow);

      const deps = graph.vertices.get("analyze")?.dependencies;
      expect(deps).toContain("build");
      expect(deps).toContain("setup");
      expect(deps?.filter((d) => d === "setup").length).toBe(1);
    });
  });
});

describe("SCC Detection", () => {
  describe("findSCCs", () => {
    it("detects no cycles in DAG: A -> B -> C", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
        createMinimalJob("C", ["B"]),
      ]);
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);

      expect(sccs.every((scc) => !scc.isCyclic)).toBe(true);
      expect(sccs.every((scc) => scc.members.length === 1)).toBe(true);
    });

    it("detects simple cycle: A -> B -> A", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: ["B"] }],
          ["B", { name: "B", dependencies: ["A"] }],
        ]),
      };
      const sccs = findSCCs(graph);

      const cyclicScc = sccs.find((scc) => scc.isCyclic);
      expect(cyclicScc).toBeDefined();
      expect(cyclicScc!.members.length).toBe(2);
      expect(cyclicScc!.members).toContain("A");
      expect(cyclicScc!.members).toContain("B");
    });

    it("detects self-loop: A -> A", () => {
      const graph: JobGraph = {
        vertices: new Map([["A", { name: "A", dependencies: ["A"] }]]),
      };
      const sccs = findSCCs(graph);

      expect(sccs.length).toBe(1);
      expect(sccs[0].isCyclic).toBe(true);
      expect(sccs[0].members).toEqual(["A"]);
    });

    it("handles mixed: DAG with some cyclic components", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: [] }],
          ["B", { name: "B", dependencies: ["A", "C"] }],
          ["C", { name: "C", dependencies: ["B"] }],
          ["D", { name: "D", dependencies: ["B"] }],
        ]),
      };
      const sccs = findSCCs(graph);

      const cyclicSccs = sccs.filter((scc) => scc.isCyclic);
      const nonCyclicSccs = sccs.filter((scc) => !scc.isCyclic);

      expect(cyclicSccs.length).toBe(1);
      expect(cyclicSccs[0].members).toContain("B");
      expect(cyclicSccs[0].members).toContain("C");
      expect(nonCyclicSccs.length).toBe(2);
    });

    it("handles diamond: A -> B, A -> C, B -> D, C -> D", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
        createMinimalJob("C", ["A"]),
        createMinimalJob("D", ["B", "C"]),
      ]);
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);

      expect(sccs.every((scc) => !scc.isCyclic)).toBe(true);
      expect(sccs.length).toBe(4);
    });

    it("handles multiple independent SCCs", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: ["B"] }],
          ["B", { name: "B", dependencies: ["A"] }],
          ["C", { name: "C", dependencies: ["D"] }],
          ["D", { name: "D", dependencies: ["C"] }],
          ["E", { name: "E", dependencies: [] }],
        ]),
      };
      const sccs = findSCCs(graph);

      const cyclicSccs = sccs.filter((scc) => scc.isCyclic);
      expect(cyclicSccs.length).toBe(2);

      const abCycle = cyclicSccs.find(
        (scc) => scc.members.includes("A") && scc.members.includes("B")
      );
      const cdCycle = cyclicSccs.find(
        (scc) => scc.members.includes("C") && scc.members.includes("D")
      );

      expect(abCycle).toBeDefined();
      expect(cdCycle).toBeDefined();
    });

    it("handles cycle block jobs", () => {
      const workflow = createMinimalWorkflow(
        [createMinimalJob("setup")],
        [
          createCycle("loop", [
            createMinimalJob("process", ["review"]),
            createMinimalJob("review", ["process"]),
          ]),
        ]
      );
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);

      const cyclicScc = sccs.find((scc) => scc.isCyclic);
      expect(cyclicScc).toBeDefined();
      expect(cyclicScc!.members).toContain("process");
      expect(cyclicScc!.members).toContain("review");
    });

    it("ignores dependencies to non-existent jobs", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: ["nonexistent"] }],
        ]),
      };
      const sccs = findSCCs(graph);

      expect(sccs.length).toBe(1);
      expect(sccs[0].isCyclic).toBe(false);
    });

    it("handles empty graph", () => {
      const workflow = createMinimalWorkflow([]);
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);

      expect(sccs.length).toBe(0);
    });

    it("handles complex graph with nested cycles", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: [] }],
          ["B", { name: "B", dependencies: ["A", "D"] }],
          ["C", { name: "C", dependencies: ["B"] }],
          ["D", { name: "D", dependencies: ["C"] }],
          ["E", { name: "E", dependencies: ["D"] }],
        ]),
      };
      const sccs = findSCCs(graph);

      const cyclicScc = sccs.find((scc) => scc.isCyclic);
      expect(cyclicScc).toBeDefined();
      expect(cyclicScc!.members).toContain("B");
      expect(cyclicScc!.members).toContain("C");
      expect(cyclicScc!.members).toContain("D");
    });
  });

  describe("computeTopologicalOrder", () => {
    it("returns correct order for DAG", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
        createMinimalJob("C", ["B"]),
      ]);
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);
      const order = computeTopologicalOrder(sccs, graph);

      const aIndex = order.indexOf("A");
      const bIndex = order.indexOf("B");
      const cIndex = order.indexOf("C");

      expect(aIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(cIndex);
    });

    it("returns correct order for diamond", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
        createMinimalJob("C", ["A"]),
        createMinimalJob("D", ["B", "C"]),
      ]);
      const graph = buildJobGraph(workflow);
      const sccs = findSCCs(graph);
      const order = computeTopologicalOrder(sccs, graph);

      const aIndex = order.indexOf("A");
      const bIndex = order.indexOf("B");
      const cIndex = order.indexOf("C");
      const dIndex = order.indexOf("D");

      expect(aIndex).toBeLessThan(bIndex);
      expect(aIndex).toBeLessThan(cIndex);
      expect(bIndex).toBeLessThan(dIndex);
      expect(cIndex).toBeLessThan(dIndex);
    });

    it("includes all nodes from cyclic SCCs", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: ["B"] }],
          ["B", { name: "B", dependencies: ["A"] }],
        ]),
      };
      const sccs = findSCCs(graph);
      const order = computeTopologicalOrder(sccs, graph);

      expect(order).toContain("A");
      expect(order).toContain("B");
      expect(order.length).toBe(2);
    });
  });

  describe("analyzeGraph", () => {
    it("returns complete analysis for DAG", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
        createMinimalJob("C", ["B"]),
      ]);
      const analysis = analyzeGraph(workflow);

      expect(analysis.graph.vertices.size).toBe(3);
      expect(analysis.sccs.length).toBe(3);
      expect(analysis.hasCycles).toBe(false);
      expect(analysis.topologicalOrder.length).toBe(3);
    });

    it("returns complete analysis for graph with cycles", () => {
      const graph: JobGraph = {
        vertices: new Map([
          ["A", { name: "A", dependencies: ["B"] }],
          ["B", { name: "B", dependencies: ["A"] }],
        ]),
      };

      const workflow: WorkflowNode = {
        kind: "workflow",
        name: "test",
        trigger: null,
        jobs: [],
        cycles: [],
        span: { start: 0, end: 0 },
      };

      (workflow as any).jobs = [];

      const workflowWithCycle = createMinimalWorkflow([
        { ...createMinimalJob("A", ["B"]) },
        { ...createMinimalJob("B", ["A"]) },
      ]);

      const analysis = analyzeGraph(workflowWithCycle);

      expect(analysis.hasCycles).toBe(true);
      expect(analysis.sccs.some((scc) => scc.isCyclic)).toBe(true);
    });

    it("handles complex workflow with cycles and jobs", () => {
      const workflow = createMinimalWorkflow(
        [createMinimalJob("setup"), createMinimalJob("final", ["setup"])],
        [
          createCycle("loop", [
            createMinimalJob("process", ["setup"]),
          ]),
        ]
      );
      const analysis = analyzeGraph(workflow);

      expect(analysis.graph.vertices.size).toBe(3);
      expect(analysis.graph.vertices.has("setup")).toBe(true);
      expect(analysis.graph.vertices.has("process")).toBe(true);
      expect(analysis.graph.vertices.has("final")).toBe(true);
    });

    it("detects hasCycles correctly for DAGs", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A"),
        createMinimalJob("B", ["A"]),
      ]);
      const analysis = analyzeGraph(workflow);

      expect(analysis.hasCycles).toBe(false);
    });

    it("detects hasCycles correctly for cyclic graphs", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A", ["B"]),
        createMinimalJob("B", ["A"]),
      ]);
      const analysis = analyzeGraph(workflow);

      expect(analysis.hasCycles).toBe(true);
    });

    it("detects self-loop as cycle", () => {
      const workflow = createMinimalWorkflow([
        createMinimalJob("A", ["A"]),
      ]);
      const analysis = analyzeGraph(workflow);

      expect(analysis.hasCycles).toBe(true);
    });
  });
});
