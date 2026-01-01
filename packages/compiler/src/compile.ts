/**
 * Compilation entry points for WorkPipe.
 *
 * This module provides:
 * - Single-file compilation (backward compatible)
 * - Multi-file compilation with import support
 * - ImportContext for caching and file resolution
 */

import { VERSION as LANG_VERSION, parse, hasErrors, getErrors } from "@workpipe/lang";
import { buildAST, buildFileAST } from "./ast/index.js";
import type { WorkflowNode, WorkPipeFileNode } from "./ast/index.js";
import { transform, emit } from "./codegen/index.js";
import { parseError, semanticError, type CompileResult, type Diagnostic } from "./diagnostic/index.js";
import {
  validateCycleTermination,
  validateRequiredFields,
  validateOutputs,
  validateSchemas,
  validateMatrixJobs,
  validateExpressionTypes,
  buildTypeRegistry,
  validateTypeReferences,
  buildFragmentRegistry,
  type TypeRegistry,
  type FragmentRegistry,
  type ImportItem,
} from "./semantics/index.js";
import type { FileResolver } from "./imports/index.js";
import {
  ImportGraph,
  detectCircularImports,
  createFileNotFoundDiagnostic,
} from "./imports/index.js";
import { IMPORT_DIAGNOSTICS } from "./diagnostics/index.js";

/**
 * Context for multi-file compilation with import support.
 */
export interface ImportContext {
  /** File resolver for reading imported files */
  fileResolver: FileResolver;
  /** Project root directory for path resolution */
  projectRoot: string;
  /** Cache of parsed file ASTs (keyed by normalized file path) */
  parsedFiles: Map<string, WorkPipeFileNode>;
  /** Cache of built type registries (keyed by normalized file path) */
  registries: Map<string, TypeRegistry>;
  /** Dependency graph for cycle detection */
  dependencyGraph: ImportGraph;
}

/**
 * Options for compiling a WorkPipe source file.
 */
export interface CompileOptions {
  /** The source code to compile */
  source: string;
  /** Absolute path of the source file (required for imports to resolve) */
  filePath?: string;
  /** Import context for multi-file compilation */
  importContext?: ImportContext;
}

/**
 * Create a new import context for multi-file compilation.
 */
export function createImportContext(
  fileResolver: FileResolver,
  projectRoot: string
): ImportContext {
  return {
    fileResolver,
    projectRoot,
    parsedFiles: new Map(),
    registries: new Map(),
    dependencyGraph: new ImportGraph(),
  };
}

function validateCycles(ast: WorkflowNode, diagnostics: Diagnostic[]): void {
  for (const cycle of ast.cycles) {
    if (cycle.maxIters === null && cycle.until === null) {
      diagnostics.push(
        semanticError(
          "WP6001",
          `Cycle '${cycle.name}' must have either 'max_iters' or 'until' specified`,
          cycle.span,
          "Add 'max_iters = N' or 'until guard_js \"\"\"...\"\"\"' to the cycle"
        )
      );
    }

    const terminationWarnings = validateCycleTermination(cycle);
    diagnostics.push(...terminationWarnings);
  }
}

/**
 * Parse a source file and return its AST.
 * Uses cache from ImportContext if available.
 */
function parseFile(
  source: string,
  filePath: string | undefined,
  importContext: ImportContext | undefined
): { fileAST: WorkPipeFileNode | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  if (filePath && importContext?.parsedFiles.has(filePath)) {
    return { fileAST: importContext.parsedFiles.get(filePath)!, diagnostics: [] };
  }

  const tree = parse(source);

  if (hasErrors(tree)) {
    const errors = getErrors(source);
    for (const error of errors) {
      diagnostics.push(
        parseError("WP0001", error.message, { start: error.from, end: error.to })
      );
    }
    return { fileAST: null, diagnostics };
  }

  const fileAST = buildFileAST(tree, source);
  if (!fileAST) {
    diagnostics.push(
      parseError("WP0002", "Failed to build AST from parse tree", { start: 0, end: source.length })
    );
    return { fileAST: null, diagnostics };
  }

  if (filePath && importContext) {
    importContext.parsedFiles.set(filePath, fileAST);
  }

  return { fileAST, diagnostics };
}

/**
 * Build or retrieve a type registry for a file.
 * Uses cache from ImportContext if available.
 */
function getOrBuildRegistry(
  fileAST: WorkPipeFileNode,
  filePath: string | undefined,
  importContext: ImportContext | undefined
): { registry: TypeRegistry; diagnostics: Diagnostic[] } {
  if (filePath && importContext?.registries.has(filePath)) {
    return { registry: importContext.registries.get(filePath)!, diagnostics: [] };
  }

  const { registry, diagnostics } = buildTypeRegistry(fileAST);

  if (filePath && importContext) {
    importContext.registries.set(filePath, registry);
  }

  return { registry, diagnostics };
}

/**
 * Process imports for a file's registry, resolving types from imported files.
 * Also builds the dependency graph for cycle detection.
 */
async function processImports(
  fileAST: WorkPipeFileNode,
  registry: TypeRegistry,
  filePath: string,
  importContext: ImportContext
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const importEdges: Array<{ from: string; to: string; importedNames: string[] }> = [];

  for (const importDecl of fileAST.imports) {
    const resolvedPath = await importContext.fileResolver.resolve(
      importDecl.path,
      filePath
    );

    if (!resolvedPath) {
      diagnostics.push(
        createFileNotFoundDiagnostic(importDecl.path, importDecl.span)
      );
      continue;
    }

    importEdges.push({
      from: filePath,
      to: resolvedPath,
      importedNames: importDecl.items.map((item) => item.name),
    });

    let sourceRegistry = importContext.registries.get(resolvedPath);

    if (!sourceRegistry) {
      const sourceContent = await importContext.fileResolver.read(resolvedPath);
      const { fileAST: sourceAST, diagnostics: parseDiags } = parseFile(
        sourceContent,
        resolvedPath,
        importContext
      );
      diagnostics.push(...parseDiags);

      if (!sourceAST) {
        continue;
      }

      const { registry: newRegistry, diagnostics: regDiags } = getOrBuildRegistry(
        sourceAST,
        resolvedPath,
        importContext
      );
      diagnostics.push(...regDiags);
      sourceRegistry = newRegistry;

      const nestedImportDiags = await processImports(
        sourceAST,
        sourceRegistry,
        resolvedPath,
        importContext
      );
      diagnostics.push(...nestedImportDiags);
    }

    const importItems: ImportItem[] = importDecl.items.map((item) => ({
      name: item.name,
      alias: item.alias,
    }));

    const importDiags = registry.importTypes(
      sourceRegistry,
      importItems,
      importDecl.path,
      importDecl.span
    );
    diagnostics.push(...importDiags);
  }

  importContext.dependencyGraph.addFile(filePath, importEdges);

  const cycleDiag = detectCircularImports(
    importContext.dependencyGraph,
    filePath,
    fileAST.imports[0]?.span
  );
  if (cycleDiag) {
    diagnostics.push(cycleDiag);
  }

  return diagnostics;
}

/**
 * Compile a WorkPipe source file.
 *
 * @param sourceOrOptions - Either the source code string (backward compatible)
 *                          or a CompileOptions object for multi-file compilation
 * @returns Compilation result with YAML output or diagnostics
 */
export function compile(sourceOrOptions: string | CompileOptions): CompileResult<string> {
  const options: CompileOptions = typeof sourceOrOptions === "string"
    ? { source: sourceOrOptions }
    : sourceOrOptions;

  const { source, filePath, importContext } = options;
  const diagnostics: Diagnostic[] = [];

  const { fileAST, diagnostics: parseDiags } = parseFile(source, filePath, importContext);
  diagnostics.push(...parseDiags);

  if (!fileAST) {
    return { success: false, diagnostics };
  }

  const { registry, diagnostics: typeRegistryDiagnostics } = getOrBuildRegistry(
    fileAST,
    filePath,
    importContext
  );
  diagnostics.push(...typeRegistryDiagnostics);

  const { registry: fragmentRegistry, diagnostics: fragmentDiagnostics } = buildFragmentRegistry(fileAST);
  diagnostics.push(...fragmentDiagnostics);

  diagnostics.push(...validateTypeReferences(fileAST, registry));

  const tree = parse(source);
  const ast = buildAST(tree, source);
  if (!ast) {
    diagnostics.push(
      parseError("WP0002", "Failed to build AST from parse tree", { start: 0, end: source.length })
    );
    return { success: false, diagnostics };
  }

  validateCycles(ast, diagnostics);
  diagnostics.push(...validateRequiredFields(ast));
  diagnostics.push(...validateOutputs(ast, registry));
  diagnostics.push(...validateSchemas(ast));
  diagnostics.push(...validateMatrixJobs(ast));
  diagnostics.push(...validateExpressionTypes(ast, registry));

  const hasDiagnosticErrors = diagnostics.some((d) => d.severity === "error");
  if (hasDiagnosticErrors) {
    return { success: false, diagnostics };
  }

  const ir = transform(ast, registry, fragmentRegistry);
  const yaml = emit(ir);

  return { success: true, value: yaml, diagnostics };
}

/**
 * Compile a WorkPipe source file with import support (async).
 *
 * This is the async version that fully supports imports.
 */
export async function compileWithImports(
  options: CompileOptions
): Promise<CompileResult<string>> {
  const { source, filePath, importContext } = options;
  const diagnostics: Diagnostic[] = [];

  const { fileAST, diagnostics: parseDiags } = parseFile(source, filePath, importContext);
  diagnostics.push(...parseDiags);

  if (!fileAST) {
    return { success: false, diagnostics };
  }

  const { registry, diagnostics: typeRegistryDiagnostics } = getOrBuildRegistry(
    fileAST,
    filePath,
    importContext
  );
  diagnostics.push(...typeRegistryDiagnostics);

  const { registry: fragmentRegistry, diagnostics: fragmentDiagnostics } = buildFragmentRegistry(fileAST);
  diagnostics.push(...fragmentDiagnostics);

  if (filePath && importContext && fileAST.imports.length > 0) {
    const importDiags = await processImports(fileAST, registry, filePath, importContext);
    diagnostics.push(...importDiags);
  }

  diagnostics.push(...validateTypeReferences(fileAST, registry));

  const tree = parse(source);
  const ast = buildAST(tree, source);
  if (!ast) {
    diagnostics.push(
      parseError("WP0002", "Failed to build AST from parse tree", { start: 0, end: source.length })
    );
    return { success: false, diagnostics };
  }

  validateCycles(ast, diagnostics);
  diagnostics.push(...validateRequiredFields(ast));
  diagnostics.push(...validateOutputs(ast, registry));
  diagnostics.push(...validateSchemas(ast));
  diagnostics.push(...validateMatrixJobs(ast));
  diagnostics.push(...validateExpressionTypes(ast, registry));

  const hasDiagnosticErrors = diagnostics.some((d) => d.severity === "error");
  if (hasDiagnosticErrors) {
    return { success: false, diagnostics };
  }

  const ir = transform(ast, registry, fragmentRegistry);
  const yaml = emit(ir);

  return { success: true, value: yaml, diagnostics };
}

/**
 * Compile a WorkPipe source to YAML string.
 * Throws an error if compilation fails.
 */
export function compileToYaml(source: string): string {
  const result = compile(source);
  if (!result.success) {
    throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  }
  return result.value;
}
