import * as vscode from "vscode";
import { compile, SourceMap, type Diagnostic } from "@workpipe/compiler";

export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection("workpipe");
  }

  updateDiagnostics(document: vscode.TextDocument): void {
    const source = document.getText();
    const result = compile(source);

    const sourceMap = new SourceMap(source);
    const diagnostics = result.diagnostics.map((d) =>
      this.toDiagnostic(d, sourceMap)
    );

    this.collection.set(document.uri, diagnostics);
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
    this.collection.dispose();
  }
}
