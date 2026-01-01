/**
 * Diagnostic code definitions for WorkPipe compiler.
 *
 * Codes are organized by category:
 * - WP0xxx: Parse/AST errors
 * - WP2xxx: Output validation
 * - WP3xxx: Schema validation
 * - WP4xxx: Matrix validation
 * - WP5xxx: Type validation
 * - WP6xxx: Cycle validation
 * - WP7xxx: Import validation
 * - WP8xxx: Semantic validation (required fields)
 */

/**
 * Diagnostic code for a specific error type.
 */
export interface DiagnosticCodeInfo {
  /** The diagnostic code (e.g., "WP7001") */
  code: string;
  /** Default severity for this diagnostic */
  severity: "error" | "warning" | "info";
  /** Short description of the error */
  description: string;
  /** Template hint message (may contain {placeholders}) */
  hintTemplate?: string;
}

/**
 * Import validation diagnostic codes (WP7xxx).
 */
export const IMPORT_DIAGNOSTICS = {
  /**
   * WP7001: Circular import detected.
   * Thrown when the dependency graph contains a cycle.
   */
  CIRCULAR_IMPORT: {
    code: "WP7001",
    severity: "error",
    description: "Circular import detected",
    hintTemplate: "Extract shared types to a third file that both can import",
  },

  /**
   * WP7002: Import file not found.
   * The specified import path does not resolve to an existing file.
   */
  FILE_NOT_FOUND: {
    code: "WP7002",
    severity: "error",
    description: "Import file not found",
    hintTemplate: "Check that the file exists and the path is correct",
  },

  /**
   * WP7003: Type not exported.
   * The requested type does not exist in the source file, or is not exportable.
   */
  TYPE_NOT_EXPORTED: {
    code: "WP7003",
    severity: "error",
    description: "Type not exported by imported file",
    hintTemplate: "Available types: {availableTypes}",
  },

  /**
   * WP7004: Duplicate import.
   * The same type is imported more than once in a file.
   */
  DUPLICATE_IMPORT: {
    code: "WP7004",
    severity: "error",
    description: "Duplicate import of same type",
    hintTemplate: "Remove the duplicate import",
  },

  /**
   * WP7005: Name collision.
   * An imported type name conflicts with a local type or another import.
   */
  NAME_COLLISION: {
    code: "WP7005",
    severity: "error",
    description: "Name collision with existing type",
    hintTemplate: "Use 'import { {typeName} as <different_name> }' to avoid collision",
  },

  /**
   * WP7006: Invalid import path.
   * The import path is malformed (e.g., absolute path).
   */
  INVALID_PATH: {
    code: "WP7006",
    severity: "error",
    description: "Invalid import path",
    hintTemplate: "Use a relative path starting with './' or '../'",
  },

  /**
   * WP7007: Path escapes project root.
   * The resolved import path is outside the project directory.
   */
  PATH_ESCAPES_ROOT: {
    code: "WP7007",
    severity: "error",
    description: "Import path resolves outside project root",
    hintTemplate: "Keep all imported files within the project directory",
  },
} as const satisfies Record<string, DiagnosticCodeInfo>;

/**
 * Semantic validation diagnostic codes (WP8xxx).
 * Formerly WP7xxx - moved to avoid conflict with import codes.
 */
export const SEMANTIC_DIAGNOSTICS = {
  /**
   * WP8001: Job missing runs_on.
   * A job block does not specify which runner to use.
   */
  JOB_MISSING_RUNS_ON: {
    code: "WP8001",
    severity: "error",
    description: "Job missing required 'runs_on' field",
    hintTemplate: "Add 'runs_on: ubuntu-latest' or another runner",
  },

  /**
   * WP8002: Agent job missing runs_on.
   * An agent_job block does not specify which runner to use.
   */
  AGENT_JOB_MISSING_RUNS_ON: {
    code: "WP8002",
    severity: "error",
    description: "Agent job missing required 'runs_on' field",
    hintTemplate: "Add 'runs_on: ubuntu-latest' or another runner",
  },

  /**
   * WP8004: Empty workflow.
   * A workflow has no jobs or cycles defined.
   */
  EMPTY_WORKFLOW: {
    code: "WP8004",
    severity: "warning",
    description: "Workflow has no jobs or cycles",
    hintTemplate: "Add at least one job or cycle to the workflow",
  },
} as const satisfies Record<string, DiagnosticCodeInfo>;

/**
 * All diagnostic codes.
 */
export const DIAGNOSTIC_CODES = {
  ...IMPORT_DIAGNOSTICS,
  ...SEMANTIC_DIAGNOSTICS,
} as const;

/**
 * Get diagnostic info by code.
 */
export function getDiagnosticInfo(code: string): DiagnosticCodeInfo | undefined {
  return Object.values(DIAGNOSTIC_CODES).find((info) => info.code === code);
}
