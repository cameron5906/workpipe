import { readFile } from "fs/promises";
import { Command } from "commander";
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

export interface CheckOptions {
  verbose: boolean;
  color: boolean;
}

function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(message);
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

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of resolvedFiles) {
    log(`Checking: ${file}`, verbose);

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

      if (result.success && verbose) {
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
