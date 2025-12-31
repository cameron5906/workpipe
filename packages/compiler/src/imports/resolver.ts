/**
 * Path resolution for WorkPipe import statements.
 *
 * Per ADR-0012:
 * - Only relative paths are allowed (must start with ./ or ../)
 * - .workpipe extension is required (no implicit extension)
 * - Paths are normalized (resolve .., convert \ to /)
 * - Absolute paths are rejected (WP7006)
 * - Paths escaping project root are rejected (WP7007)
 */

import type { Span } from "../ast/types.js";
import type { Diagnostic } from "../diagnostic/types.js";
import { semanticError } from "../diagnostic/builder.js";

/**
 * File system abstraction for reading and checking files.
 * Implementations can use Node.js fs, VS Code workspace fs, or in-memory maps.
 */
export interface FileResolver {
  /**
   * Resolve an import path to an absolute path.
   * Returns null if the file does not exist.
   */
  resolve(importPath: string, fromFile: string): Promise<string | null>;

  /**
   * Read file contents.
   */
  read(filePath: string): Promise<string>;

  /**
   * Check if a file exists.
   */
  exists(filePath: string): Promise<boolean>;
}

/**
 * Represents a successfully resolved import.
 */
export interface ResolvedImport {
  /** Original path from import statement */
  importPath: string;
  /** Absolute normalized path */
  resolvedPath: string;
  /** File containing the import */
  fromFile: string;
}

/**
 * Result of path resolution - either success or a diagnostic error.
 */
export type ResolveResult =
  | { success: true; resolvedPath: string; normalizedPath: string }
  | { success: false; diagnostic: Diagnostic };

/**
 * Normalize a file path:
 * - Convert backslashes to forward slashes
 * - Resolve . and .. segments
 * - Remove duplicate slashes
 * - Preserve leading ./ for relative paths
 */
export function normalizePath(path: string): string {
  // Convert backslashes to forward slashes
  let normalized = path.replace(/\\/g, "/");

  // Remove duplicate slashes (but preserve leading // for UNC paths on Windows)
  normalized = normalized.replace(/([^:])\/+/g, "$1/");

  // Split into segments
  const segments = normalized.split("/");
  const result: string[] = [];
  let isAbsolute = false;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (i === 0) {
      // Handle root indicators
      if (segment === "" && segments.length > 1) {
        // Unix absolute path like /foo/bar
        isAbsolute = true;
        result.push("");
        continue;
      }
      if (/^[a-zA-Z]:$/.test(segment)) {
        // Windows drive letter like C:
        isAbsolute = true;
        result.push(segment);
        continue;
      }
    }

    if (segment === "." && result.length > 0) {
      // Skip . unless it's the first segment
      continue;
    }

    if (segment === "..") {
      // Go up one level, but don't go above root or initial ./
      if (result.length > 0 && result[result.length - 1] !== ".." && result[result.length - 1] !== "") {
        // Check we're not removing a drive letter
        if (!/^[a-zA-Z]:$/.test(result[result.length - 1])) {
          result.pop();
          continue;
        }
      }
      if (!isAbsolute && result.length === 0) {
        // Preserve leading .. for relative paths that escape
        result.push(segment);
        continue;
      }
      if (!isAbsolute && result[0] === ".") {
        // Remove the . and replace with ..
        result.shift();
        result.push(segment);
        continue;
      }
      if (!isAbsolute) {
        result.push(segment);
        continue;
      }
      // For absolute paths, we can't go above root
      continue;
    }

    if (segment !== "") {
      result.push(segment);
    }
  }

  // Ensure we have at least something
  if (result.length === 0) {
    return ".";
  }

  // Join and return
  return result.join("/");
}

/**
 * Check if a path is absolute.
 */
export function isAbsolutePath(path: string): boolean {
  // Unix absolute path
  if (path.startsWith("/")) {
    return true;
  }
  // Windows absolute path (C:\ or C:/)
  if (/^[a-zA-Z]:[/\\]/.test(path)) {
    return true;
  }
  // Windows UNC path
  if (path.startsWith("\\\\") || path.startsWith("//")) {
    return true;
  }
  return false;
}

/**
 * Check if a path is a valid relative import path.
 * Valid paths must start with ./ or ../
 */
export function isValidRelativePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("./") || normalized.startsWith("../");
}

/**
 * Get the directory part of a file path.
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return ".";
  }
  if (lastSlash === 0) {
    return "/";
  }
  return normalized.substring(0, lastSlash);
}

/**
 * Join path segments together.
 */
export function joinPath(...segments: string[]): string {
  if (segments.length === 0) {
    return ".";
  }

  let result = segments[0];
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (!result.endsWith("/")) {
      result += "/";
    }
    result += segment;
  }

  return normalizePath(result);
}

/**
 * Check if a resolved path is within the project root.
 * Used to prevent imports from escaping the project directory.
 */
export function isPathWithinRoot(path: string, root: string): boolean {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedRoot = normalizePath(root).toLowerCase();

  // Ensure root ends without slash for comparison
  const rootWithoutSlash = normalizedRoot.endsWith("/")
    ? normalizedRoot.slice(0, -1)
    : normalizedRoot;

  // Path must start with root
  if (!normalizedPath.startsWith(rootWithoutSlash)) {
    return false;
  }

  // Check that it's actually within the root (not just a prefix match)
  // e.g., /root/foo should match /root but not /rootfoo
  const remaining = normalizedPath.substring(rootWithoutSlash.length);
  return remaining === "" || remaining.startsWith("/");
}

/**
 * Resolve a relative import path to an absolute path.
 *
 * @param importPath - The path from the import statement (e.g., "./types.workpipe")
 * @param fromFile - Absolute path of the file containing the import
 * @param projectRoot - Optional project root to check for escape
 * @param span - Source span for error reporting
 * @returns ResolveResult with either the resolved path or a diagnostic
 */
export function resolveImportPath(
  importPath: string,
  fromFile: string,
  projectRoot?: string,
  span?: Span
): ResolveResult {
  const errorSpan = span ?? { start: 0, end: 0 };

  // Check for absolute paths (WP7006)
  if (isAbsolutePath(importPath)) {
    return {
      success: false,
      diagnostic: semanticError(
        "WP7006",
        `Absolute import paths are not allowed: '${importPath}'`,
        errorSpan,
        "Use a relative path starting with './' or '../'"
      ),
    };
  }

  // Check for valid relative path
  if (!isValidRelativePath(importPath)) {
    return {
      success: false,
      diagnostic: semanticError(
        "WP7006",
        `Invalid import path: '${importPath}'`,
        errorSpan,
        "Import paths must start with './' or '../'"
      ),
    };
  }

  // Get the directory of the importing file
  const fromDir = dirname(fromFile);

  // Join and normalize the path
  const resolvedPath = joinPath(fromDir, importPath);
  const normalizedPath = normalizePath(resolvedPath);

  // Check if path escapes project root (WP7007)
  if (projectRoot && !isPathWithinRoot(normalizedPath, projectRoot)) {
    return {
      success: false,
      diagnostic: semanticError(
        "WP7007",
        `Import path escapes project root: '${importPath}'`,
        errorSpan,
        `Resolved path '${normalizedPath}' is outside the project root '${projectRoot}'`
      ),
    };
  }

  return {
    success: true,
    resolvedPath: normalizedPath,
    normalizedPath: normalizePath(importPath),
  };
}
