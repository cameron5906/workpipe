/**
 * Fragment Registry for WorkPipe compiler.
 *
 * This module provides a registry for storing and retrieving fragment definitions
 * (both job fragments and steps fragments) during compilation. It handles:
 * - Fragment registration by name
 * - Duplicate name detection
 * - Fragment lookup for instantiation/expansion
 */

import type {
  JobFragmentNode,
  StepsFragmentNode,
  WorkPipeFileNode,
  Span,
} from "../ast/types.js";
import { semanticError, type Diagnostic } from "../diagnostic/index.js";

/**
 * Registry interface for managing fragment definitions.
 */
export interface FragmentRegistry {
  /** Register a job fragment definition */
  registerJobFragment(node: JobFragmentNode): Diagnostic | null;
  /** Register a steps fragment definition */
  registerStepsFragment(node: StepsFragmentNode): Diagnostic | null;
  /** Look up a job fragment by name */
  getJobFragment(name: string): JobFragmentNode | undefined;
  /** Look up a steps fragment by name */
  getStepsFragment(name: string): StepsFragmentNode | undefined;
  /** Check if a job fragment exists */
  hasJobFragment(name: string): boolean;
  /** Check if a steps fragment exists */
  hasStepsFragment(name: string): boolean;
  /** Get all registered job fragment names */
  getJobFragmentNames(): string[];
  /** Get all registered steps fragment names */
  getStepsFragmentNames(): string[];
}

/**
 * Fragment diagnostic codes (WP9xxx series).
 */
export const FRAGMENT_DIAGNOSTICS = {
  /** WP9001: Fragment not found during instantiation */
  FRAGMENT_NOT_FOUND: {
    code: "WP9001",
    severity: "error" as const,
    description: "Fragment not found",
  },
  /** WP9002: Missing required parameter during instantiation */
  MISSING_REQUIRED_PARAM: {
    code: "WP9002",
    severity: "error" as const,
    description: "Missing required parameter",
  },
  /** WP9003: Unknown parameter provided to fragment */
  UNKNOWN_PARAM: {
    code: "WP9003",
    severity: "error" as const,
    description: "Unknown parameter",
  },
  /** WP9004: Parameter type mismatch */
  PARAM_TYPE_MISMATCH: {
    code: "WP9004",
    severity: "error" as const,
    description: "Parameter type mismatch",
  },
  /** WP9005: Duplicate fragment name */
  DUPLICATE_FRAGMENT: {
    code: "WP9005",
    severity: "error" as const,
    description: "Duplicate fragment name",
  },
} as const;

/**
 * Internal implementation of FragmentRegistry.
 */
class FragmentRegistryImpl implements FragmentRegistry {
  private jobFragments = new Map<string, JobFragmentNode>();
  private stepsFragments = new Map<string, StepsFragmentNode>();

  registerJobFragment(node: JobFragmentNode): Diagnostic | null {
    if (this.jobFragments.has(node.name)) {
      const existing = this.jobFragments.get(node.name)!;
      return semanticError(
        FRAGMENT_DIAGNOSTICS.DUPLICATE_FRAGMENT.code,
        `Duplicate job fragment name '${node.name}'. A job fragment with this name already exists.`,
        node.span,
        `Rename this fragment or remove the duplicate definition at position ${existing.span.start}`
      );
    }
    if (this.stepsFragments.has(node.name)) {
      const existing = this.stepsFragments.get(node.name)!;
      return semanticError(
        FRAGMENT_DIAGNOSTICS.DUPLICATE_FRAGMENT.code,
        `Fragment name '${node.name}' conflicts with an existing steps fragment.`,
        node.span,
        `Rename this fragment or remove the duplicate definition at position ${existing.span.start}`
      );
    }
    this.jobFragments.set(node.name, node);
    return null;
  }

  registerStepsFragment(node: StepsFragmentNode): Diagnostic | null {
    if (this.stepsFragments.has(node.name)) {
      const existing = this.stepsFragments.get(node.name)!;
      return semanticError(
        FRAGMENT_DIAGNOSTICS.DUPLICATE_FRAGMENT.code,
        `Duplicate steps fragment name '${node.name}'. A steps fragment with this name already exists.`,
        node.span,
        `Rename this fragment or remove the duplicate definition at position ${existing.span.start}`
      );
    }
    if (this.jobFragments.has(node.name)) {
      const existing = this.jobFragments.get(node.name)!;
      return semanticError(
        FRAGMENT_DIAGNOSTICS.DUPLICATE_FRAGMENT.code,
        `Fragment name '${node.name}' conflicts with an existing job fragment.`,
        node.span,
        `Rename this fragment or remove the duplicate definition at position ${existing.span.start}`
      );
    }
    this.stepsFragments.set(node.name, node);
    return null;
  }

  getJobFragment(name: string): JobFragmentNode | undefined {
    return this.jobFragments.get(name);
  }

  getStepsFragment(name: string): StepsFragmentNode | undefined {
    return this.stepsFragments.get(name);
  }

  hasJobFragment(name: string): boolean {
    return this.jobFragments.has(name);
  }

  hasStepsFragment(name: string): boolean {
    return this.stepsFragments.has(name);
  }

  getJobFragmentNames(): string[] {
    return Array.from(this.jobFragments.keys());
  }

  getStepsFragmentNames(): string[] {
    return Array.from(this.stepsFragments.keys());
  }
}

/**
 * Create a new empty FragmentRegistry.
 */
export function createFragmentRegistry(): FragmentRegistry {
  return new FragmentRegistryImpl();
}

/**
 * Result of building a fragment registry from a file AST.
 */
export interface FragmentRegistryBuildResult {
  registry: FragmentRegistry;
  diagnostics: Diagnostic[];
}

/**
 * Build a FragmentRegistry from a WorkPipeFileNode.
 * Registers all job fragments and steps fragments found in the file.
 */
export function buildFragmentRegistry(
  fileAST: WorkPipeFileNode
): FragmentRegistryBuildResult {
  const registry = createFragmentRegistry();
  const diagnostics: Diagnostic[] = [];

  for (const fragment of fileAST.jobFragments) {
    const error = registry.registerJobFragment(fragment);
    if (error) {
      diagnostics.push(error);
    }
  }

  for (const fragment of fileAST.stepsFragments) {
    const error = registry.registerStepsFragment(fragment);
    if (error) {
      diagnostics.push(error);
    }
  }

  return { registry, diagnostics };
}

/**
 * Create a diagnostic for when a fragment is not found.
 */
export function createFragmentNotFoundDiagnostic(
  fragmentName: string,
  span: Span,
  fragmentType: "job" | "steps",
  availableFragments: string[]
): Diagnostic {
  const available = availableFragments.length > 0
    ? `Available ${fragmentType} fragments: ${availableFragments.join(", ")}`
    : `No ${fragmentType} fragments are defined in this file`;

  return semanticError(
    FRAGMENT_DIAGNOSTICS.FRAGMENT_NOT_FOUND.code,
    `${fragmentType === "job" ? "Job" : "Steps"} fragment '${fragmentName}' not found.`,
    span,
    available
  );
}

/**
 * Create a diagnostic for when a required parameter is missing.
 */
export function createMissingParamDiagnostic(
  fragmentName: string,
  paramName: string,
  span: Span
): Diagnostic {
  return semanticError(
    FRAGMENT_DIAGNOSTICS.MISSING_REQUIRED_PARAM.code,
    `Missing required parameter '${paramName}' for fragment '${fragmentName}'.`,
    span,
    `Add '${paramName} = <value>' to the fragment instantiation`
  );
}

/**
 * Create a diagnostic for when an unknown parameter is provided.
 */
export function createUnknownParamDiagnostic(
  fragmentName: string,
  paramName: string,
  span: Span,
  availableParams: string[]
): Diagnostic {
  const available = availableParams.length > 0
    ? `Available parameters: ${availableParams.join(", ")}`
    : "This fragment has no parameters";

  return semanticError(
    FRAGMENT_DIAGNOSTICS.UNKNOWN_PARAM.code,
    `Unknown parameter '${paramName}' for fragment '${fragmentName}'.`,
    span,
    available
  );
}
