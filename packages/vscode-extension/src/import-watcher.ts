/**
 * Import-aware compilation for VS Code extension.
 *
 * Manages cross-file compilation with caching and dependency tracking.
 * When a file changes, all files that import it are recompiled.
 */

import * as vscode from "vscode";
import {
  compileWithImports,
  createImportContext,
  ImportGraph,
  normalizePath,
  type FileResolver,
  type ImportContext,
  type CompileResult,
} from "@workpipe/compiler";

const DEBOUNCE_DELAY_MS = 300;

/**
 * VS Code file resolver using workspace file system.
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
 * Manages import-aware compilation for VS Code.
 *
 * Features:
 * - Tracks file dependencies via ImportGraph
 * - Caches parsed files and type registries
 * - Invalidates dependents when a file changes
 * - Debounces file changes for performance
 */
export class ImportAwareCompilation implements vscode.Disposable {
  private readonly importGraph: ImportGraph;
  private readonly fileCache: Map<string, { content: string; lastModified: number }>;
  private readonly pendingInvalidations: Map<string, NodeJS.Timeout>;
  private readonly fileResolver: FileResolver;
  private importContext: ImportContext | null = null;

  constructor() {
    this.importGraph = new ImportGraph();
    this.fileCache = new Map();
    this.pendingInvalidations = new Map();
    this.fileResolver = createVSCodeFileResolver();
  }

  /**
   * Get the project root for import resolution.
   * Uses the first workspace folder, or falls back to the file's directory.
   */
  private getProjectRoot(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return normalizePath(workspaceFolders[0].uri.fsPath);
    }
    const uri = vscode.Uri.file(filePath);
    return normalizePath(vscode.Uri.joinPath(uri, "..").fsPath);
  }

  /**
   * Get or create the import context for compilation.
   * Reuses the context for caching benefits.
   */
  private getImportContext(filePath: string): ImportContext {
    if (!this.importContext) {
      const projectRoot = this.getProjectRoot(filePath);
      this.importContext = createImportContext(this.fileResolver, projectRoot);
      (this.importContext as any).dependencyGraph = this.importGraph;
    }
    return this.importContext;
  }

  /**
   * Compile a file with import support.
   */
  async compile(source: string, filePath: string): Promise<CompileResult<string>> {
    const normalizedPath = normalizePath(filePath);
    const importContext = this.getImportContext(normalizedPath);

    importContext.parsedFiles.delete(normalizedPath);
    importContext.registries.delete(normalizedPath);

    const result = await compileWithImports({
      source,
      filePath: normalizedPath,
      importContext,
    });

    this.fileCache.set(normalizedPath, {
      content: source,
      lastModified: Date.now(),
    });

    return result;
  }

  /**
   * Handle a file change, invalidating caches and returning dependents to recompile.
   * Changes are debounced for performance.
   */
  onFileChanged(uri: vscode.Uri): void {
    const filePath = normalizePath(uri.fsPath);

    const existingTimeout = this.pendingInvalidations.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.pendingInvalidations.delete(filePath);
      this.invalidateFile(filePath);
    }, DEBOUNCE_DELAY_MS);

    this.pendingInvalidations.set(filePath, timeout);
  }

  /**
   * Invalidate a file and its caches.
   */
  private invalidateFile(filePath: string): void {
    const normalizedPath = normalizePath(filePath);

    this.fileCache.delete(normalizedPath);

    if (this.importContext) {
      this.importContext.parsedFiles.delete(normalizedPath);
      this.importContext.registries.delete(normalizedPath);
    }
  }

  /**
   * Get all files that depend on the given file (directly or transitively).
   * Returns normalized paths.
   */
  getDependentsOf(filePath: string): Set<string> {
    const normalizedPath = normalizePath(filePath);
    return this.importGraph.getDependentsOf(normalizedPath);
  }

  /**
   * Get files that directly depend on the given file.
   * Returns normalized paths.
   */
  getDirectDependentsOf(filePath: string): Set<string> {
    const normalizedPath = normalizePath(filePath);
    return this.importGraph.getDirectDependents(normalizedPath);
  }

  /**
   * Get files that the given file imports (directly).
   */
  getDirectImportsOf(filePath: string): Set<string> {
    const normalizedPath = normalizePath(filePath);
    return this.importGraph.getDirectImports(normalizedPath);
  }

  /**
   * Check if a file has any imports.
   */
  hasImports(filePath: string): boolean {
    const normalizedPath = normalizePath(filePath);
    return this.importGraph.getDirectImports(normalizedPath).size > 0;
  }

  /**
   * Check if a file is imported by any other file.
   */
  isImported(filePath: string): boolean {
    const normalizedPath = normalizePath(filePath);
    return this.importGraph.getDirectDependents(normalizedPath).size > 0;
  }

  /**
   * Get the cached content for a file, if available.
   */
  getCachedContent(filePath: string): string | undefined {
    const normalizedPath = normalizePath(filePath);
    return this.fileCache.get(normalizedPath)?.content;
  }

  /**
   * Get the import graph for dependency analysis.
   */
  getImportGraph(): ImportGraph {
    return this.importGraph;
  }

  /**
   * Clear all caches and reset the import context.
   */
  clearCaches(): void {
    this.fileCache.clear();
    this.importContext = null;
    this.importGraph.clear();
  }

  dispose(): void {
    for (const timeout of this.pendingInvalidations.values()) {
      clearTimeout(timeout);
    }
    this.pendingInvalidations.clear();
    this.clearCaches();
  }
}
