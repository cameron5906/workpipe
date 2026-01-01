import { readFile } from "fs/promises";
import { resolve, dirname, join, basename } from "path";
import { Command } from "commander";
import {
  compile,
  compileWithImports,
  createImportContext,
  createNodeFileResolver,
  formatDiagnostics,
  countDiagnostics,
  formatSummary,
  buildFileAST,
  buildTypeRegistry,
  validateTypeReferences,
  ImportGraph,
  type ImportContext,
  type Diagnostic,
} from "@workpipe/compiler";
import { parse, hasErrors, getErrors } from "@workpipe/lang";
import { resolveFiles } from "../utils/file-resolver.js";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../utils/exit-codes.js";

export interface CheckOptions {
  verbose: boolean;
  color: boolean;
}

function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(message);
  }
}

function hasImports(source: string): boolean {
  return /^import\s*\{/m.test(source);
}

function hasWorkflow(source: string): boolean {
  return /workflow\s+\w+\s*\{/.test(source);
}

interface FileInfo {
  path: string;
  source: string;
  hasImports: boolean;
  hasWorkflow: boolean;
}

interface LoadFilesResult {
  files: FileInfo[];
  errors: Array<{ path: string; message: string }>;
}

async function loadFiles(
  filePaths: string[],
  verbose: boolean
): Promise<LoadFilesResult> {
  const files: FileInfo[] = [];
  const errors: Array<{ path: string; message: string }> = [];
  for (const filePath of filePaths) {
    try {
      const source = await readFile(filePath, "utf-8");
      files.push({
        path: resolve(filePath),
        source,
        hasImports: hasImports(source),
        hasWorkflow: hasWorkflow(source),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Failed to read ${filePath}: ${message}`, verbose);
      errors.push({ path: filePath, message });
    }
  }
  return { files, errors };
}

function resolveImportPathSync(importPath: string, fromFile: string): string | null {
  const fromDir = dirname(fromFile);
  const resolved = join(fromDir, importPath).replace(/\\/g, "/");
  return resolved;
}

function getCompilationOrder(files: FileInfo[], verbose: boolean): FileInfo[] {
  const fileMap = new Map<string, FileInfo>();
  for (const file of files) {
    const normalized = file.path.replace(/\\/g, "/").toLowerCase();
    fileMap.set(normalized, file);
  }

  const anyHasImports = files.some((f) => f.hasImports);
  if (!anyHasImports) {
    return files;
  }

  const graph = new ImportGraph();

  for (const file of files) {
    const tree = parse(file.source);
    const fileAST = buildFileAST(tree, file.source);

    if (!fileAST) {
      continue;
    }

    const edges: Array<{ from: string; to: string; importedNames: string[] }> = [];

    for (const importDecl of fileAST.imports) {
      const resolvedPath = resolveImportPathSync(importDecl.path, file.path);
      if (resolvedPath) {
        edges.push({
          from: file.path,
          to: resolvedPath,
          importedNames: importDecl.items.map((item) => item.name),
        });
      }
    }

    graph.addFile(file.path, edges);
  }

  try {
    const order = graph.getTopologicalOrder();
    log(`Check order: ${order.map((p) => basename(p)).join(" -> ")}`, verbose);

    const orderedFiles: FileInfo[] = [];
    const seen = new Set<string>();

    for (const path of order) {
      const normalized = path.toLowerCase();
      const file = fileMap.get(normalized);
      if (file && !seen.has(normalized)) {
        orderedFiles.push(file);
        seen.add(normalized);
      }
    }

    for (const file of files) {
      const normalized = file.path.replace(/\\/g, "/").toLowerCase();
      if (!seen.has(normalized)) {
        orderedFiles.push(file);
        seen.add(normalized);
      }
    }

    return orderedFiles;
  } catch {
    log("Could not determine topological order, using file order", verbose);
    return files;
  }
}

export async function checkAction(
  files: string[],
  options: CheckOptions
): Promise<number> {
  const { verbose, color } = options;
  const useColor = color && process.stderr.isTTY;

  log(`Resolving files...`, verbose);
  const resolvedFiles = await resolveFiles(files);

  if (resolvedFiles.length === 0) {
    console.error("No WorkPipe files found");
    return EXIT_ERROR;
  }

  log(`Found ${resolvedFiles.length} file(s)`, verbose);

  const loadResult = await loadFiles(resolvedFiles, verbose);
  const { files: fileInfos, errors: loadErrors } = loadResult;

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const loadError of loadErrors) {
    console.error(`${loadError.path}: ${loadError.message}`);
    totalErrors++;
  }

  const anyHasImports = fileInfos.some((f) => f.hasImports);

  const projectRoot = process.cwd();
  const fileResolver = createNodeFileResolver(projectRoot);
  const importContext = anyHasImports
    ? createImportContext(fileResolver, projectRoot)
    : undefined;

  const orderedFiles = anyHasImports
    ? getCompilationOrder(fileInfos, verbose)
    : fileInfos;

  for (const fileInfo of orderedFiles) {
    const { path: file, source, hasImports: fileHasImports, hasWorkflow: fileHasWorkflow } = fileInfo;

    log(`Checking: ${file}`, verbose);

    try {
      let diagnostics: Diagnostic[] = [];
      let success = true;

      if (!fileHasWorkflow) {
        log(`  Type-only file, validating types`, verbose);
        const tree = parse(source);

        if (hasErrors(tree)) {
          const errors = getErrors(source);
          for (const error of errors) {
            diagnostics.push({
              code: "WP0001",
              severity: "error",
              message: error.message,
              span: { start: error.from, end: error.to },
            });
          }
          success = false;
        } else {
          const fileAST = buildFileAST(tree, source);

          if (fileAST) {
            const { registry, diagnostics: typeDiags } = buildTypeRegistry(fileAST);
            diagnostics.push(...typeDiags);
            diagnostics.push(...validateTypeReferences(fileAST, registry));
            success = !diagnostics.some((d) => d.severity === "error");
          } else {
            diagnostics.push({
              code: "WP0002",
              severity: "error",
              message: "Failed to parse file",
              span: { start: 0, end: source.length },
            });
            success = false;
          }
        }
      } else if (fileHasImports && importContext) {
        log(`  Using import-aware validation`, verbose);
        const result = await compileWithImports({
          source,
          filePath: file,
          importContext,
        });
        diagnostics = [...result.diagnostics];
        success = result.success;
      } else {
        const result = compile(source);
        diagnostics = [...result.diagnostics];
        success = result.success;
      }

      if (diagnostics.length > 0) {
        const formatted = formatDiagnostics(
          diagnostics,
          source,
          file,
          useColor
        );
        console.error(formatted);

        const counts = countDiagnostics(diagnostics);
        totalErrors += counts.errors;
        totalWarnings += counts.warnings;
      }

      if (success && verbose) {
        console.error(`OK ${file}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${file}: ${message}`);
      totalErrors++;
    }
  }

  if (totalErrors > 0 || totalWarnings > 0) {
    const summary = formatSummary(
      { errors: totalErrors, warnings: totalWarnings, infos: 0 },
      useColor
    );
    console.error(`\n${summary}`);
    return totalErrors > 0 ? EXIT_VALIDATION_FAILURE : EXIT_SUCCESS;
  }

  console.log(`All ${resolvedFiles.length} file(s) valid`);
  return EXIT_SUCCESS;
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check [files...]")
    .description("Check WorkPipe specs without writing output")
    .option("-v, --verbose", "Verbose output", false)
    .option("--no-color", "Disable colored output")
    .action(async (files: string[], options: CheckOptions) => {
      const exitCode = await checkAction(files, options);
      process.exit(exitCode);
    });
}
