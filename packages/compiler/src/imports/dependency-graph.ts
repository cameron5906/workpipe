/**
 * Dependency graph for import resolution.
 *
 * Tracks file dependencies for:
 * - Cycle detection (WP7008)
 * - Compilation order (topological sort)
 * - Incremental invalidation (VS Code use case)
 */

import { normalizePath } from "./resolver.js";

/**
 * Represents an import edge in the dependency graph.
 */
export interface ImportEdge {
  /** The file containing the import */
  from: string;
  /** The file being imported */
  to: string;
  /** Names imported from the target file */
  importedNames: string[];
}

/**
 * Internal vertex representation in the graph.
 */
interface FileVertex {
  /** Normalized file path */
  path: string;
  /** Files this file imports (outgoing edges) */
  imports: Set<string>;
  /** Files that import this file (incoming edges for invalidation) */
  importedBy: Set<string>;
  /** Import details for each target */
  importDetails: Map<string, string[]>;
}

/**
 * State for Tarjan's SCC algorithm.
 */
interface TarjanState {
  index: number;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  onStack: Set<string>;
  stack: string[];
  sccs: string[][];
}

/**
 * Dependency graph for import resolution with cycle detection.
 *
 * Features:
 * - Path normalization for consistent lookups
 * - Cycle detection using Tarjan's SCC algorithm
 * - Topological ordering for compilation
 * - Dependency tracking for incremental invalidation
 */
export class ImportGraph {
  private vertices: Map<string, FileVertex> = new Map();

  /**
   * Add a file and its imports to the graph.
   * Paths are normalized before insertion.
   *
   * @param filePath - The file containing the imports
   * @param imports - The import edges from this file
   */
  addFile(filePath: string, imports: ImportEdge[]): void {
    const normalizedPath = normalizePath(filePath);

    let vertex = this.vertices.get(normalizedPath);
    if (!vertex) {
      vertex = {
        path: normalizedPath,
        imports: new Set(),
        importedBy: new Set(),
        importDetails: new Map(),
      };
      this.vertices.set(normalizedPath, vertex);
    } else {
      // Clear existing imports when re-adding (for updates)
      for (const oldImport of vertex.imports) {
        const targetVertex = this.vertices.get(oldImport);
        if (targetVertex) {
          targetVertex.importedBy.delete(normalizedPath);
        }
      }
      vertex.imports.clear();
      vertex.importDetails.clear();
    }

    for (const edge of imports) {
      const normalizedTo = normalizePath(edge.to);

      // Add the import edge
      vertex.imports.add(normalizedTo);
      vertex.importDetails.set(normalizedTo, [...edge.importedNames]);

      // Ensure target vertex exists and track reverse edge
      let targetVertex = this.vertices.get(normalizedTo);
      if (!targetVertex) {
        targetVertex = {
          path: normalizedTo,
          imports: new Set(),
          importedBy: new Set(),
          importDetails: new Map(),
        };
        this.vertices.set(normalizedTo, targetVertex);
      }
      targetVertex.importedBy.add(normalizedPath);
    }
  }

  /**
   * Check if the graph contains any cycles.
   * Uses Tarjan's SCC algorithm to detect cycles in O(V + E) time.
   *
   * @returns true if there is at least one cycle
   */
  hasCycle(): boolean {
    const sccs = this.findSCCs();
    return sccs.some((scc) => this.isCyclicSCC(scc));
  }

  /**
   * Get the cycle path if one exists.
   * Returns the files involved in the first detected cycle.
   *
   * @returns Array of file paths in the cycle, or null if no cycle exists
   */
  getCycle(): string[] | null {
    const sccs = this.findSCCs();

    for (const scc of sccs) {
      if (this.isCyclicSCC(scc)) {
        // Return the cycle in a meaningful order
        return this.extractCyclePath(scc);
      }
    }

    return null;
  }

  /**
   * Get the topological order for compilation.
   * Files are returned in dependency order (dependencies first).
   *
   * @returns Array of file paths in compilation order
   * @throws Error if the graph contains cycles
   */
  getTopologicalOrder(): string[] {
    if (this.hasCycle()) {
      const cycle = this.getCycle();
      const cycleStr = cycle ? cycle.join(" -> ") : "unknown";
      throw new Error(`Cannot compute topological order: graph contains cycle: ${cycleStr}`);
    }

    const sccs = this.findSCCs();
    const order: string[] = [];

    // Tarjan's algorithm returns SCCs in reverse topological order
    // For A -> B -> C (A imports B, B imports C), we get [[C], [B], [A]]
    // We want dependencies first (C before B before A), so iterate in order
    for (const scc of sccs) {
      for (const member of scc) {
        order.push(member);
      }
    }

    return order;
  }

  /**
   * Get all files that depend on the given file (directly or transitively).
   * Useful for incremental invalidation.
   *
   * @param filePath - The file to check dependents of
   * @returns Set of file paths that depend on the given file
   */
  getDependentsOf(filePath: string): Set<string> {
    const normalizedPath = normalizePath(filePath);
    const dependents = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [normalizedPath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const vertex = this.vertices.get(current);
      if (vertex) {
        for (const dependent of vertex.importedBy) {
          if (!visited.has(dependent)) {
            dependents.add(dependent);
            queue.push(dependent);
          }
        }
      }
    }

    return dependents;
  }

  /**
   * Get all files that the given file depends on (directly or transitively).
   *
   * @param filePath - The file to check dependencies of
   * @returns Set of file paths that the given file depends on
   */
  getDependenciesOf(filePath: string): Set<string> {
    const normalizedPath = normalizePath(filePath);
    const dependencies = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [normalizedPath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const vertex = this.vertices.get(current);
      if (vertex) {
        for (const dep of vertex.imports) {
          if (!visited.has(dep)) {
            dependencies.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Get the number of files in the graph.
   */
  get size(): number {
    return this.vertices.size;
  }

  /**
   * Check if a file is in the graph.
   */
  hasFile(filePath: string): boolean {
    return this.vertices.has(normalizePath(filePath));
  }

  /**
   * Get direct imports of a file.
   */
  getDirectImports(filePath: string): Set<string> {
    const vertex = this.vertices.get(normalizePath(filePath));
    return vertex ? new Set(vertex.imports) : new Set();
  }

  /**
   * Get direct dependents of a file.
   */
  getDirectDependents(filePath: string): Set<string> {
    const vertex = this.vertices.get(normalizePath(filePath));
    return vertex ? new Set(vertex.importedBy) : new Set();
  }

  /**
   * Find all strongly connected components using Tarjan's algorithm.
   * Time complexity: O(V + E)
   */
  private findSCCs(): string[][] {
    const state: TarjanState = {
      index: 0,
      indices: new Map(),
      lowlinks: new Map(),
      onStack: new Set(),
      stack: [],
      sccs: [],
    };

    for (const path of this.vertices.keys()) {
      if (!state.indices.has(path)) {
        this.strongConnect(path, state);
      }
    }

    return state.sccs;
  }

  /**
   * Tarjan's strong connect recursive function.
   */
  private strongConnect(v: string, state: TarjanState): void {
    state.indices.set(v, state.index);
    state.lowlinks.set(v, state.index);
    state.index++;
    state.stack.push(v);
    state.onStack.add(v);

    const vertex = this.vertices.get(v);
    if (vertex) {
      for (const w of vertex.imports) {
        if (!this.vertices.has(w)) {
          // Skip edges to files not in the graph
          continue;
        }

        if (!state.indices.has(w)) {
          // Successor w has not been visited, recurse
          this.strongConnect(w, state);
          state.lowlinks.set(
            v,
            Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!)
          );
        } else if (state.onStack.has(w)) {
          // Successor w is on stack and hence in the current SCC
          state.lowlinks.set(
            v,
            Math.min(state.lowlinks.get(v)!, state.indices.get(w)!)
          );
        }
      }
    }

    // If v is a root node, pop the stack and generate an SCC
    if (state.lowlinks.get(v) === state.indices.get(v)) {
      const members: string[] = [];
      let w: string;
      do {
        w = state.stack.pop()!;
        state.onStack.delete(w);
        members.push(w);
      } while (w !== v);

      state.sccs.push(members);
    }
  }

  /**
   * Check if an SCC represents a cycle.
   * An SCC is cyclic if it has more than one member, or if it has a self-loop.
   */
  private isCyclicSCC(scc: string[]): boolean {
    if (scc.length > 1) {
      return true;
    }

    // Check for self-loop
    if (scc.length === 1) {
      const vertex = this.vertices.get(scc[0]);
      if (vertex && vertex.imports.has(scc[0])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract a cycle path from a cyclic SCC.
   * Returns the cycle in a meaningful order for error messages.
   */
  private extractCyclePath(scc: string[]): string[] {
    if (scc.length === 1) {
      // Self-loop: show the file twice to indicate the loop
      return [scc[0], scc[0]];
    }

    // For multi-node cycles, find the actual cycle path
    // Start from the first node and follow edges within the SCC
    const sccSet = new Set(scc);
    const start = scc[0];
    const path: string[] = [start];
    const visited = new Set<string>([start]);

    let current = start;
    while (true) {
      const vertex = this.vertices.get(current);
      if (!vertex) break;

      let nextNode: string | null = null;
      for (const next of vertex.imports) {
        if (sccSet.has(next)) {
          if (next === start && path.length > 1) {
            // Found the cycle back to start
            path.push(start);
            return path;
          }
          if (!visited.has(next)) {
            nextNode = next;
            break;
          }
        }
      }

      if (!nextNode) {
        // If we can't find an unvisited node, look for the edge back to start
        for (const next of vertex.imports) {
          if (next === start) {
            path.push(start);
            return path;
          }
        }
        break;
      }

      path.push(nextNode);
      visited.add(nextNode);
      current = nextNode;
    }

    // Fallback: return the SCC as-is with a cycle indicator
    return [...scc, scc[0]];
  }

  /**
   * Remove a file from the graph.
   * Useful for incremental updates when a file is deleted.
   */
  removeFile(filePath: string): void {
    const normalizedPath = normalizePath(filePath);
    const vertex = this.vertices.get(normalizedPath);

    if (!vertex) {
      return;
    }

    // Remove this file from the importedBy sets of its dependencies
    for (const dep of vertex.imports) {
      const depVertex = this.vertices.get(dep);
      if (depVertex) {
        depVertex.importedBy.delete(normalizedPath);
      }
    }

    // Remove this file from the imports sets of its dependents
    for (const dependent of vertex.importedBy) {
      const depVertex = this.vertices.get(dependent);
      if (depVertex) {
        depVertex.imports.delete(normalizedPath);
        depVertex.importDetails.delete(normalizedPath);
      }
    }

    this.vertices.delete(normalizedPath);
  }

  /**
   * Clear all files from the graph.
   */
  clear(): void {
    this.vertices.clear();
  }
}
