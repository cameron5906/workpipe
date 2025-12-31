import type { WorkflowNode } from "../ast/types.js";
import type { JobGraph, SCC, GraphAnalysis } from "./types.js";
import { buildJobGraph } from "./graph.js";

interface TarjanState {
  index: number;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  onStack: Set<string>;
  stack: string[];
  sccs: SCC[];
}

/**
 * Finds all Strongly Connected Components in a job graph using Tarjan's algorithm.
 * Returns SCCs in reverse topological order (dependencies come after dependents).
 * Time complexity: O(V + E)
 */
export function findSCCs(graph: JobGraph): SCC[] {
  const state: TarjanState = {
    index: 0,
    indices: new Map(),
    lowlinks: new Map(),
    onStack: new Set(),
    stack: [],
    sccs: [],
  };

  for (const name of graph.vertices.keys()) {
    if (!state.indices.has(name)) {
      strongConnect(name, graph, state);
    }
  }

  return state.sccs;
}

function strongConnect(v: string, graph: JobGraph, state: TarjanState): void {
  state.indices.set(v, state.index);
  state.lowlinks.set(v, state.index);
  state.index++;
  state.stack.push(v);
  state.onStack.add(v);

  const vertex = graph.vertices.get(v);
  if (vertex) {
    for (const w of vertex.dependencies) {
      if (!graph.vertices.has(w)) {
        continue;
      }

      if (!state.indices.has(w)) {
        strongConnect(w, graph, state);
        state.lowlinks.set(
          v,
          Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!)
        );
      } else if (state.onStack.has(w)) {
        state.lowlinks.set(
          v,
          Math.min(state.lowlinks.get(v)!, state.indices.get(w)!)
        );
      }
    }
  }

  if (state.lowlinks.get(v) === state.indices.get(v)) {
    const members: string[] = [];
    let w: string;
    do {
      w = state.stack.pop()!;
      state.onStack.delete(w);
      members.push(w);
    } while (w !== v);

    const hasSelfLoop = checkSelfLoop(v, graph);
    const isCyclic = members.length > 1 || hasSelfLoop;

    state.sccs.push({
      members,
      isCyclic,
    });
  }
}

function checkSelfLoop(name: string, graph: JobGraph): boolean {
  const vertex = graph.vertices.get(name);
  if (!vertex) return false;
  return vertex.dependencies.includes(name);
}

/**
 * Computes topological order from SCCs and graph.
 * Returns jobs in dependency order (dependencies come before dependents).
 * Only valid for DAGs - cyclic graphs will still return an order but it may not be meaningful.
 */
export function computeTopologicalOrder(
  sccs: SCC[],
  graph?: JobGraph
): string[] {
  if (!graph) {
    const order: string[] = [];
    for (let i = sccs.length - 1; i >= 0; i--) {
      for (const member of sccs[i].members.slice().reverse()) {
        order.push(member);
      }
    }
    return order;
  }

  const nodeToScc = new Map<string, number>();
  for (let i = 0; i < sccs.length; i++) {
    for (const member of sccs[i].members) {
      nodeToScc.set(member, i);
    }
  }

  const sccInDegree = new Array(sccs.length).fill(0);
  const sccEdges = new Map<number, Set<number>>();

  for (let i = 0; i < sccs.length; i++) {
    sccEdges.set(i, new Set());
  }

  for (const [name, vertex] of graph.vertices) {
    const fromScc = nodeToScc.get(name)!;
    for (const dep of vertex.dependencies) {
      if (!graph.vertices.has(dep)) continue;
      const toScc = nodeToScc.get(dep)!;
      if (fromScc !== toScc && !sccEdges.get(fromScc)!.has(toScc)) {
        sccEdges.get(fromScc)!.add(toScc);
        sccInDegree[fromScc]++;
      }
    }
  }

  const queue: number[] = [];
  for (let i = 0; i < sccs.length; i++) {
    if (sccInDegree[i] === 0) {
      queue.push(i);
    }
  }

  const sccOrder: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sccOrder.push(current);

    for (let i = 0; i < sccs.length; i++) {
      if (sccEdges.get(i)!.has(current)) {
        sccInDegree[i]--;
        if (sccInDegree[i] === 0) {
          queue.push(i);
        }
      }
    }
  }

  const order: string[] = [];
  for (const sccIdx of sccOrder) {
    for (const member of sccs[sccIdx].members.slice().reverse()) {
      order.push(member);
    }
  }

  return order;
}

/**
 * Performs complete graph analysis on a workflow.
 * Builds the dependency graph, finds SCCs, detects cycles, and computes topological order.
 */
export function analyzeGraph(workflow: WorkflowNode): GraphAnalysis {
  const graph = buildJobGraph(workflow);
  const sccs = findSCCs(graph);
  const hasCycles = sccs.some((scc) => scc.isCyclic);
  const topologicalOrder = computeTopologicalOrder(sccs, graph);

  return { graph, sccs, hasCycles, topologicalOrder };
}
