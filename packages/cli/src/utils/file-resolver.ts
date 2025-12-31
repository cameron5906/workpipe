import { glob } from "glob";
import path from "node:path";

export const DEFAULT_PATTERNS = ["**/*.workpipe", "**/*.wp"];

export const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.github/workflows/**",
];

export interface ResolveFilesOptions {
  cwd?: string;
  patterns?: string[];
  ignore?: string[];
}

export async function resolveFiles(
  files: string[],
  options: ResolveFilesOptions = {}
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    patterns = DEFAULT_PATTERNS,
    ignore = IGNORE_PATTERNS,
  } = options;

  if (files.length > 0) {
    const resolved: string[] = [];
    for (const file of files) {
      const absolutePath = path.isAbsolute(file) ? file : path.join(cwd, file);
      const matches = await glob(file, {
        cwd,
        ignore,
        absolute: true,
        nodir: true,
      });
      if (matches.length > 0) {
        resolved.push(...matches);
      } else {
        resolved.push(absolutePath);
      }
    }
    return [...new Set(resolved)];
  }

  const allMatches: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd,
      ignore,
      absolute: true,
      nodir: true,
    });
    allMatches.push(...matches);
  }

  return [...new Set(allMatches)];
}
