/**
 * Import system for WorkPipe cross-file type sharing.
 *
 * This module provides:
 * - Path resolution for relative imports
 * - File system abstraction for reading files
 * - Utilities for path normalization and validation
 */

export type {
  FileResolver,
  ResolvedImport,
  ResolveResult,
} from "./resolver.js";

export {
  normalizePath,
  isAbsolutePath,
  isValidRelativePath,
  isPathWithinRoot,
  dirname,
  joinPath,
  resolveImportPath,
} from "./resolver.js";

export {
  createNodeFileResolver,
  createMemoryFileResolver,
} from "./file-resolver.js";
