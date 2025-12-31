import { describe, it, expect } from "vitest";
import { compile, SourceMap } from "@workpipe/compiler";
import * as vscode from "vscode";
import { DiagnosticsProvider } from "../diagnostics";

describe("DiagnosticsProvider", () => {
  describe("toDiagnostic hint handling", () => {
    it("should append hint to message when diagnostic has a hint", () => {
      const source = `
workflow test {
  job build {
    steps: []
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(false);

      const diagnosticWithHint = result.diagnostics.find((d) => d.hint);
      expect(diagnosticWithHint).toBeDefined();
      expect(diagnosticWithHint!.hint).toBeTruthy();
      expect(diagnosticWithHint!.message).toContain("missing required 'runs_on' field");
      expect(diagnosticWithHint!.hint).toBe(
        "Add 'runs_on: ubuntu-latest' or another runner to the job"
      );
    });

    it("should include hint in VS Code diagnostic message", () => {
      const source = `
workflow test {
  job build {
    steps: []
  }
}
`;
      const provider = new DiagnosticsProvider();
      const mockUri = vscode.Uri.parse("file:///test.workpipe");
      const mockDocument = {
        getText: () => source,
        uri: mockUri,
      } as unknown as vscode.TextDocument;

      provider.updateDiagnosticsImmediate(mockDocument);

      const diagnostics = (provider as any).collection.get(mockUri);
      expect(diagnostics).toBeDefined();
      expect(diagnostics.length).toBeGreaterThan(0);

      const diagWithHint = diagnostics.find((d: vscode.Diagnostic) =>
        d.message.includes("Hint:")
      );
      expect(diagWithHint).toBeDefined();
      expect(diagWithHint.message).toContain("\n\nHint:");
      expect(diagWithHint.message).toContain(
        "Add 'runs_on: ubuntu-latest' or another runner to the job"
      );

      provider.dispose();
    });

    it("should not modify message when diagnostic has no hint", () => {
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
  });

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

  describe("type validation diagnostics", () => {
    it("should detect WP5001 duplicate type name", () => {
      const source = `
type BuildInfo {
  version: string
}

type BuildInfo {
  commit: string
}

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: []
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(false);

      const duplicateTypeError = result.diagnostics.find(
        (d) => d.code === "WP5001"
      );
      expect(duplicateTypeError).toBeDefined();
      expect(duplicateTypeError!.severity).toBe("error");
      expect(duplicateTypeError!.message).toContain("BuildInfo");
      expect(duplicateTypeError!.message).toContain("already defined");
    });

    it("should detect WP5002 unknown type reference", () => {
      const source = `
workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: NonExistentType
    }
    steps: []
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(false);

      const unknownTypeError = result.diagnostics.find(
        (d) => d.code === "WP5002"
      );
      expect(unknownTypeError).toBeDefined();
      expect(unknownTypeError!.severity).toBe("error");
      expect(unknownTypeError!.message).toContain("NonExistentType");
    });

    it("should detect WP5003 property does not exist on type", () => {
      const exprStart = "$" + "{{";
      const exprEnd = "}" + "}";
      const source = `
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${exprStart} needs.build.outputs.info.nonexistent ${exprEnd}")
    ]
  }
}
`;
      const result = compile(source);

      const propertyError = result.diagnostics.find(
        (d) => d.code === "WP5003"
      );
      expect(propertyError).toBeDefined();
      expect(propertyError!.severity).toBe("error");
      expect(propertyError!.message).toContain("nonexistent");
      expect(propertyError!.message).toContain("BuildInfo");
    });

    it("should include hint with available properties for WP5003", () => {
      const exprStart = "$" + "{{";
      const exprEnd = "}" + "}";
      const source = `
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo hello")]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo ${exprStart} needs.build.outputs.info.invalid ${exprEnd}")
    ]
  }
}
`;
      const result = compile(source);

      const propertyError = result.diagnostics.find(
        (d) => d.code === "WP5003"
      );
      expect(propertyError).toBeDefined();
      expect(propertyError!.hint).toBeDefined();
      expect(propertyError!.hint).toContain("version");
    });

    it("should surface type diagnostics in VS Code DiagnosticsProvider", () => {
      const source = `
type BuildInfo {
  version: string
}

type BuildInfo {
  commit: string
}

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: []
  }
}
`;
      const provider = new DiagnosticsProvider();
      const mockUri = vscode.Uri.parse("file:///test-types.workpipe");
      const mockDocument = {
        getText: () => source,
        uri: mockUri,
      } as unknown as vscode.TextDocument;

      provider.updateDiagnosticsImmediate(mockDocument);

      const diagnostics = (provider as any).collection.get(mockUri);
      expect(diagnostics).toBeDefined();
      expect(diagnostics.length).toBeGreaterThan(0);

      const typeError = diagnostics.find(
        (d: vscode.Diagnostic) => d.code === "WP5001"
      );
      expect(typeError).toBeDefined();
      expect(typeError.severity).toBe(vscode.DiagnosticSeverity.Error);
      expect(typeError.source).toBe("workpipe");

      provider.dispose();
    });

    it("should correctly map type error positions via SourceMap", () => {
      const source = `type BuildInfo {
  version: string
}

type BuildInfo {
  commit: string
}`;
      const result = compile(source);
      const sourceMap = new SourceMap(source);

      const duplicateTypeError = result.diagnostics.find(
        (d) => d.code === "WP5001"
      );
      expect(duplicateTypeError).toBeDefined();

      const start = sourceMap.positionAt(duplicateTypeError!.span.start);
      const end = sourceMap.positionAt(duplicateTypeError!.span.end);

      expect(start.line).toBeGreaterThanOrEqual(1);
      expect(start.column).toBeGreaterThanOrEqual(1);
      expect(end.line).toBeGreaterThanOrEqual(start.line);
    });
  });
});
