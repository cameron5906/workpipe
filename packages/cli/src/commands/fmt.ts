import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { format } from "@workpipe/compiler";
import { resolveFiles } from "../utils/file-resolver.js";
import {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_VALIDATION_FAILURE,
} from "../utils/exit-codes.js";

export interface FmtOptions {
  write: boolean;
  check: boolean;
}

export async function fmtAction(
  files: string[],
  options: FmtOptions
): Promise<number> {
  const { write, check } = options;

  const resolvedFiles = await resolveFiles(files);

  if (resolvedFiles.length === 0) {
    console.error("No WorkPipe files found");
    return EXIT_ERROR;
  }

  let needsFormatting = false;

  for (const file of resolvedFiles) {
    try {
      const source = await readFile(file, "utf-8");
      const formatted = format(source);

      if (check) {
        if (source !== formatted) {
          console.log(`Would format: ${file}`);
          needsFormatting = true;
        }
      } else if (write) {
        if (source !== formatted) {
          await writeFile(file, formatted, "utf-8");
          console.log(`Formatted: ${file}`);
        }
      } else {
        process.stdout.write(formatted);
      }
    } catch (error) {
      console.error(`Error processing ${file}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT_ERROR;
    }
  }

  if (check && needsFormatting) {
    return EXIT_VALIDATION_FAILURE;
  }

  return EXIT_SUCCESS;
}

export function registerFmtCommand(program: Command): void {
  program
    .command("fmt [files...]")
    .description("Format WorkPipe spec files")
    .option("--write", "Write formatted output back to files", false)
    .option("--check", "Exit with error if files need formatting", false)
    .action(async (files: string[], options: FmtOptions) => {
      const exitCode = await fmtAction(files, options);
      process.exit(exitCode);
    });
}
