import * as vscode from "vscode";
import {
  compile,
  compileWithImports,
  createImportContext,
  SourceMap,
  normalizePath,
  type Diagnostic,
  type FileResolver,
  type ImportContext,
} from "@workpipe/compiler";
import { ImportAwareCompilation } from "./import-watcher";

const DEBOUNCE_DELAY_MS = 300;

/**
 * Create a VS Code file resolver for import resolution.
 */
function createVSCodeFileResolver(): FileResolver {
  return {
    async resolve(importPath: string, fromFile: string): Promise<string | null> {
      try {
        const fromUri = vscode.Uri.file(fromFile);
        const fromDir = vscode.Uri.joinPath(fromUri, "..");
        const resolvedUri = vscode.Uri.joinPath(fromDir, importPath);

        try {
          await vscode.workspace.fs.stat(resolvedUri);
          return normalizePath(resolvedUri.fsPath);
        } catch {
          return null;
        }
      } catch {
        return null;
      }
    },

    async read(filePath: string): Promise<string> {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(content);
    },

    async exists(filePath: string): Promise<boolean> {
      try {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.stat(uri);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Check if a source contains import statements.
 */
function hasImports(source: string): boolean {
  return /^\s*import\s*\{/m.test(source);
}

/**
 * Get the project root for import resolution.
 */
function getProjectRoot(filePath: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return normalizePath(workspaceFolders[0].uri.fsPath);
  }
  const uri = vscode.Uri.file(filePath);
  return normalizePath(vscode.Uri.joinPath(uri, "..").fsPath);
}

export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  private readonly importCompilation: ImportAwareCompilation;
  private importContext: ImportContext | null = null;

  constructor(importCompilation?: ImportAwareCompilation) {
    this.collection = vscode.languages.createDiagnosticCollection("workpipe");
    this.importCompilation = importCompilation ?? new ImportAwareCompilation();
  }

  /**
   * Get or create import context for multi-file compilation.
   */
  private getImportContext(filePath: string): ImportContext {
    if (!this.importContext) {
      const projectRoot = getProjectRoot(filePath);
      const fileResolver = createVSCodeFileResolver();
      this.importContext = createImportContext(fileResolver, projectRoot);
    }
    return this.importContext;
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
    const source = document.getText();
    const filePath = document.uri.fsPath;

    if (hasImports(source)) {
      this.runDiagnosticsWithImports(document, source, filePath);
    } else {
      this.runDiagnosticsSync(document, source);
    }
  }

  private runDiagnosticsSync(document: vscode.TextDocument, source: string): void {
    try {
      const result = compile(source);
      const sourceMap = new SourceMap(source);
      const diagnostics = result.diagnostics.map((d) =>
        this.toDiagnostic(d, sourceMap, document.uri)
      );

      this.collection.set(document.uri, diagnostics);
    } catch (error) {
      this.setCompilationError(document, error);
    }
  }

  private async runDiagnosticsWithImports(
    document: vscode.TextDocument,
    source: string,
    filePath: string
  ): Promise<void> {
    try {
      const normalizedPath = normalizePath(filePath);
      const importContext = this.getImportContext(normalizedPath);

      importContext.parsedFiles.delete(normalizedPath);
      importContext.registries.delete(normalizedPath);

      const result = await compileWithImports({
        source,
        filePath: normalizedPath,
        importContext,
      });

      const sourceMap = new SourceMap(source);
      const diagnostics: vscode.Diagnostic[] = [];

      for (const d of result.diagnostics) {
        const vscodeDiag = this.toDiagnostic(d, sourceMap, document.uri);
        diagnostics.push(vscodeDiag);
      }

      this.collection.set(document.uri, diagnostics);
    } catch (error) {
      this.setCompilationError(document, error);
    }
  }

  private setCompilationError(document: vscode.TextDocument, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `WorkPipe compilation error: ${message}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = "workpipe";
    this.collection.set(document.uri, [diagnostic]);
  }

  /**
   * Recompile all files that depend on the given file.
   * Called when a file is saved to update diagnostics in dependent files.
   */
  async recompileDependents(uri: vscode.Uri): Promise<void> {
    const filePath = normalizePath(uri.fsPath);
    const dependents = this.importCompilation.getDependentsOf(filePath);

    for (const dependentPath of dependents) {
      const dependentUri = vscode.Uri.file(dependentPath);
      const dependentDoc = vscode.workspace.textDocuments.find(
        (doc) => normalizePath(doc.uri.fsPath) === dependentPath
      );

      if (dependentDoc) {
        this.updateDiagnosticsImmediate(dependentDoc);
      }
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
    sourceMap: SourceMap,
    fileUri: vscode.Uri
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

  /**
   * Get the import compilation instance for dependency tracking.
   */
  getImportCompilation(): ImportAwareCompilation {
    return this.importCompilation;
  }

  dispose(): void {
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();
    this.collection.dispose();
    this.importCompilation.dispose();
  }
}
