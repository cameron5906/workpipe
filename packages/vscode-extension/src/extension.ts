import * as vscode from "vscode";
import { DiagnosticsProvider } from "./diagnostics";
import { HoverProvider } from "./hover";
import { CodeActionsProvider } from "./code-actions";

const LANGUAGE_ID = "workpipe";

let diagnosticsProvider: DiagnosticsProvider | undefined;

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
      if (document.languageId === LANGUAGE_ID) {
        diagnosticsProvider?.updateDiagnostics(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === LANGUAGE_ID) {
        diagnosticsProvider?.updateDiagnostics(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === LANGUAGE_ID) {
        diagnosticsProvider?.updateDiagnostics(event.document);
      }
    })
  );

  if (vscode.window.activeTextEditor?.document.languageId === LANGUAGE_ID) {
    diagnosticsProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === LANGUAGE_ID) {
      diagnosticsProvider?.updateDiagnostics(document);
    }
  });
}

export function deactivate(): void {
  diagnosticsProvider = undefined;
}
