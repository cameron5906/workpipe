# Build SCC Detection for Cycle Analysis

**ID**: WI-031
**Status**: Completed
**Priority**: P1-High
**Milestone**: B (Strategy B cycle support)
**Phase**: 8 (Cycles)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Implement Strongly Connected Component (SCC) detection for analyzing the job dependency graph. This is the foundation for cycle lowering - before we can generate phased execution, we need to identify which jobs form cycles.

The algorithm will:
1. Build a directed graph from job dependencies
2. Detect SCCs using Tarjan's or Kosaraju's algorithm
3. Identify which SCCs represent cycles (size > 1 or self-loop)
4. Provide this analysis to the code generator

## Acceptance Criteria

- [x] Graph builder constructs dependency graph from AST
- [x] SCC detection algorithm implemented (Tarjan's)
- [x] Cycle detection identifies SCCs with >1 node or self-loops
- [x] Graph analysis exported from `@workpipe/compiler`
- [x] Unit tests for various graph configurations:
  - [x] DAG (no cycles)
  - [x] Simple cycle (A -> B -> A)
  - [x] Self-loop (A -> A)
  - [x] Multiple SCCs
  - [x] Mixed DAG and cycles
  - [x] Diamond pattern
  - [x] Cycle block jobs
  - [x] Empty graphs
  - [x] Non-existent dependencies
- [x] Integration with existing AST
- [x] Topological ordering via Kahn's algorithm

## Technical Context

### From PROJECT.md Section 10.1 (The model)

> - Treat the workflow as a directed graph of jobs (edges exist when a job consumes an output/artifact from another job, or has explicit `after`).
> - If the graph is acyclic: generate normal DAG YAML.
> - If cyclic: compute strongly connected components (SCCs). Any SCC with >1 node (or a self-loop) is a "cycle component."

### Graph Construction

Jobs have dependencies via:
1. `needs` clause - explicit dependency
2. `consumes` clause - artifact dependency
3. `after` clause - ordering dependency (future)

```typescript
interface JobGraph {
  nodes: Map<string, JobGraphNode>;
  edges: Map<string, Set<string>>; // job -> dependencies
}

interface JobGraphNode {
  name: string;
  job: AnyJobNode;
  inCycle: boolean;
  sccId: number | null;
}
```

### Tarjan's Algorithm

Tarjan's SCC algorithm runs in O(V + E) time:

```typescript
function findSCCs(graph: JobGraph): SCC[] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: SCC[] = [];
  let currentIndex = 0;

  function strongconnect(v: string) {
    index.set(v, currentIndex);
    lowlink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);

    for (const w of graph.edges.get(v) || []) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push({ nodes: scc, isCycle: scc.length > 1 || hasSelfLoop(v) });
    }
  }

  for (const v of graph.nodes.keys()) {
    if (!index.has(v)) {
      strongconnect(v);
    }
  }

  return sccs;
}
```

### SCC Result Type

```typescript
interface SCC {
  nodes: string[];      // Job names in this SCC
  isCycle: boolean;     // True if SCC represents a cycle
}

interface GraphAnalysis {
  graph: JobGraph;
  sccs: SCC[];
  hasCycles: boolean;
  cycleComponents: SCC[];  // Only SCCs where isCycle=true
}
```

### Integration Point

The graph analysis will be used during code generation:

```typescript
// In transform.ts
function transformWorkflow(workflow: WorkflowNode): WorkflowIR {
  const analysis = analyzeGraph(workflow);

  if (analysis.hasCycles) {
    // Generate phased execution (WI-032 through WI-037)
    return transformCyclicWorkflow(workflow, analysis);
  } else {
    // Generate normal DAG workflow
    return transformDagWorkflow(workflow);
  }
}
```

## Dependencies

- WI-030: Cycle syntax and AST (complete) - provides CycleNode with jobs
- WI-005: AST transformation (complete) - provides job nodes

## Files to Create

- `packages/compiler/src/analysis/graph.ts` - Graph construction
- `packages/compiler/src/analysis/scc.ts` - SCC algorithm
- `packages/compiler/src/analysis/index.ts` - Exports
- `packages/compiler/src/__tests__/analysis.test.ts` - Tests

## Files to Modify

- `packages/compiler/src/index.ts` - Export analysis functions

## Testing

```typescript
describe("graph analysis", () => {
  describe("buildGraph", () => {
    it("builds graph from job dependencies", () => {
      const workflow = buildAST(`
        workflow test {
          on: push
          job a { runs_on: ubuntu-latest needs: [b] steps: [] }
          job b { runs_on: ubuntu-latest steps: [] }
        }
      `)[0];

      const graph = buildGraph(workflow);
      expect(graph.edges.get("a")).toContain("b");
    });
  });

  describe("findSCCs", () => {
    it("detects simple cycle", () => {
      // A -> B -> A
      const graph = createTestGraph({
        a: ["b"],
        b: ["a"],
      });

      const sccs = findSCCs(graph);
      expect(sccs).toHaveLength(1);
      expect(sccs[0].isCycle).toBe(true);
      expect(sccs[0].nodes).toContain("a");
      expect(sccs[0].nodes).toContain("b");
    });

    it("detects DAG (no cycles)", () => {
      // A -> B -> C
      const graph = createTestGraph({
        a: ["b"],
        b: ["c"],
        c: [],
      });

      const sccs = findSCCs(graph);
      expect(sccs.every(scc => !scc.isCycle)).toBe(true);
    });

    it("detects self-loop", () => {
      // A -> A
      const graph = createTestGraph({
        a: ["a"],
      });

      const sccs = findSCCs(graph);
      expect(sccs[0].isCycle).toBe(true);
    });

    it("handles mixed DAG and cycles", () => {
      // A -> B -> C -> B (cycle), A -> D (no cycle)
      const graph = createTestGraph({
        a: ["b", "d"],
        b: ["c"],
        c: ["b"],
        d: [],
      });

      const analysis = analyzeGraph(graph);
      expect(analysis.hasCycles).toBe(true);
      expect(analysis.cycleComponents).toHaveLength(1);
    });
  });
});
```

## Notes

- Tarjan's algorithm is preferred over Kosaraju's for single-pass efficiency
- Self-loops should be detected even though they're single-node SCCs
- The analysis should be cached if called multiple times
- Consider adding cycle visualization for debugging (future)
- This is pure analysis - no YAML generation yet (that's WI-032+)

## References

- Tarjan's algorithm: https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
- PROJECT.md Section 10.1: The model
- PROJECT.md Section 11.1 Step 6: Cycle detection + lowering
