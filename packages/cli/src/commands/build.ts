import { Command } from "commander";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename, resolve } from "path";
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

export interface BuildOptions {
  output: string;
  watch: boolean;
  dryRun: boolean;
  verbose: boolean;
  color: boolean;
}

function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(message);
  }
}

function extractWorkflowName(source: string, filePath: string): string {
  const match = source.match(/workflow\s+(\w+)\s*\{/);
  if (match) {
    return match[1];
  }
  const fileName = basename(filePath, ".workpipe");
  return fileName;
}

function hasWorkflow(source: string): boolean {
  return /workflow\s+\w+\s*\{/.test(source);
}

function hasImports(source: string): boolean {
  return /^import\s*\{/m.test(source);
}

interface FileInfo {
  path: string;
  source: string;
  hasWorkflow: boolean;
  hasImports: boolean;
}

async function loadFiles(
  filePaths: string[],
  verbose: boolean
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  for (const filePath of filePaths) {
    try {
      const source = await readFile(filePath, "utf-8");
      files.push({
        path: resolve(filePath),
        source,
        hasWorkflow: hasWorkflow(source),
        hasImports: hasImports(source),
      });
    } catch (error) {
      log(`Failed to read ${filePath}: ${error}`, verbose);
    }
  }
  return files;
}

function buildDependencyGraph(
  files: FileInfo[],
  importContext: ImportContext,
  verbose: boolean
): ImportGraph {
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
        log(`  Import: ${importDecl.path} -> ${resolvedPath}`, verbose);
      }
    }

    graph.addFile(file.path, edges);
  }

  return graph;
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
    log(`Compilation order: ${order.map((p) => basename(p)).join(" -> ")}`, verbose);

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

export async function buildAction(
  files: string[],
  options: BuildOptions
): Promise<number> {
  const { output, watch, dryRun, verbose, color } = options;
  const useColor = color && process.stdout.isTTY;

  if (watch) {
    console.error("Watch mode is not yet implemented");
    return EXIT_ERROR;
  }

  log(`Resolving files...`, verbose);
  const resolvedFiles = await resolveFiles(files);

  if (resolvedFiles.length === 0) {
    console.error("No WorkPipe files found");
    return EXIT_ERROR;
  }

  log(`Found ${resolvedFiles.length} file(s)`, verbose);

  const fileInfos = await loadFiles(resolvedFiles, verbose);
  const anyHasImports = fileInfos.some((f) => f.hasImports);

  const projectRoot = process.cwd();
  const fileResolver = createNodeFileResolver(projectRoot);
  const importContext = anyHasImports
    ? createImportContext(fileResolver, projectRoot)
    : undefined;

  const orderedFiles = anyHasImports
    ? getCompilationOrder(fileInfos, verbose)
    : fileInfos;

  let totalErrors = 0;
  let totalWarnings = 0;
  let filesWithWorkflows = 0;
  let typesOnlyFiles = 0;

  for (const fileInfo of orderedFiles) {
    const { path: file, source, hasWorkflow: fileHasWorkflow, hasImports: fileHasImports } = fileInfo;

    log(`Compiling: ${file}`, verbose);

    try {
      if (!fileHasWorkflow) {
        log(`  Type-only file, validating types`, verbose);
        const tree = parse(source);

        let diagnostics: Diagnostic[] = [];
        let success = true;

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

        if (success) {
          typesOnlyFiles++;
          console.log(`  ${basename(file)} (types only, no output)`);
        }
        continue;
      }

      let result;

      if (fileHasImports && importContext) {
        log(`  Using import-aware compilation`, verbose);
        result = await compileWithImports({
          source,
          filePath: file,
          importContext,
        });
      } else {
        result = compile(source);
      }

      if (result.diagnostics.length > 0) {
        const formatted = formatDiagnostics(
          result.diagnostics,
          source,
          file,
          useColor
        );
        console.error(formatted);

        const counts = countDiagnostics(result.diagnostics);
        totalErrors += counts.errors;
        totalWarnings += counts.warnings;
      }

      if (!result.success) {
        continue;
      }

      filesWithWorkflows++;
      const workflowName = extractWorkflowName(source, file);
      const outputPath = join(output, `${workflowName}.yml`);

      if (dryRun) {
        console.log(`Would write: ${outputPath}`);
        if (verbose) {
          console.log(result.value);
        }
      } else {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, result.value, "utf-8");
        console.log(`Wrote: ${outputPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error compiling ${file}: ${message}`);
      totalErrors++;
    }
  }

  if (totalErrors > 0 || totalWarnings > 0) {
    const summary = formatSummary(
      { errors: totalErrors, warnings: totalWarnings, infos: 0 },
      useColor
    );
    console.error(`\nBuild completed with ${summary}`);
  }

  return totalErrors > 0 ? EXIT_VALIDATION_FAILURE : EXIT_SUCCESS;
}

export function registerBuildCommand(program: Command): void {
  program
    .command("build [files...]")
    .description("Build WorkPipe specs into GitHub Actions workflows")
    .option("-o, --output <dir>", "Output directory", ".github/workflows/")
    .option("-w, --watch", "Watch mode for development", false)
    .option("--dry-run", "Show what would be generated without writing", false)
    .option("-v, --verbose", "Verbose output", false)
    .option("--no-color", "Disable colored output")
    .action(async (files: string[], options: BuildOptions) => {
      const exitCode = await buildAction(files, options);
      process.exit(exitCode);
    });
}
