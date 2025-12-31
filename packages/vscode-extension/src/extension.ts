import * as vscode from "vscode";
import { DiagnosticsProvider } from "./diagnostics";

let diagnosticsProvider: DiagnosticsProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticsProvider = new DiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === "workpipe") {
        diagnosticsProvider?.updateDiagnostics(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === "workpipe") {
        diagnosticsProvider?.updateDiagnostics(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "workpipe") {
        diagnosticsProvider?.updateDiagnostics(event.document);
      }
    })
  );

  if (vscode.window.activeTextEditor?.document.languageId === "workpipe") {
    diagnosticsProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === "workpipe") {
      diagnosticsProvider?.updateDiagnostics(document);
    }
  });
}

export function deactivate(): void {
  diagnosticsProvider = undefined;
}
