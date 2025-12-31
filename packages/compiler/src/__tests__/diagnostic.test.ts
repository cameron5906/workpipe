import { describe, it, expect } from "vitest";
import {
  SourceMap,
  createDiagnostic,
  parseError,
  semanticError,
  warning,
  info,
  formatDiagnostic,
  formatDiagnostics,
  countDiagnostics,
  formatSummary,
  compile,
} from "../index.js";
import type { Diagnostic, CompileResult } from "../index.js";

describe("SourceMap", () => {
  describe("positionAt", () => {
    it("returns line 1, column 1 for offset 0", () => {
      const source = "hello\nworld";
      const sourceMap = new SourceMap(source);
      const pos = sourceMap.positionAt(0);
      expect(pos).toEqual({ line: 1, column: 1 });
    });

    it("returns correct position for first line", () => {
      const source = "hello\nworld";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(4)).toEqual({ line: 1, column: 5 });
    });

    it("returns correct position for second line", () => {
      const source = "hello\nworld";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(6)).toEqual({ line: 2, column: 1 });
      expect(sourceMap.positionAt(10)).toEqual({ line: 2, column: 5 });
    });

    it("handles multiple lines", () => {
      const source = "line1\nline2\nline3\nline4";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(0)).toEqual({ line: 1, column: 1 });
      expect(sourceMap.positionAt(6)).toEqual({ line: 2, column: 1 });
      expect(sourceMap.positionAt(12)).toEqual({ line: 3, column: 1 });
      expect(sourceMap.positionAt(18)).toEqual({ line: 4, column: 1 });
    });

    it("handles negative offset", () => {
      const source = "hello";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(-1)).toEqual({ line: 1, column: 1 });
    });

    it("handles offset beyond source length", () => {
      const source = "hello";
      const sourceMap = new SourceMap(source);
      const pos = sourceMap.positionAt(100);
      expect(pos.line).toBeGreaterThan(0);
    });

    it("handles empty source", () => {
      const source = "";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(0)).toEqual({ line: 1, column: 1 });
    });

    it("handles source with only newlines", () => {
      const source = "\n\n\n";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.positionAt(0)).toEqual({ line: 1, column: 1 });
      expect(sourceMap.positionAt(1)).toEqual({ line: 2, column: 1 });
      expect(sourceMap.positionAt(2)).toEqual({ line: 3, column: 1 });
    });
  });

  describe("getLine", () => {
    it("returns first line content", () => {
      const source = "hello\nworld";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.getLine(1)).toBe("hello");
    });

    it("returns second line content", () => {
      const source = "hello\nworld";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.getLine(2)).toBe("world");
    });

    it("returns empty string for invalid line number", () => {
      const source = "hello";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.getLine(0)).toBe("");
      expect(sourceMap.getLine(-1)).toBe("");
    });

    it("returns last line without trailing newline", () => {
      const source = "line1\nline2";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.getLine(2)).toBe("line2");
    });
  });

  describe("lineCount", () => {
    it("returns 1 for single line", () => {
      const source = "hello";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.lineCount).toBe(1);
    });

    it("returns correct count for multiple lines", () => {
      const source = "line1\nline2\nline3";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.lineCount).toBe(3);
    });

    it("counts trailing newline as additional line", () => {
      const source = "line1\nline2\n";
      const sourceMap = new SourceMap(source);
      expect(sourceMap.lineCount).toBe(3);
    });
  });
});

describe("Diagnostic creation helpers", () => {
  const span = { start: 0, end: 10 };

  describe("createDiagnostic", () => {
    it("creates error by default", () => {
      const diag = createDiagnostic("WP0001", "Test message", span);
      expect(diag.severity).toBe("error");
      expect(diag.code).toBe("WP0001");
      expect(diag.message).toBe("Test message");
      expect(diag.span).toEqual(span);
    });

    it("accepts optional severity", () => {
      const diag = createDiagnostic("WP0001", "Test", span, "warning");
      expect(diag.severity).toBe("warning");
    });

    it("accepts optional hint", () => {
      const diag = createDiagnostic("WP0001", "Test", span, "error", "Try this");
      expect(diag.hint).toBe("Try this");
    });
  });

  describe("parseError", () => {
    it("creates error severity diagnostic", () => {
      const diag = parseError("WP0001", "Parse error", span);
      expect(diag.severity).toBe("error");
      expect(diag.code).toBe("WP0001");
    });
  });

  describe("semanticError", () => {
    it("creates error severity diagnostic", () => {
      const diag = semanticError("WP0002", "Semantic error", span);
      expect(diag.severity).toBe("error");
    });
  });

  describe("warning", () => {
    it("creates warning severity diagnostic", () => {
      const diag = warning("WP0003", "Warning message", span);
      expect(diag.severity).toBe("warning");
    });
  });

  describe("info", () => {
    it("creates info severity diagnostic", () => {
      const diag = info("WP0004", "Info message", span);
      expect(diag.severity).toBe("info");
    });
  });
});

describe("Diagnostic formatting", () => {
  describe("formatDiagnostic", () => {
    it("formats basic diagnostic without color", () => {
      const source = "workflow test {\n  invalid syntax\n}";
      const diag = parseError("WP0001", "Unexpected token", { start: 18, end: 25 });
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("test.workpipe:2:3");
      expect(formatted).toContain("error[WP0001]");
      expect(formatted).toContain("Unexpected token");
      expect(formatted).toContain("invalid syntax");
      expect(formatted).toContain("^");
    });

    it("includes hint when present", () => {
      const source = "test";
      const diag = createDiagnostic(
        "WP0001",
        "Error message",
        { start: 0, end: 4 },
        "error",
        "Check the syntax"
      );
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("hint:");
      expect(formatted).toContain("Check the syntax");
    });

    it("handles single character span", () => {
      const source = "hello";
      const diag = parseError("WP0001", "Error", { start: 0, end: 1 });
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("^");
    });

    it("handles multi-character underline", () => {
      const source = "hello world";
      const diag = parseError("WP0001", "Error", { start: 0, end: 5 });
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("^^^^^");
    });

    it("formats warning severity", () => {
      const source = "test";
      const diag = warning("WP0010", "This is deprecated", { start: 0, end: 4 });
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("warning[WP0010]");
    });

    it("formats info severity", () => {
      const source = "test";
      const diag = info("WP0020", "Consider using alternative", { start: 0, end: 4 });
      const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

      expect(formatted).toContain("info[WP0020]");
    });
  });

  describe("formatDiagnostics", () => {
    it("formats multiple diagnostics", () => {
      const source = "test\ncode";
      const diagnostics: Diagnostic[] = [
        parseError("WP0001", "First error", { start: 0, end: 4 }),
        warning("WP0002", "Warning", { start: 5, end: 9 }),
      ];
      const formatted = formatDiagnostics(diagnostics, source, "test.workpipe", false);

      expect(formatted).toContain("error[WP0001]");
      expect(formatted).toContain("warning[WP0002]");
    });

    it("separates diagnostics with blank lines", () => {
      const source = "test";
      const diagnostics: Diagnostic[] = [
        parseError("WP0001", "First", { start: 0, end: 2 }),
        parseError("WP0002", "Second", { start: 2, end: 4 }),
      ];
      const formatted = formatDiagnostics(diagnostics, source, "test.workpipe", false);

      expect(formatted).toContain("\n\n");
    });
  });

  describe("countDiagnostics", () => {
    it("counts errors, warnings, and infos", () => {
      const diagnostics: Diagnostic[] = [
        parseError("WP0001", "Error 1", { start: 0, end: 1 }),
        parseError("WP0002", "Error 2", { start: 0, end: 1 }),
        warning("WP0003", "Warning", { start: 0, end: 1 }),
        info("WP0004", "Info", { start: 0, end: 1 }),
      ];
      const counts = countDiagnostics(diagnostics);

      expect(counts.errors).toBe(2);
      expect(counts.warnings).toBe(1);
      expect(counts.infos).toBe(1);
    });

    it("returns zeros for empty array", () => {
      const counts = countDiagnostics([]);
      expect(counts.errors).toBe(0);
      expect(counts.warnings).toBe(0);
      expect(counts.infos).toBe(0);
    });
  });

  describe("formatSummary", () => {
    it("formats single error", () => {
      const summary = formatSummary({ errors: 1, warnings: 0, infos: 0 }, false);
      expect(summary).toBe("1 error");
    });

    it("formats multiple errors", () => {
      const summary = formatSummary({ errors: 3, warnings: 0, infos: 0 }, false);
      expect(summary).toBe("3 errors");
    });

    it("formats errors and warnings", () => {
      const summary = formatSummary({ errors: 2, warnings: 1, infos: 0 }, false);
      expect(summary).toBe("2 errors, 1 warning");
    });

    it("formats all types", () => {
      const summary = formatSummary({ errors: 1, warnings: 2, infos: 3 }, false);
      expect(summary).toBe("1 error, 2 warnings, 3 infos");
    });

    it("returns 'no issues found' for zero counts", () => {
      const summary = formatSummary({ errors: 0, warnings: 0, infos: 0 }, false);
      expect(summary).toBe("no issues found");
    });
  });
});

describe("CompileResult pattern", () => {
  describe("compile function", () => {
    it("returns success with valid source", () => {
      const source = `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}`;
      const result = compile(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("name: test");
        expect(result.diagnostics).toEqual([]);
      }
    });

    it("returns failure with parse errors", () => {
      const source = "workflow broken { invalid }";
      const result = compile(source);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].code).toBe("WP0001");
    });

    it("returns failure for empty source", () => {
      const source = "";
      const result = compile(source);

      expect(result.success).toBe(false);
    });

    it("diagnostics include span information", () => {
      const source = "workflow test { bad }";
      const result = compile(source);

      if (!result.success && result.diagnostics.length > 0) {
        const diag = result.diagnostics[0];
        expect(diag.span.start).toBeGreaterThanOrEqual(0);
        expect(diag.span.end).toBeGreaterThan(diag.span.start);
      }
    });
  });

  describe("type narrowing", () => {
    it("allows access to value when success is true", () => {
      const result: CompileResult<string> = {
        success: true,
        value: "test output",
        diagnostics: [],
      };

      if (result.success) {
        expect(result.value).toBe("test output");
      }
    });

    it("prevents access to value when success is false", () => {
      const result: CompileResult<string> = {
        success: false,
        diagnostics: [parseError("WP0001", "Error", { start: 0, end: 1 })],
      };

      if (!result.success) {
        expect(result.diagnostics.length).toBe(1);
      }
    });
  });
});

describe("Integration", () => {
  it("formats diagnostic with accurate source positions", () => {
    const source = `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}`;
    const sourceMap = new SourceMap(source);
    const workflowPos = sourceMap.positionAt(0);
    const onPos = sourceMap.positionAt(source.indexOf("on:"));
    const jobPos = sourceMap.positionAt(source.indexOf("job hello"));

    expect(workflowPos).toEqual({ line: 1, column: 1 });
    expect(onPos).toEqual({ line: 2, column: 3 });
    expect(jobPos).toEqual({ line: 3, column: 3 });
  });

  it("correctly underlines multi-character tokens", () => {
    const source = "workflow test {}";
    const diag = parseError("WP0001", "Missing body", {
      start: source.indexOf("test"),
      end: source.indexOf("test") + 4,
    });
    const formatted = formatDiagnostic(diag, source, "test.workpipe", false);

    expect(formatted).toContain("^^^^");
    expect(formatted).toContain("test {}");
  });
});
