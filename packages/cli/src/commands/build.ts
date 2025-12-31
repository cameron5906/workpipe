import { Command } from "commander";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
import {
  compile,
  formatDiagnostics,
  countDiagnostics,
  formatSummary,
} from "@workpipe/compiler";
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

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of resolvedFiles) {
    log(`Compiling: ${file}`, verbose);

    try {
      const source = await readFile(file, "utf-8");
      const result = compile(source);

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
