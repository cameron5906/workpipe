/**
 * Import validation functions for WorkPipe.
 *
 * This module provides:
 * - Path validation (WP7006, WP7007)
 * - Cycle detection (WP7001)
 * - Duplicate import detection (WP7004)
 * - Type name suggestions using Levenshtein distance
 */

import type { Span } from "../ast/types.js";
import type { Diagnostic } from "../diagnostic/types.js";
import { semanticError } from "../diagnostic/builder.js";
import { IMPORT_DIAGNOSTICS } from "../diagnostics/index.js";
import type { ImportGraph } from "./dependency-graph.js";
import { isAbsolutePath, isValidRelativePath, isPathWithinRoot, normalizePath, dirname, joinPath } from "./resolver.js";

/**
 * Represents an import item in a source file.
 */
export interface ImportItemInfo {
  /** The type name being imported */
  name: string;
  /** Optional alias */
  alias?: string;
  /** Span of the import item in source */
  span: Span;
}

/**
 * Represents an import declaration in a source file.
 */
export interface ImportDeclaration {
  /** Import path (e.g., "./types.workpipe") */
  path: string;
  /** Items being imported */
  items: ImportItemInfo[];
  /** Span of the full import statement */
  span: Span;
}

/**
 * Calculate the Levenshtein distance between two strings.
 * Used for suggesting similar type names when a typo is detected.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find the closest matching string from a list of candidates.
 * Returns the best match if the distance is within threshold.
 *
 * @param target - The string to match against
 * @param candidates - List of possible matches
 * @param maxDistance - Maximum Levenshtein distance to consider (default: 3)
 * @returns The closest match, or undefined if none within threshold
 */
export function findClosestMatch(
  target: string,
  candidates: string[],
  maxDistance: number = 3
): string | undefined {
  if (candidates.length === 0) return undefined;

  let bestMatch: string | undefined;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(target.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestDistance <= maxDistance ? bestMatch : undefined;
}

/**
 * Validate an import path for basic syntax issues.
 * Returns diagnostics for WP7006 (invalid path) and WP7007 (escapes root).
 *
 * @param importPath - The import path to validate
 * @param fromFile - The file containing the import
 * @param projectRoot - Optional project root directory
 * @param span - Source span for error reporting
 */
export function validateImportPath(
  importPath: string,
  fromFile: string,
  projectRoot?: string,
  span?: Span
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const errorSpan = span ?? { start: 0, end: 0 };

  if (isAbsolutePath(importPath)) {
    diagnostics.push(
      semanticError(
        IMPORT_DIAGNOSTICS.INVALID_PATH.code,
        `Absolute import paths are not allowed: '${importPath}'`,
        errorSpan,
        IMPORT_DIAGNOSTICS.INVALID_PATH.hintTemplate
      )
    );
    return diagnostics;
  }

  if (!isValidRelativePath(importPath)) {
    diagnostics.push(
      semanticError(
        IMPORT_DIAGNOSTICS.INVALID_PATH.code,
        `Invalid import path: '${importPath}'`,
        errorSpan,
        "Import paths must start with './' or '../'"
      )
    );
    return diagnostics;
  }

  if (projectRoot) {
    const fromDir = dirname(normalizePath(fromFile));
    const resolvedPath = joinPath(fromDir, importPath);
    const normalizedPath = normalizePath(resolvedPath);

    if (!isPathWithinRoot(normalizedPath, projectRoot)) {
      diagnostics.push(
        semanticError(
          IMPORT_DIAGNOSTICS.PATH_ESCAPES_ROOT.code,
          `Import path escapes project root: '${importPath}'`,
          errorSpan,
          `Resolved path '${normalizedPath}' is outside the project root '${projectRoot}'`
        )
      );
    }
  }

  return diagnostics;
}

/**
 * Detect circular imports in a dependency graph.
 * Returns a WP7001 diagnostic if a cycle is detected.
 *
 * @param graph - The import dependency graph
 * @param entryFile - The file to check for cycles from
 * @param span - Source span for error reporting
 */
export function detectCircularImports(
  graph: ImportGraph,
  entryFile: string,
  span?: Span
): Diagnostic | null {
  if (!graph.hasCycle()) {
    return null;
  }

  const cycle = graph.getCycle();
  if (!cycle) {
    return null;
  }

  const errorSpan = span ?? { start: 0, end: 0 };
  const cyclePath = cycle.map((p) => getFileName(p)).join(" -> ");

  return semanticError(
    IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.code,
    "Circular import detected",
    errorSpan,
    `Import cycle: ${cyclePath}. ${IMPORT_DIAGNOSTICS.CIRCULAR_IMPORT.hintTemplate}`
  );
}

/**
 * Build a cycle path string from file paths.
 */
function getFileName(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash === -1 ? normalized : normalized.substring(lastSlash + 1);
}

/**
 * Detect duplicate imports within a single file.
 * Returns WP7004 diagnostics for each duplicate.
 *
 * @param imports - All import declarations in the file
 */
export function detectDuplicateImports(
  imports: ImportDeclaration[]
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seenImports = new Map<string, { path: string; span: Span }>();

  for (const importDecl of imports) {
    for (const item of importDecl.items) {
      const key = `${importDecl.path}:${item.name}`;
      const existing = seenImports.get(key);

      if (existing) {
        diagnostics.push(
          semanticError(
            IMPORT_DIAGNOSTICS.DUPLICATE_IMPORT.code,
            `Duplicate import: '${item.name}' is already imported from '${importDecl.path}'`,
            item.span,
            IMPORT_DIAGNOSTICS.DUPLICATE_IMPORT.hintTemplate
          )
        );
      } else {
        seenImports.set(key, { path: importDecl.path, span: item.span });
      }
    }
  }

  return diagnostics;
}

/**
 * Create a diagnostic for a type not found in the source file.
 * Includes Levenshtein-based suggestions for typos.
 *
 * @param typeName - The requested type name
 * @param sourcePath - The path of the source file
 * @param availableTypes - Types available in the source file
 * @param span - Source span for error reporting
 */
export function createTypeNotFoundDiagnostic(
  typeName: string,
  sourcePath: string,
  availableTypes: string[],
  span: Span
): Diagnostic {
  const suggestion = findClosestMatch(typeName, availableTypes);
  let hint: string;

  if (suggestion) {
    hint = `Did you mean '${suggestion}'?`;
    if (availableTypes.length > 1) {
      hint += ` Available types: ${availableTypes.join(", ")}`;
    }
  } else if (availableTypes.length > 0) {
    hint = `Available types in '${sourcePath}': ${availableTypes.join(", ")}`;
  } else {
    hint = `No exportable types are available in '${sourcePath}'`;
  }

  return semanticError(
    IMPORT_DIAGNOSTICS.TYPE_NOT_EXPORTED.code,
    `Type '${typeName}' does not exist in '${sourcePath}'`,
    span,
    hint
  );
}

/**
 * Create a diagnostic for a name collision.
 *
 * @param localName - The colliding local name
 * @param existingSource - Where the existing type came from (file path or "local")
 * @param isAlias - Whether the collision is with an alias
 * @param span - Source span for error reporting
 */
export function createNameCollisionDiagnostic(
  localName: string,
  sourceName: string,
  existingSource: string | undefined,
  isAlias: boolean,
  span: Span
): Diagnostic {
  const sourceInfo = existingSource
    ? `imported from '${existingSource}'`
    : "defined locally";

  const hint = isAlias
    ? "Consider using a different alias"
    : `Use 'import { ${sourceName} as <different_name> }' to avoid collision`;

  return semanticError(
    IMPORT_DIAGNOSTICS.NAME_COLLISION.code,
    `Name collision: '${localName}' already exists (${sourceInfo})`,
    span,
    hint
  );
}

/**
 * Create a diagnostic for file not found.
 *
 * @param importPath - The import path that could not be resolved
 * @param span - Source span for error reporting
 */
export function createFileNotFoundDiagnostic(
  importPath: string,
  span: Span
): Diagnostic {
  return semanticError(
    IMPORT_DIAGNOSTICS.FILE_NOT_FOUND.code,
    `Cannot resolve import path '${importPath}'`,
    span,
    IMPORT_DIAGNOSTICS.FILE_NOT_FOUND.hintTemplate
  );
}

/**
 * Validate all imports in a file and return diagnostics.
 *
 * @param imports - Import declarations to validate
 * @param fromFile - The file containing the imports
 * @param projectRoot - Optional project root
 */
export function validateImports(
  imports: ImportDeclaration[],
  fromFile: string,
  projectRoot?: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const importDecl of imports) {
    diagnostics.push(
      ...validateImportPath(importDecl.path, fromFile, projectRoot, importDecl.span)
    );
  }

  diagnostics.push(...detectDuplicateImports(imports));

  return diagnostics;
}
