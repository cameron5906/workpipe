import * as vscode from "vscode";
import { compile, SourceMap, type Diagnostic } from "@workpipe/compiler";

const DEBOUNCE_DELAY_MS = 300;

export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly pendingUpdates: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection("workpipe");
  }

  updateDiagnostics(document: vscode.TextDocument): void {
    const uri = document.uri.toString();

    const existingTimeout = this.pendingUpdates.get(uri);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.pendingUpdates.delete(uri);
      this.runDiagnostics(document);
    }, DEBOUNCE_DELAY_MS);

    this.pendingUpdates.set(uri, timeout);
  }

  updateDiagnosticsImmediate(document: vscode.TextDocument): void {
    const uri = document.uri.toString();

    const existingTimeout = this.pendingUpdates.get(uri);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.pendingUpdates.delete(uri);
    }

    this.runDiagnostics(document);
  }

  private runDiagnostics(document: vscode.TextDocument): void {
    try {
      const source = document.getText();
      const result = compile(source);

      const sourceMap = new SourceMap(source);
      const diagnostics = result.diagnostics.map((d) =>
        this.toDiagnostic(d, sourceMap)
      );

      this.collection.set(document.uri, diagnostics);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `WorkPipe compilation error: ${message}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = "workpipe";
      this.collection.set(document.uri, [diagnostic]);
    }
  }

  clearDiagnostics(document: vscode.TextDocument): void {
    const uri = document.uri.toString();

    const existingTimeout = this.pendingUpdates.get(uri);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.pendingUpdates.delete(uri);
    }

    this.collection.delete(document.uri);
  }

  private toDiagnostic(
    diagnostic: Diagnostic,
    sourceMap: SourceMap
  ): vscode.Diagnostic {
    const start = sourceMap.positionAt(diagnostic.span.start);
    const end = sourceMap.positionAt(diagnostic.span.end);

    const range = new vscode.Range(
      start.line - 1,
      start.column - 1,
      end.line - 1,
      end.column - 1
    );

    let message = diagnostic.message;
    if (diagnostic.hint) {
      message += `\n\nHint: ${diagnostic.hint}`;
    }

    const severity = this.toSeverity(diagnostic.severity);
    const vscodeDiagnostic = new vscode.Diagnostic(
      range,
      message,
      severity
    );

    vscodeDiagnostic.code = diagnostic.code;
    vscodeDiagnostic.source = "workpipe";

    return vscodeDiagnostic;
  }

  private toSeverity(
    severity: Diagnostic["severity"]
  ): vscode.DiagnosticSeverity {
    switch (severity) {
      case "error":
        return vscode.DiagnosticSeverity.Error;
      case "warning":
        return vscode.DiagnosticSeverity.Warning;
      case "info":
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Error;
    }
  }

  dispose(): void {
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();
    this.collection.dispose();
  }
}
