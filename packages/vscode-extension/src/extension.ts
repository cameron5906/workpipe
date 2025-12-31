import * as vscode from "vscode";
import { DiagnosticsProvider } from "./diagnostics";
import { HoverProvider } from "./hover";
import { CodeActionsProvider } from "./code-actions";

const LANGUAGE_ID = "workpipe";

let diagnosticsProvider: DiagnosticsProvider | undefined;

function isWorkPipeDocument(document: vscode.TextDocument): boolean {
  return document.languageId === LANGUAGE_ID;
}

export function activate(context: vscode.ExtensionContext): void {
  diagnosticsProvider = new DiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(LANGUAGE_ID, new HoverProvider())
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      LANGUAGE_ID,
      new CodeActionsProvider(),
      { providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isWorkPipeDocument(document)) {
        diagnosticsProvider?.updateDiagnosticsImmediate(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isWorkPipeDocument(document)) {
        diagnosticsProvider?.updateDiagnosticsImmediate(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isWorkPipeDocument(event.document)) {
        diagnosticsProvider?.updateDiagnostics(event.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isWorkPipeDocument(document)) {
        diagnosticsProvider?.clearDiagnostics(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isWorkPipeDocument(editor.document)) {
        diagnosticsProvider?.updateDiagnosticsImmediate(editor.document);
      }
    })
  );

  if (vscode.window.activeTextEditor?.document.languageId === LANGUAGE_ID) {
    diagnosticsProvider.updateDiagnosticsImmediate(vscode.window.activeTextEditor.document);
  }

  vscode.workspace.textDocuments.forEach((document) => {
    if (isWorkPipeDocument(document)) {
      diagnosticsProvider?.updateDiagnosticsImmediate(document);
    }
  });
}

export function deactivate(): void {
  diagnosticsProvider = undefined;
}
