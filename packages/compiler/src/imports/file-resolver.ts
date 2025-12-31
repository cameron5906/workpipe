/**
 * Node.js file system implementation of FileResolver.
 *
 * This resolver uses Node.js fs module for file operations.
 * It's used by the CLI and can be used in Node.js tests.
 */

import * as fs from "fs";
import * as path from "path";
import type { FileResolver } from "./resolver.js";
import { normalizePath, dirname, joinPath, isAbsolutePath } from "./resolver.js";

/**
 * Create a FileResolver that uses Node.js fs module.
 *
 * @param projectRoot - Optional project root for path resolution context
 * @returns A FileResolver implementation
 */
export function createNodeFileResolver(projectRoot?: string): FileResolver {
  const normalizedRoot = projectRoot ? normalizePath(path.resolve(projectRoot)) : undefined;

  return {
    async resolve(importPath: string, fromFile: string): Promise<string | null> {
      try {
        // Get the directory of the importing file
        const fromDir = dirname(normalizePath(path.resolve(fromFile)));

        // Resolve the import path relative to the importing file
        const resolved = joinPath(fromDir, importPath);
        const absolutePath = path.resolve(resolved);

        // Check if file exists
        const exists = await fs.promises.access(absolutePath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);

        if (!exists) {
          return null;
        }

        return normalizePath(absolutePath);
      } catch {
        return null;
      }
    },

    async read(filePath: string): Promise<string> {
      const absolutePath = isAbsolutePath(filePath)
        ? filePath
        : path.resolve(filePath);

      return fs.promises.readFile(absolutePath, "utf-8");
    },

    async exists(filePath: string): Promise<boolean> {
      const absolutePath = isAbsolutePath(filePath)
        ? filePath
        : path.resolve(filePath);

      try {
        await fs.promises.access(absolutePath, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Create a FileResolver that uses an in-memory file map.
 * Useful for testing without actual file system access.
 *
 * @param files - Map of file paths to contents
 * @returns A FileResolver implementation
 */
export function createMemoryFileResolver(
  files: Map<string, string> | Record<string, string>
): FileResolver {
  const fileMap = files instanceof Map
    ? files
    : new Map(Object.entries(files));

  // Normalize all paths in the map
  const normalizedMap = new Map<string, string>();
  for (const [path, content] of fileMap) {
    normalizedMap.set(normalizePath(path).toLowerCase(), content);
  }

  function findFile(filePath: string): string | undefined {
    const normalized = normalizePath(filePath).toLowerCase();
    return normalizedMap.get(normalized);
  }

  return {
    async resolve(importPath: string, fromFile: string): Promise<string | null> {
      const fromDir = dirname(normalizePath(fromFile));
      const resolved = joinPath(fromDir, importPath);
      const normalized = normalizePath(resolved);

      const content = findFile(normalized);
      if (content !== undefined) {
        return normalized;
      }

      return null;
    },

    async read(filePath: string): Promise<string> {
      const content = findFile(filePath);
      if (content === undefined) {
        throw new Error(`File not found: ${filePath}`);
      }
      return content;
    },

    async exists(filePath: string): Promise<boolean> {
      return findFile(filePath) !== undefined;
    },
  };
}
