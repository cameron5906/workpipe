import { describe, it, expect, vi, beforeEach } from "vitest";
import { compile, SourceMap } from "@workpipe/compiler";

describe("DiagnosticsProvider", () => {
  describe("integration with compiler", () => {
    it("should compile valid workpipe source without errors", () => {
      const source = `
workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [
      run("npm install")
    ]
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      expect(result.diagnostics.length).toBe(0);
    });

    it("should detect syntax errors in invalid source", () => {
      const source = `
workflow ci {
  job build {
`;
      const result = compile(source);
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it("should detect semantic errors for cycles without termination", () => {
      const source = `
workflow test {
  cycle my_cycle {
    body {
      job inner {
        runs_on: ubuntu-latest
        steps: []
      }
    }
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(false);
      const cycleError = result.diagnostics.find((d) =>
        d.message.includes("max_iters")
      );
      expect(cycleError).toBeDefined();
    });
  });

  describe("SourceMap position conversion", () => {
    it("should convert offset to line and column correctly", () => {
      const source = "line1\nline2\nline3";
      const sourceMap = new SourceMap(source);

      const pos1 = sourceMap.positionAt(0);
      expect(pos1.line).toBe(1);
      expect(pos1.column).toBe(1);

      const pos2 = sourceMap.positionAt(6);
      expect(pos2.line).toBe(2);
      expect(pos2.column).toBe(1);

      const pos3 = sourceMap.positionAt(8);
      expect(pos3.line).toBe(2);
      expect(pos3.column).toBe(3);
    });

    it("should handle empty source", () => {
      const sourceMap = new SourceMap("");
      const pos = sourceMap.positionAt(0);
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(1);
    });

    it("should handle negative offset", () => {
      const sourceMap = new SourceMap("hello");
      const pos = sourceMap.positionAt(-5);
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(1);
    });

    it("should handle offset beyond source length", () => {
      const sourceMap = new SourceMap("hello");
      const pos = sourceMap.positionAt(100);
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(6);
    });
  });
});
