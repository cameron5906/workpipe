import { describe, it, expect, beforeEach } from "vitest";
import { ImportGraph, ImportEdge } from "../imports/dependency-graph.js";

describe("ImportGraph", () => {
  let graph: ImportGraph;

  beforeEach(() => {
    graph = new ImportGraph();
  });

  describe("addFile", () => {
    it("adds a file with no imports", () => {
      graph.addFile("/project/src/main.workpipe", []);
      expect(graph.size).toBe(1);
      expect(graph.hasFile("/project/src/main.workpipe")).toBe(true);
    });

    it("adds a file with imports", () => {
      const imports: ImportEdge[] = [
        { from: "/project/src/main.workpipe", to: "/project/src/types.workpipe", importedNames: ["User", "Role"] },
      ];
      graph.addFile("/project/src/main.workpipe", imports);

      expect(graph.size).toBe(2);
      expect(graph.hasFile("/project/src/main.workpipe")).toBe(true);
      expect(graph.hasFile("/project/src/types.workpipe")).toBe(true);
    });

    it("normalizes paths with backslashes", () => {
      graph.addFile("C:\\project\\src\\main.workpipe", [
        { from: "C:\\project\\src\\main.workpipe", to: "C:\\project\\src\\types.workpipe", importedNames: ["User"] },
      ]);

      expect(graph.hasFile("C:/project/src/main.workpipe")).toBe(true);
      expect(graph.hasFile("C:/project/src/types.workpipe")).toBe(true);
    });

    it("normalizes paths with . and ..", () => {
      graph.addFile("/project/src/./main.workpipe", [
        { from: "/project/src/main.workpipe", to: "/project/src/../src/types.workpipe", importedNames: ["User"] },
      ]);

      expect(graph.hasFile("/project/src/main.workpipe")).toBe(true);
      expect(graph.hasFile("/project/src/types.workpipe")).toBe(true);
    });

    it("updates imports when re-adding a file", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      expect(graph.getDirectImports("/project/a.workpipe").has("/project/b.workpipe")).toBe(true);

      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      expect(graph.getDirectImports("/project/a.workpipe").has("/project/b.workpipe")).toBe(false);
      expect(graph.getDirectImports("/project/a.workpipe").has("/project/c.workpipe")).toBe(true);
    });
  });

  describe("hasCycle - acyclic graphs", () => {
    it("returns false for empty graph", () => {
      expect(graph.hasCycle()).toBe(false);
    });

    it("returns false for single file with no imports", () => {
      graph.addFile("/project/main.workpipe", []);
      expect(graph.hasCycle()).toBe(false);
    });

    it("returns false for simple chain: A -> B -> C", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      expect(graph.hasCycle()).toBe(false);
    });

    it("returns false for multi-level hierarchy", () => {
      graph.addFile("/project/main.workpipe", [
        { from: "/project/main.workpipe", to: "/project/lib/types.workpipe", importedNames: ["Type1"] },
        { from: "/project/main.workpipe", to: "/project/lib/utils.workpipe", importedNames: ["util1"] },
      ]);
      graph.addFile("/project/lib/types.workpipe", [
        { from: "/project/lib/types.workpipe", to: "/project/lib/core.workpipe", importedNames: ["Core"] },
      ]);
      graph.addFile("/project/lib/utils.workpipe", [
        { from: "/project/lib/utils.workpipe", to: "/project/lib/core.workpipe", importedNames: ["Core"] },
      ]);
      graph.addFile("/project/lib/core.workpipe", []);

      expect(graph.hasCycle()).toBe(false);
    });

    it("returns false for diamond dependency: A -> B, A -> C, B -> D, C -> D", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/d.workpipe", []);

      expect(graph.hasCycle()).toBe(false);
    });
  });

  describe("hasCycle - cyclic graphs", () => {
    it("returns true for direct cycle: A -> B -> A", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(graph.hasCycle()).toBe(true);
    });

    it("returns true for self-loop: A -> A", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/a.workpipe", importedNames: ["SelfType"] },
      ]);

      expect(graph.hasCycle()).toBe(true);
    });

    it("returns true for transitive cycle: A -> B -> C -> A", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(graph.hasCycle()).toBe(true);
    });

    it("returns true for long transitive cycle: A -> B -> C -> D -> E -> A", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/d.workpipe", [
        { from: "/project/d.workpipe", to: "/project/e.workpipe", importedNames: ["E"] },
      ]);
      graph.addFile("/project/e.workpipe", [
        { from: "/project/e.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(graph.hasCycle()).toBe(true);
    });

    it("returns true for graph with acyclic prefix and cycle", () => {
      graph.addFile("/project/entry.workpipe", [
        { from: "/project/entry.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(graph.hasCycle()).toBe(true);
    });
  });

  describe("getCycle", () => {
    it("returns null for acyclic graph", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      expect(graph.getCycle()).toBe(null);
    });

    it("returns cycle path for direct cycle", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      const cycle = graph.getCycle();
      expect(cycle).not.toBe(null);
      expect(cycle!.length).toBeGreaterThan(1);
      expect(cycle).toContain("/project/a.workpipe");
      expect(cycle).toContain("/project/b.workpipe");
    });

    it("returns cycle path for self-loop", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/a.workpipe", importedNames: ["Self"] },
      ]);

      const cycle = graph.getCycle();
      expect(cycle).not.toBe(null);
      expect(cycle).toEqual(["/project/a.workpipe", "/project/a.workpipe"]);
    });

    it("returns cycle path for transitive cycle", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      const cycle = graph.getCycle();
      expect(cycle).not.toBe(null);
      expect(cycle!.length).toBe(4);
      expect(cycle).toContain("/project/a.workpipe");
      expect(cycle).toContain("/project/b.workpipe");
      expect(cycle).toContain("/project/c.workpipe");
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
    });
  });

  describe("getTopologicalOrder", () => {
    it("returns empty array for empty graph", () => {
      expect(graph.getTopologicalOrder()).toEqual([]);
    });

    it("returns single file for graph with one file", () => {
      graph.addFile("/project/main.workpipe", []);
      expect(graph.getTopologicalOrder()).toEqual(["/project/main.workpipe"]);
    });

    it("returns correct order for chain: A -> B -> C", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      const order = graph.getTopologicalOrder();

      const aIndex = order.indexOf("/project/a.workpipe");
      const bIndex = order.indexOf("/project/b.workpipe");
      const cIndex = order.indexOf("/project/c.workpipe");

      expect(cIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("returns correct order for diamond: A -> B, A -> C, B -> D, C -> D", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/d.workpipe", []);

      const order = graph.getTopologicalOrder();

      const aIndex = order.indexOf("/project/a.workpipe");
      const bIndex = order.indexOf("/project/b.workpipe");
      const cIndex = order.indexOf("/project/c.workpipe");
      const dIndex = order.indexOf("/project/d.workpipe");

      expect(dIndex).toBeLessThan(bIndex);
      expect(dIndex).toBeLessThan(cIndex);
      expect(bIndex).toBeLessThan(aIndex);
      expect(cIndex).toBeLessThan(aIndex);
    });

    it("throws error for cyclic graph", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(() => graph.getTopologicalOrder()).toThrow(/cycle/i);
    });

    it("includes cycle path in error message", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/a.workpipe", importedNames: ["A"] },
      ]);

      expect(() => graph.getTopologicalOrder()).toThrow(/a\.workpipe.*->.*b\.workpipe|b\.workpipe.*->.*a\.workpipe/i);
    });
  });

  describe("getDependentsOf", () => {
    it("returns empty set for file with no dependents", () => {
      graph.addFile("/project/a.workpipe", []);
      expect(graph.getDependentsOf("/project/a.workpipe").size).toBe(0);
    });

    it("returns empty set for non-existent file", () => {
      expect(graph.getDependentsOf("/project/nonexistent.workpipe").size).toBe(0);
    });

    it("returns direct dependents", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      const dependents = graph.getDependentsOf("/project/b.workpipe");
      expect(dependents.size).toBe(2);
      expect(dependents.has("/project/a.workpipe")).toBe(true);
      expect(dependents.has("/project/c.workpipe")).toBe(true);
    });

    it("returns transitive dependents", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      const dependents = graph.getDependentsOf("/project/c.workpipe");
      expect(dependents.size).toBe(2);
      expect(dependents.has("/project/a.workpipe")).toBe(true);
      expect(dependents.has("/project/b.workpipe")).toBe(true);
    });

    it("handles diamond pattern correctly", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/d.workpipe", []);

      const dependents = graph.getDependentsOf("/project/d.workpipe");
      expect(dependents.size).toBe(3);
      expect(dependents.has("/project/a.workpipe")).toBe(true);
      expect(dependents.has("/project/b.workpipe")).toBe(true);
      expect(dependents.has("/project/c.workpipe")).toBe(true);
    });

    it("normalizes paths", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      const dependents = graph.getDependentsOf("/project/./b.workpipe");
      expect(dependents.has("/project/a.workpipe")).toBe(true);
    });
  });

  describe("getDependenciesOf", () => {
    it("returns empty set for file with no dependencies", () => {
      graph.addFile("/project/a.workpipe", []);
      expect(graph.getDependenciesOf("/project/a.workpipe").size).toBe(0);
    });

    it("returns empty set for non-existent file", () => {
      expect(graph.getDependenciesOf("/project/nonexistent.workpipe").size).toBe(0);
    });

    it("returns direct dependencies", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", []);
      graph.addFile("/project/c.workpipe", []);

      const dependencies = graph.getDependenciesOf("/project/a.workpipe");
      expect(dependencies.size).toBe(2);
      expect(dependencies.has("/project/b.workpipe")).toBe(true);
      expect(dependencies.has("/project/c.workpipe")).toBe(true);
    });

    it("returns transitive dependencies", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      const dependencies = graph.getDependenciesOf("/project/a.workpipe");
      expect(dependencies.size).toBe(2);
      expect(dependencies.has("/project/b.workpipe")).toBe(true);
      expect(dependencies.has("/project/c.workpipe")).toBe(true);
    });

    it("handles diamond pattern correctly", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/c.workpipe", [
        { from: "/project/c.workpipe", to: "/project/d.workpipe", importedNames: ["D"] },
      ]);
      graph.addFile("/project/d.workpipe", []);

      const dependencies = graph.getDependenciesOf("/project/a.workpipe");
      expect(dependencies.size).toBe(3);
      expect(dependencies.has("/project/b.workpipe")).toBe(true);
      expect(dependencies.has("/project/c.workpipe")).toBe(true);
      expect(dependencies.has("/project/d.workpipe")).toBe(true);
    });

    it("normalizes paths", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      const dependencies = graph.getDependenciesOf("/project/./a.workpipe");
      expect(dependencies.has("/project/b.workpipe")).toBe(true);
    });
  });

  describe("complex multi-file scenarios", () => {
    it("handles realistic project structure", () => {
      graph.addFile("/project/src/main.workpipe", [
        { from: "/project/src/main.workpipe", to: "/project/src/lib/types.workpipe", importedNames: ["User", "Post"] },
        { from: "/project/src/main.workpipe", to: "/project/src/lib/utils.workpipe", importedNames: ["formatDate"] },
      ]);
      graph.addFile("/project/src/lib/types.workpipe", [
        { from: "/project/src/lib/types.workpipe", to: "/project/src/lib/core.workpipe", importedNames: ["Entity"] },
      ]);
      graph.addFile("/project/src/lib/utils.workpipe", [
        { from: "/project/src/lib/utils.workpipe", to: "/project/src/lib/types.workpipe", importedNames: ["User"] },
      ]);
      graph.addFile("/project/src/lib/core.workpipe", []);

      expect(graph.size).toBe(4);
      expect(graph.hasCycle()).toBe(false);

      const order = graph.getTopologicalOrder();
      const mainIndex = order.indexOf("/project/src/main.workpipe");
      const typesIndex = order.indexOf("/project/src/lib/types.workpipe");
      const utilsIndex = order.indexOf("/project/src/lib/utils.workpipe");
      const coreIndex = order.indexOf("/project/src/lib/core.workpipe");

      expect(coreIndex).toBeLessThan(typesIndex);
      expect(typesIndex).toBeLessThan(utilsIndex);
      expect(utilsIndex).toBeLessThan(mainIndex);
      expect(typesIndex).toBeLessThan(mainIndex);
    });

    it("handles multiple independent subgraphs", () => {
      graph.addFile("/project/a/main.workpipe", [
        { from: "/project/a/main.workpipe", to: "/project/a/lib.workpipe", importedNames: ["A"] },
      ]);
      graph.addFile("/project/a/lib.workpipe", []);

      graph.addFile("/project/b/main.workpipe", [
        { from: "/project/b/main.workpipe", to: "/project/b/lib.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b/lib.workpipe", []);

      expect(graph.size).toBe(4);
      expect(graph.hasCycle()).toBe(false);

      const order = graph.getTopologicalOrder();
      expect(order.length).toBe(4);
    });

    it("handles mutual dependency cycle in larger graph", () => {
      graph.addFile("/project/entry.workpipe", [
        { from: "/project/entry.workpipe", to: "/project/user.workpipe", importedNames: ["User"] },
      ]);
      graph.addFile("/project/user.workpipe", [
        { from: "/project/user.workpipe", to: "/project/post.workpipe", importedNames: ["Post"] },
      ]);
      graph.addFile("/project/post.workpipe", [
        { from: "/project/post.workpipe", to: "/project/user.workpipe", importedNames: ["User"] },
      ]);

      expect(graph.hasCycle()).toBe(true);

      const cycle = graph.getCycle();
      expect(cycle).not.toBe(null);
      expect(cycle).toContain("/project/user.workpipe");
      expect(cycle).toContain("/project/post.workpipe");
    });

    it("identifies correct dependents for incremental invalidation", () => {
      graph.addFile("/project/main.workpipe", [
        { from: "/project/main.workpipe", to: "/project/types.workpipe", importedNames: ["Type"] },
      ]);
      graph.addFile("/project/api.workpipe", [
        { from: "/project/api.workpipe", to: "/project/types.workpipe", importedNames: ["Type"] },
      ]);
      graph.addFile("/project/utils.workpipe", [
        { from: "/project/utils.workpipe", to: "/project/types.workpipe", importedNames: ["Type"] },
      ]);
      graph.addFile("/project/types.workpipe", [
        { from: "/project/types.workpipe", to: "/project/core.workpipe", importedNames: ["Core"] },
      ]);
      graph.addFile("/project/core.workpipe", []);

      const dependentsOfCore = graph.getDependentsOf("/project/core.workpipe");
      expect(dependentsOfCore.size).toBe(4);

      const dependentsOfTypes = graph.getDependentsOf("/project/types.workpipe");
      expect(dependentsOfTypes.size).toBe(3);
    });
  });

  describe("removeFile", () => {
    it("removes a file from the graph", () => {
      graph.addFile("/project/a.workpipe", []);
      expect(graph.hasFile("/project/a.workpipe")).toBe(true);

      graph.removeFile("/project/a.workpipe");
      expect(graph.hasFile("/project/a.workpipe")).toBe(false);
    });

    it("updates dependents when file is removed", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      graph.removeFile("/project/b.workpipe");

      expect(graph.getDirectImports("/project/a.workpipe").has("/project/b.workpipe")).toBe(false);
    });

    it("updates dependencies when file is removed", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      graph.removeFile("/project/a.workpipe");

      expect(graph.getDirectDependents("/project/b.workpipe").has("/project/a.workpipe")).toBe(false);
    });

    it("handles removing non-existent file gracefully", () => {
      expect(() => graph.removeFile("/project/nonexistent.workpipe")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("removes all files from the graph", () => {
      graph.addFile("/project/a.workpipe", []);
      graph.addFile("/project/b.workpipe", []);

      graph.clear();

      expect(graph.size).toBe(0);
      expect(graph.hasFile("/project/a.workpipe")).toBe(false);
      expect(graph.hasFile("/project/b.workpipe")).toBe(false);
    });
  });

  describe("getDirectImports and getDirectDependents", () => {
    it("returns direct imports only", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["B"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      const directImports = graph.getDirectImports("/project/a.workpipe");
      expect(directImports.size).toBe(1);
      expect(directImports.has("/project/b.workpipe")).toBe(true);
      expect(directImports.has("/project/c.workpipe")).toBe(false);
    });

    it("returns direct dependents only", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/b.workpipe", [
        { from: "/project/b.workpipe", to: "/project/c.workpipe", importedNames: ["C"] },
      ]);
      graph.addFile("/project/c.workpipe", []);

      const directDependents = graph.getDirectDependents("/project/c.workpipe");
      expect(directDependents.size).toBe(2);
      expect(directDependents.has("/project/a.workpipe")).toBe(true);
      expect(directDependents.has("/project/b.workpipe")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles files with multiple imports to the same file", () => {
      graph.addFile("/project/a.workpipe", [
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["X"] },
        { from: "/project/a.workpipe", to: "/project/b.workpipe", importedNames: ["Y"] },
      ]);
      graph.addFile("/project/b.workpipe", []);

      expect(graph.getDirectImports("/project/a.workpipe").size).toBe(1);
      expect(graph.hasCycle()).toBe(false);
    });

    it("handles very deep dependency chains", () => {
      const depth = 50;
      for (let i = 0; i < depth; i++) {
        const from = `/project/file${i}.workpipe`;
        const to = `/project/file${i + 1}.workpipe`;
        graph.addFile(from, [
          { from, to, importedNames: [`Type${i + 1}`] },
        ]);
      }
      graph.addFile(`/project/file${depth}.workpipe`, []);

      expect(graph.size).toBe(depth + 1);
      expect(graph.hasCycle()).toBe(false);

      const order = graph.getTopologicalOrder();
      expect(order.length).toBe(depth + 1);
      expect(order[0]).toBe(`/project/file${depth}.workpipe`);
      expect(order[depth]).toBe("/project/file0.workpipe");
    });

    it("handles wide dependency trees", () => {
      const width = 20;
      const imports: ImportEdge[] = [];
      for (let i = 0; i < width; i++) {
        const to = `/project/dep${i}.workpipe`;
        imports.push({ from: "/project/main.workpipe", to, importedNames: [`Dep${i}`] });
        graph.addFile(to, []);
      }
      graph.addFile("/project/main.workpipe", imports);

      expect(graph.size).toBe(width + 1);
      expect(graph.hasCycle()).toBe(false);

      const order = graph.getTopologicalOrder();
      expect(order.indexOf("/project/main.workpipe")).toBe(width);
    });
  });
});
