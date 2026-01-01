/**
 * Import system for WorkPipe cross-file type sharing.
 *
 * This module provides:
 * - Path resolution for relative imports
 * - File system abstraction for reading files
 * - Utilities for path normalization and validation
 * - Import validation and cycle detection
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

export type { ImportEdge } from "./dependency-graph.js";

export { ImportGraph } from "./dependency-graph.js";

export type {
  ImportItemInfo,
  ImportDeclaration,
} from "./validation.js";

export {
  levenshteinDistance,
  findClosestMatch,
  validateImportPath,
  detectCircularImports,
  detectDuplicateImports,
  createTypeNotFoundDiagnostic,
  createNameCollisionDiagnostic,
  createFileNotFoundDiagnostic,
  validateImports,
} from "./validation.js";
