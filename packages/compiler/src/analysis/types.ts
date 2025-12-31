/**
 * Represents a job in the dependency graph.
 */
export interface JobVertex {
  readonly name: string;
  readonly dependencies: readonly string[];
}

/**
 * Represents the complete job dependency graph for a workflow.
 */
export interface JobGraph {
  readonly vertices: ReadonlyMap<string, JobVertex>;
}

/**
 * Represents a Strongly Connected Component in the graph.
 */
export interface SCC {
  readonly members: readonly string[];
  readonly isCyclic: boolean;
}

/**
 * Complete analysis result for a workflow's dependency graph.
 */
export interface GraphAnalysis {
  readonly graph: JobGraph;
  readonly sccs: readonly SCC[];
  readonly hasCycles: boolean;
  readonly topologicalOrder: readonly string[];
}
