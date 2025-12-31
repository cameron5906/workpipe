import * as vscode from "vscode";

interface QuickFixDefinition {
  title: string;
  insertText: string;
  insertAfterPattern?: RegExp;
}

const QUICK_FIXES: Record<string, QuickFixDefinition> = {
  WP7001: {
    title: "Add 'runs_on: ubuntu-latest'",
    insertText: "\n    runs_on: ubuntu-latest",
    insertAfterPattern: /job\s+\w+\s*\{/,
  },
  WP7002: {
    title: "Add 'runs_on: ubuntu-latest'",
    insertText: "\n    runs_on: ubuntu-latest",
    insertAfterPattern: /agent_job\s+\w+\s*\{/,
  },
  WP6001: {
    title: "Add 'max_iters = 5'",
    insertText: "\n  max_iters = 5",
    insertAfterPattern: /cycle\s+\w+\s*\{/,
  },
  WP6005: {
    title: "Add 'max_iters = 10'",
    insertText: "\n  max_iters = 10",
    insertAfterPattern: /cycle\s+\w+\s*\{/,
  },
};

export class CodeActionsProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "workpipe") {
        continue;
      }

      const code = String(diagnostic.code);
      const quickFix = QUICK_FIXES[code];

      if (quickFix) {
        const action = this.createQuickFix(document, diagnostic, quickFix);
        if (action) {
          actions.push(action);
        }
      }
    }

    return actions;
  }

  private createQuickFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    quickFix: QuickFixDefinition
  ): vscode.CodeAction | null {
    const action = new vscode.CodeAction(
      quickFix.title,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const insertPosition = this.findInsertPosition(
      document,
      diagnostic.range,
      quickFix.insertAfterPattern
    );

    if (!insertPosition) {
      return null;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, insertPosition, quickFix.insertText);
    action.edit = edit;

    return action;
  }

  private findInsertPosition(
    document: vscode.TextDocument,
    diagnosticRange: vscode.Range,
    pattern?: RegExp
  ): vscode.Position | null {
    if (!pattern) {
      return new vscode.Position(
        diagnosticRange.start.line,
        diagnosticRange.end.character
      );
    }

    const startLine = Math.max(0, diagnosticRange.start.line - 5);
    const endLine = diagnosticRange.end.line;

    for (let lineNum = endLine; lineNum >= startLine; lineNum--) {
      const line = document.lineAt(lineNum);
      const match = pattern.exec(line.text);
      if (match) {
        return new vscode.Position(lineNum, line.text.length);
      }
    }

    return new vscode.Position(
      diagnosticRange.start.line,
      document.lineAt(diagnosticRange.start.line).text.length
    );
  }
}

export function getQuickFixes(): typeof QUICK_FIXES {
  return QUICK_FIXES;
}
