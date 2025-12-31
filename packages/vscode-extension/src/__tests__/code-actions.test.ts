import { describe, it, expect } from "vitest";
import * as vscode from "vscode";
import { CodeActionsProvider, getQuickFixes } from "../code-actions";

function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split("\n");
  return {
    getText: (range?: vscode.Range) => {
      if (!range) return content;
      const startLine = lines[range.start.line] || "";
      return startLine.substring(range.start.character, range.end.character);
    },
    lineAt: (lineNumber: number) => ({
      text: lines[lineNumber] || "",
      range: new vscode.Range(
        lineNumber,
        0,
        lineNumber,
        (lines[lineNumber] || "").length
      ),
    }),
    uri: vscode.Uri.parse("file:///test.workpipe"),
  } as unknown as vscode.TextDocument;
}

function createMockToken(): vscode.CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  } as vscode.CancellationToken;
}

function createDiagnostic(
  code: string,
  message: string,
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    new vscode.Range(startLine, startChar, endLine, endChar),
    message,
    vscode.DiagnosticSeverity.Error
  );
  diag.code = code;
  diag.source = "workpipe";
  return diag;
}

describe("CodeActionsProvider", () => {
  const provider = new CodeActionsProvider();

  describe("WP7001 - Job missing runs_on", () => {
    it("should provide quick fix to add runs_on for job", () => {
      const source = `workflow ci {
  job build {
    steps: []
  }
}`;
      const document = createMockDocument(source);
      const diagnostic = createDiagnostic(
        "WP7001",
        "Job 'build' is missing required 'runs_on' field",
        1,
        2,
        1,
        11
      );
      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(1, 2, 1, 11);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toBeDefined();
      expect(actions).toHaveLength(1);
      const action = (actions as vscode.CodeAction[])[0];
      expect(action.title).toBe("Add 'runs_on: ubuntu-latest'");
      expect(action.kind).toBe(vscode.CodeActionKind.QuickFix);
      expect(action.isPreferred).toBe(true);
      expect(action.edit).toBeDefined();
    });
  });

  describe("WP7002 - Agent job missing runs_on", () => {
    it("should provide quick fix to add runs_on for agent_job", () => {
      const source = `workflow ci {
  agent_job review {
    prompt: "Review code"
  }
}`;
      const document = createMockDocument(source);
      const diagnostic = createDiagnostic(
        "WP7002",
        "Agent job 'review' is missing required 'runs_on' field",
        1,
        2,
        1,
        18
      );
      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(1, 2, 1, 18);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toBeDefined();
      expect(actions).toHaveLength(1);
      const action = (actions as vscode.CodeAction[])[0];
      expect(action.title).toBe("Add 'runs_on: ubuntu-latest'");
    });
  });

  describe("WP6001 - Cycle missing max_iters or until", () => {
    it("should provide quick fix to add max_iters for cycle", () => {
      const source = `workflow ci {
  cycle retry {
    body {
      job inner {
        runs_on: ubuntu-latest
        steps: []
      }
    }
  }
}`;
      const document = createMockDocument(source);
      const diagnostic = createDiagnostic(
        "WP6001",
        "Cycle 'retry' must have either 'max_iters' or 'until' specified",
        1,
        2,
        1,
        13
      );
      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(1, 2, 1, 13);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toBeDefined();
      expect(actions).toHaveLength(1);
      const action = (actions as vscode.CodeAction[])[0];
      expect(action.title).toBe("Add 'max_iters = 5'");
    });
  });

  describe("WP6005 - Cycle with until but no max_iters", () => {
    it("should provide quick fix to add max_iters when only until is present", () => {
      const source = `workflow ci {
  cycle retry {
    until guard_js """return true"""
    body {
      job inner {
        runs_on: ubuntu-latest
        steps: []
      }
    }
  }
}`;
      const document = createMockDocument(source);
      const diagnostic = createDiagnostic(
        "WP6005",
        "Cycle 'retry' has 'until' but no 'max_iters' as safety limit",
        1,
        2,
        1,
        13
      );
      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(1, 2, 1, 13);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toBeDefined();
      expect(actions).toHaveLength(1);
      const action = (actions as vscode.CodeAction[])[0];
      expect(action.title).toBe("Add 'max_iters = 10'");
    });
  });

  describe("non-workpipe diagnostics", () => {
    it("should ignore diagnostics from other sources", () => {
      const source = `workflow ci {}`;
      const document = createMockDocument(source);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 8),
        "Some other error",
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.code = "WP7001";
      diagnostic.source = "other-source";

      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(0, 0, 0, 8);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toHaveLength(0);
    });
  });

  describe("unknown diagnostic codes", () => {
    it("should not provide actions for unknown codes", () => {
      const source = `workflow ci {}`;
      const document = createMockDocument(source);
      const diagnostic = createDiagnostic("WP9999", "Unknown error", 0, 0, 0, 8);

      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(0, 0, 0, 8);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toHaveLength(0);
    });
  });

  describe("multiple diagnostics", () => {
    it("should provide actions for multiple diagnostics", () => {
      const source = `workflow ci {
  job build {
    steps: []
  }
  job test {
    steps: []
  }
}`;
      const document = createMockDocument(source);
      const diagnostic1 = createDiagnostic(
        "WP7001",
        "Job 'build' missing runs_on",
        1,
        2,
        1,
        11
      );
      const diagnostic2 = createDiagnostic(
        "WP7001",
        "Job 'test' missing runs_on",
        4,
        2,
        4,
        10
      );

      const context: vscode.CodeActionContext = {
        diagnostics: [diagnostic1, diagnostic2],
        only: undefined,
        triggerKind: 1,
      };
      const range = new vscode.Range(1, 2, 4, 10);

      const actions = provider.provideCodeActions(
        document,
        range,
        context,
        createMockToken()
      );

      expect(actions).toBeDefined();
      expect(actions).toHaveLength(2);
    });
  });

  describe("getQuickFixes export", () => {
    it("should export quick fix definitions", () => {
      const quickFixes = getQuickFixes();
      expect(quickFixes).toHaveProperty("WP7001");
      expect(quickFixes).toHaveProperty("WP7002");
      expect(quickFixes).toHaveProperty("WP6001");
      expect(quickFixes).toHaveProperty("WP6005");
    });

    it("should have correct titles for each quick fix", () => {
      const quickFixes = getQuickFixes();
      expect(quickFixes.WP7001.title).toBe("Add 'runs_on: ubuntu-latest'");
      expect(quickFixes.WP7002.title).toBe("Add 'runs_on: ubuntu-latest'");
      expect(quickFixes.WP6001.title).toBe("Add 'max_iters = 5'");
      expect(quickFixes.WP6005.title).toBe("Add 'max_iters = 10'");
    });
  });

  describe("providedCodeActionKinds", () => {
    it("should declare QuickFix as provided kind", () => {
      expect(CodeActionsProvider.providedCodeActionKinds).toContain(
        vscode.CodeActionKind.QuickFix
      );
    });
  });
});
