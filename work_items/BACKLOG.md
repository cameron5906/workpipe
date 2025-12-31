# WorkPipe Backlog

## Overview

This backlog tracks all work items for the WorkPipe project - a DSL compiler that generates GitHub Actions workflow YAML files.

**Project Milestones** (from design doc):
- **Milestone A**: Vertical slice (end-to-end) - One .workpipe file compiles to working YAML
- **Milestone B**: Strategy B cycle support
- **Milestone C**: Guards + advanced triggers
- **Milestone D**: Matrices
- **Milestone E**: Tooling (VS Code extension)
- **Milestone A++**: User-Defined Type System (NEW - User Directive)

**Implementation Phases** (from PROJECT.md):
- Phase 0: Repo + contracts
- Phase 1: Parser + AST + formatter
- Phase 2: Minimal workflow codegen
- Phase 3: Types + outputs
- Phase 3+: User-Defined Types (NEW)
- Phase 4: Artifacts
- Phase 5: Guards
- Phase 6: Matrices
- Phase 7: Agent tasks
- Phase 8: Cycles (Strategy B)
- Phase 9: Tooling polish

---

## In Progress

(None currently)

---

## Up Next (Priority Order)

(None - All backlog items have been completed)

---

## MILESTONE A++ COMPLETE: USER-DEFINED TYPE SYSTEM

All user-defined type system work items successfully completed on 2025-12-31.
The entire feature is production-ready with:
- Grammar and parser support for `type` declarations
- Type registry and resolver with WP5001/WP5002 diagnostics
- Type references in job outputs and agent task schemas
- Property access validation with WP5003 diagnostics
- VS Code extension integration with diagnostics, code actions, and hover info
- Comprehensive documentation and examples

---

## PROJECT STATUS SUMMARY

| Milestone | Status | Description |
|-----------|--------|-------------|
| **A** | COMPLETE | Vertical slice - end-to-end compilation |
| **A+** | COMPLETE | Agent tasks + diagnostics + formatter |
| **A++** | COMPLETE | User-Defined Type System (User Directive) |
| **B** | COMPLETE | Strategy B cycles with full safety |
| **C** | COMPLETE | Guards + advanced triggers |
| **D** | COMPLETE | Matrices |
| **E** | COMPLETE | Tooling (VS Code extension + bootstrap) |
| **Future** | IN PROGRESS | Import system research and design (ADR-0012 Proposed) |

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| 0: Repo + contracts | COMPLETE | Monorepo, CLI contracts |
| 1: Parser + AST + formatter | COMPLETE | Lezer grammar, AST, fmt command |
| 2: Minimal workflow codegen | COMPLETE | YAML IR, build command |
| 3: Types + outputs | COMPLETE | Diagnostics, job outputs, schema validation |
| 3+: User-Defined Types | COMPLETE | Type declarations, registry, validation, VS Code integration |
| 4: Artifacts | COMPLETE | Cycle artifacts, matrix fingerprinting |
| 5: Guards | COMPLETE | guard_js compilation, outputs, helper library |
| 6: Matrices | COMPLETE | Matrix syntax, include/exclude, artifact fingerprinting, validation |
| 7: Agent tasks | COMPLETE | Claude Code Action integration |
| 8: Cycles (Strategy B) | COMPLETE | Phased execution, concurrency |
| 9: Tooling polish | COMPLETE | VS Code extension, bootstrap workflow |

**Test Count:** 643 tests (71 lang + 572 compiler)
**Work Items Completed:** 79 (WI-001 through WI-079)
**Work Items In Progress:** 0
**Work Items In Backlog:** 0
**CLI Commands:** 4 (build, check, fmt, init)
**Packages:** 5 (lang, compiler, cli, action, vscode-extension)

---

## MILESTONE A++ OVERVIEW: USER-DEFINED TYPE SYSTEM

**User Directive**: WorkPipe MUST support user-defined types.

**Key Benefits:**
- Define complex JSON shapes once, use across multiple jobs
- Compiler generates JSON Schema FROM type definitions
- Compile-time validation catches property access errors
- VS Code shows diagnostics for type errors

**Proposed Syntax:**

```workpipe
type BuildInfo {
  version: string
  commit: string
  artifacts: [{
    name: string
    path: string
  }]
}

workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo  // Reference named type
    }
  }

  agent_job review {
    runs_on: ubuntu-latest
    agent_task "reviewer" {
      output_schema = BuildInfo  // Type becomes JSON Schema
    }
  }

  job deploy {
    needs: [build]
    steps: [
      // Compiler validates: info.version exists on BuildInfo
      run("echo ${{ needs.build.outputs.info.version }}")
    ]
  }
}
```

**New Diagnostics:**
- WP5001: Duplicate type name
- WP5002: Undefined type reference
- WP5003: Property does not exist on type

---

## Ready for Development

### Phase 9: Tooling (Milestone E) - Remaining
(All core tooling work items complete. WI-039 delivered code actions and hover provider.)

### Future Enhancements (Phase 3+)
5. **WI-046: Type System for Task/Job Data Flow** - COMPLETE (see Completed section)
   - Delivered in phases: Job outputs complete, agent task schemas in WI-056

### Milestone C: Guards (Phase 5)
5. **WI-019: Implement guard_js compilation** - P2-Medium
   - General guard jobs (not just in cycles)
   - Reuse patterns from cycle guard_js

6. **WI-020: Generate guard job outputs with GITHUB_OUTPUT** - P2-Medium

7. **WI-021: Create guard helper library** - P3-Low

### Milestone D: Matrices (Phase 6)
8. **WI-022: Implement matrix axes syntax and parsing** - P2-Medium

9. **WI-023: Generate strategy.matrix with include/exclude** - P2-Medium

10. **WI-024: Add matrix fingerprint to artifact naming** - P2-Medium

11. **WI-025: Enforce 256-job matrix limit with diagnostics** - P2-Medium

---

## Backlog (Future Phases)

### Phase 1: Parser + AST + Formatter
- WI-004: Create Lezer grammar for WorkPipe DSL - P0-Critical
- WI-005: Implement CST to AST transformation - P0-Critical
- WI-006: Build source span tracking for diagnostics - P1-High
- WI-007: Implement WorkPipe formatter (fmt command) - P2-Medium

### Phase 2: Minimal Workflow Codegen
- WI-008: Implement YAML IR and emitter - P0-Critical
- WI-009: Generate basic workflow structure (name, on triggers) - P0-Critical
- WI-010: Generate job definitions with steps and needs - P0-Critical
- WI-011: Create golden test framework - P1-High

### Phase 3: Types + Outputs
- WI-012: Implement type system primitives - P1-High
- WI-013: Handle workflow_dispatch inputs with type preservation - P1-High
- WI-014: Generate job outputs and step outputs - P1-High
- WI-015: Build diagnostics framework with error codes - P1-High

### Phase 4: Artifacts
- WI-016: Implement emits/consumes artifact syntax - P1-High
- WI-017: Generate unique artifact naming (v4 immutability safe) - P1-High
- WI-018: Wire cross-job artifact upload/download - P1-High

### Phase 5: Guards
- WI-019: Implement guard_js compilation - P2-Medium
- WI-020: Generate guard job outputs with GITHUB_OUTPUT - P2-Medium
- WI-021: Create guard helper library - P3-Low

### Phase 6: Matrices
- WI-022: Implement matrix axes syntax and parsing - P2-Medium
- WI-023: Generate strategy.matrix with include/exclude - P2-Medium
- WI-024: Add matrix fingerprint to artifact naming - P2-Medium
- WI-025: Enforce 256-job matrix limit with diagnostics - P2-Medium

### Phase 7: Agent Tasks
- WI-026: Implement agent_task syntax and AST - P1-High
- WI-027: Generate Claude Code Action step with claude_args - P1-High
- WI-028: Wire JSON schema output to artifact upload - P1-High
- WI-029: Handle MCP config and tool restrictions - P2-Medium

### Phase 8: Cycles (Strategy B)
- WI-030: Implement cycle syntax and AST - P1-High
- WI-031: Build SCC detection for cycle analysis - P1-High
- WI-032: Generate cycle_hydrate job (state download) - P1-High
- WI-033: Generate cycle_body jobs from body block - P1-High
- WI-034: Generate cycle_decide job (continue logic) - P1-High
- WI-035: Generate cycle_dispatch job (workflow_dispatch API call) - P1-High
- WI-036: Enforce max_iterations and termination - P1-High
- WI-037: Generate concurrency groups for cycle key - P2-Medium

### Phase 9: Tooling
- WI-038: Build VS Code extension with syntax highlighting - P2-Medium
- WI-039: Add diagnostics display to VS Code extension - P2-Medium
- WI-040: Create bootstrap workflow template - P2-Medium
- WI-041: Write documentation and example specs - P3-Low

### Type System Work (USER ESCALATED - ALL COMPLETE)
- WI-060: Document Type System Limitations Clearly - **COMPLETED** 2025-12-31
- WI-061: Add Type Error Examples to Documentation - **COMPLETED** 2025-12-31
- WI-062: Document `json` Type Usage Pattern - **COMPLETED** 2025-12-31
- WI-063: Implement Expression Type Checking - **COMPLETED** 2025-12-31

---

## Known Issues & Follow-Up Work

The following issues were identified by the documentation steward during WI-062 review. These are tracked for future work but are not blocking.

### Doc Clarification Needed
- **Triple-quoted strings scope**: Language-reference.md incorrectly suggests triple-quoted strings work in `run()` shell steps. They only work in `guard_js` blocks. Update docs to clarify scope.

### Example Syntax Issues
- **WI-057 examples with unsupported syntax**: `examples/multi-environment-deploy/` and `examples/enterprise-e2e-pipeline/` were created with syntax that isn't currently supported. Action: either fix examples to use only supported syntax or mark as "aspirational future examples."

---

## Completed

### Bug Fixes & Research (Latest)

- **WI-077: Agent Task Example Missing output_schema** - Completed 2025-12-31
  - Fixed agent-task example to include required output_schema property
  - Demonstrated inline schema syntax with objects, arrays, and string literals

- **WI-078: VS Code Extension Live Validation with Debouncing** - Completed 2025-12-31
  - Implemented real-time validation as user types
  - Added debounce mechanism to prevent excessive compilation
  - Event handlers for onDidChangeTextDocument and onSave
  - Diagnostics display in real-time in the editor

- **WI-079: Import System Design - Research Spike** - Completed 2025-12-31
  - Investigated import/include system design patterns
  - Created ADR-0012 (Proposed status - awaiting team review)
  - Designed symbol-level and file-level import syntax candidates
  - Identified implementation phases and dependencies
  - Ready for implementation work after team approval

### Documentation Refresh - COMPLETE (FINAL PUBLIC RELEASE POLISH)

- **WI-073: README.md Redesign for Public Release** - Completed 2025-12-31
  - Compelling tagline and value proposition
  - Status badges, feature grid, dramatic before/after examples
  - Highlight User-Defined Types, AI Agent Tasks, Cycles
  - Modern GitHub repo elements for public release

- **WI-074: Documentation Audit for Feature Completeness** - Completed 2025-12-31
  - Verified all recent features documented (types, guards, matrices, cycles)
  - Cross-reference verification between docs
  - Updated outdated statistics and status indicators
  - Fixed documentation drift identified in previous reviews

- **WI-075: Examples Showcase Enhancement** - Completed 2025-12-31
  - Redesigned examples/README.md as attractive showcase
  - Validated all examples compile and expected.yml files are current
  - Standardized per-example README format
  - Added difficulty indicators and learning progression
  - **Known Issue**: 2 examples have syntax issues (marked as future aspirational)

- **WI-076: Getting Started Experience Polish** - Completed 2025-12-31
  - Verified installation flow end-to-end
  - Streamlined first workflow journey
  - VS Code extension onboarding
  - Achieved: working workflow in < 10 minutes

### Type System - COMPLETE (MILESTONE A++ FINISHED)

- **WI-072: User-Defined Types Documentation and Examples** - Completed 2025-12-31
  - Language reference updated with type declaration syntax
  - Error documentation for WP5001, WP5002, WP5003 added to docs/errors.md
  - Created examples/user-defined-types/ with working example and README
  - Main README updated with type system feature mention
  - Comprehensive guide for type reuse across jobs and agent tasks

- **WI-071: VS Code Diagnostics for Type Errors** - Completed 2025-12-31
  - WP5001 (duplicate type), WP5002 (undefined type), WP5003 (property not found) integrated
  - Code actions with quick fixes for WP5002 and WP5003 suggestions
  - Hover information showing type definitions
  - All diagnostics surface with appropriate severity and helpful messages
  - Tests verify diagnostic display and code action functionality

- **WI-070: Property Access Validation in Expressions** - Completed 2025-12-31
  - Property validation on typed outputs in expressions
  - WP5003 diagnostic for invalid property access with available properties hint
  - Expression parsing extracts property access chains from needs references
  - Type information flows through TypeRegistry for validation
  - Tests cover valid/invalid property access, nested properties, untyped outputs

- **WI-069: Type References in Agent Task Schemas** - Completed 2025-12-31
  - Agent task `output_schema` accepts user-defined type references
  - Type references resolved via TypeRegistry
  - JSON Schema generated from type definitions
  - Existing inline schema and file reference forms continue to work

- **WI-068: Type References in Job Outputs** - Completed 2025-12-31
  - Job outputs accept user-defined type references instead of primitives
  - Type references resolved via TypeRegistry
  - Type information stored for downstream property validation (WI-070)
  - Backward compatibility: primitive types continue to work

- **WI-067: Type Registry and Resolver** - Completed 2025-12-31
  - TypeRegistry class implementation
  - TypeResolver for reference validation
  - WP5001 (duplicate type) and WP5002 (undefined type) diagnostics
  - Levenshtein distance suggestions for typos
  - Integration with compile pipeline
  - 643 tests passing (36 new tests for registry/resolver)

- **WI-066: AST Representation for Type Declarations** - Completed 2025-12-31
  - Added `TypeDeclarationNode` and `TypeReferenceNode` AST node types
  - Updated `WorkflowNode` to include `types: TypeDeclarationNode[]` array
  - AST builder constructs type declarations from CST
  - Source spans preserved for error reporting
  - 93 new tests (607 total - 71 lang + 536 compiler)
  - Ready for type registry implementation in WI-067

### Type System Documentation
- **WI-062: Document `json` Type Usage Pattern** - Completed 2025-12-31
  - Example and documentation merged into `examples/job-outputs/`
  - Shows JSON serialization in shell steps and consumption via `fromJSON()` expressions
  - Documented caveats: GitHub Actions size limits, expression access patterns
  - **Follow-up issues**: See Known Issues section (doc clarifications + example syntax fixes)

### Type System - PRIOR
- **WI-063: Implement Expression Type Checking** - Completed 2025-12-31
  - WP2012 warning for type mismatch in comparisons
  - WP2013 info diagnostic for numeric operations on non-numeric types
  - Expression parsing to identify output references within `${{ ... }}`
  - Type lookup and inference for literals/operators
  - Tests cover common type mismatch cases
  - `docs/errors.md` updated with WP2012 and WP2013 documentation

### Type System - MOST RECENT
- **WI-065: Grammar and Parser for Type Declarations** - Completed 2025-12-31
  - Extended Lezer grammar with `TypeDecl` production
  - Type declarations parsed correctly to CST
  - Reuses existing schema type productions (primitives, arrays, unions, objects)
  - Type declarations allowed before or after workflow block
  - Parser error recovery and source spans preserved
  - Grammar tests for valid, malformed, and multiple type declarations

### Type System Documentation
- **WI-061: Add Type Error Examples to Documentation** - Completed 2025-12-31
  - Created `docs/troubleshooting.md` with 8 type-related error examples
  - Covers WP2010, WP2011, WP2012, WP2013, WP3001, WP3004, WP7001, WP6001
  - Each example shows: problem code, error message, and fix
  - Updated `docs/README.md` with link to troubleshooting guide

- **WI-060: Document Type System Limitations Clearly** - Completed 2025-12-31
  - Added "Types are compile-time only" callout to language reference
  - Added "User-defined types not supported" section
  - Documented job output types vs agent schema types comparison
  - Clarified `path` type description
  - Added links to ADR-0010 for design rationale

### Phase 5: Guards
- **WI-021: Create guard helper library** - Completed 2025-12-31
  - Implemented `guards` namespace in transform.ts with helper functions
  - Label helpers: hasLabel, hasAnyLabel, hasAllLabels
  - Context helpers: isBranch, isDefaultBranch, isPullRequest, isIssue, isDraft, isAction
  - Getters: event, ref, inputs, actor
  - Inline injection into guard_js scripts (self-contained, no external dependency)

- **WI-020: Generate guard job outputs with GITHUB_OUTPUT** - Completed 2025-12-31
  - Added `collectGuardJsOutputs()` helper function in transform.ts
  - Auto-generates job outputs for guard_js steps in format: `{stepId}_result`
  - Works for regular jobs, agent jobs, and matrix jobs
  - User-declared outputs merge with and take precedence over auto-generated
  - Updated examples/guard-job/ with cleaner syntax
  - 5 new tests (514 total)

### Phase 6: Matrices
- **WI-024: Add matrix fingerprint to artifact naming** - Completed 2025-12-31
  - Created `generateMatrixFingerprint()` helper function in transform.ts
  - Modified transformMatrixJob to pass MatrixContext through step transformation
  - Artifact names in matrix jobs now include `${{ matrix.X }}-${{ matrix.Y }}` suffix
  - 7 new tests (509 total)

- **WI-025: Enforce 256-job matrix limit with diagnostics** - Completed 2025-12-31
  - Created `matrix-validation.ts` with `calculateMatrixJobCount` and `validateMatrixJobs`
  - WP4001 error for >256 jobs, WP4002 warning for >200 jobs
  - Wired into compile pipeline
  - 33 new tests (359 total in compiler)
  - Updated `docs/errors.md` with WP4xxx section

- **WI-023: Generate strategy.matrix with include/exclude** - Completed 2025-12-31
  - Extended grammar with IncludeProperty, ExcludeProperty, MatrixCombination
  - Extended MatrixJobNode with include/exclude arrays
  - Updated IR and emit to output strategy.matrix.include/exclude
  - Tests for parsing, transform, and emit
  - Documentation updated in language-reference.md

- **WI-022: Implement Matrix Axes Syntax and Parsing** - Completed 2025-12-31
  - Extended grammar with MatrixModifier, AxesProperty, MaxParallelProperty, FailFastProperty
  - Added MatrixJobNode to AST types
  - Implemented AST builder for matrix jobs
  - Added codegen support with strategy block generation
  - 21 new tests (385 total - 71 lang + 314 compiler)
  - Phase 6 (Matrices) now IN PROGRESS

### Phase 5: Guards
- **WI-019: Implement guard_js Compilation (General Guards)** - Completed 2025-12-31
  - Extended grammar with GuardJsStep production
  - Added GuardJsStepNode to AST
  - Implemented codegen to transform guard_js to Node.js script
  - Created `examples/guard-job/` with example and expected YAML
  - 10 new test cases (303 tests in compiler)
  - Milestone C now IN PROGRESS

### Phase 9: Tooling - RECENT
- **WI-039: Enhanced VS Code Diagnostics** - Completed 2025-12-31
  - Created `hover.ts` with HoverProvider for keywords and properties
  - Created `code-actions.ts` with quick fixes for WP7001, WP7002, WP6001, WP6005
  - 23 new tests (35 total in vscode-extension)
  - Registered both providers in extension.ts

### Phase 7: Agent Tasks - RECENT
- **WI-059: Error Codes for Invalid Schema Syntax (WP3xxx)** - Completed 2025-12-31
  - WP3001: Unknown primitive type in schema
  - WP3002: Empty object schema
  - WP3003: Invalid union type combination
  - WP3004: Duplicate property name in schema
  - Created `packages/compiler/src/semantics/schema-validation.ts`
  - 22 new tests (427 total passing)
  - `docs/errors.md` updated with WP3xxx section

### Phase 3: Types + Outputs - RECENT
- **WI-054: Validate Output References (WP2011)** - Completed 2025-12-31
  - Added WP2011 diagnostic code for non-existent output references
  - Extended output-validation.ts with reference scanning
  - 11 new test cases added
  - docs/errors.md updated with WP2011 documentation
  - 405 tests passing

### Examples & Documentation - RECENT
- **WI-058: Add Inline Schema Example to agent-task** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Updated `examples/agent-task/agent-task.workpipe` with inline output_schema
  - Schema demonstrates object properties, arrays, string literal unions
  - Updated README with inline schema syntax documentation
  - Regenerated expected.yml
  - 394 tests passing

- **WI-057: Real-World Enterprise Examples** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Created `examples/enterprise-e2e-pipeline/` with workpipe, README, expected.yml
  - Created `examples/multi-environment-deploy/` with workpipe, README
  - Created `examples/microservices-build/` with workpipe, README, expected.yml
  - Updated `examples/README.md` with enterprise patterns section and learning path
  - 394 tests passing

### Phase 7: Agent Tasks - RECENT
- **WI-056: JSON Schema Type Definitions for Agent Tasks** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Grammar: Inline schema syntax with objects, arrays, unions, string literals
  - AST: SchemaTypeNode hierarchy for structured schema representation
  - Codegen: Transform to JSON Schema (required props, additionalProperties: false)
  - Documentation: Added inline schema syntax to language-reference.md
  - 394 tests passing (27 new tests)
  - **NOTE: New DSL syntax - end-user review required per CLAUDE.md rules**

### Phase 9: Tooling - RECENT
- **WI-055: VS Code Extension Troubleshooting Documentation** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Created `docs/vscode-extension.md` with comprehensive troubleshooting guide
  - Updated `docs/README.md` with link to extension documentation
  - Identified likely root cause: compiler bundle not loading in extension context
  - Documented installation, verification, common issues, and known limitations

### Phase 3: Types + Outputs - JOB OUTPUTS COMPLETE
- **WI-053: Add Example Files Demonstrating Job Outputs** - 2025-12-31 **[EXAMPLES COMPLETE]**
  - `examples/job-outputs/` with working example
  - Shows declare, set, consume pattern for typed outputs
  - README explains the example

- **WI-052: Document How to Set Job Outputs** - 2025-12-31 **[DOCS COMPLETE]**
  - Updated `docs/language-reference.md` Job Outputs section
  - Explains `$GITHUB_OUTPUT` syntax for setting outputs from shell scripts
  - Shows complete workflow: declare output, set output, consume output
  - Unblocked WI-046 completion

- **WI-046: Type System for Task/Job Data Flow (Phase 1: Job Outputs)** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Grammar, AST, validation (WP2010), codegen complete
  - 27 new tests (367 total passing)
  - ADR-0010: Job Outputs Design
  - Documentation complete (language-reference.md, errors.md)
  - End-user acceptance review completed
  - Addresses user feedback: "Why not add type declaration so we can have type safety?"

### Phase 9: Tooling - MILESTONE E IN PROGRESS
- **WI-050: Surface Diagnostic Hints in VS Code Extension** - 2025-12-31 **[UX POLISH]**
  - Modified `packages/vscode-extension/src/diagnostics.ts` to append hints to messages
  - Added tests in `packages/vscode-extension/src/__tests__/diagnostics.test.ts`
  - Enhanced VS Code mock for testing
  - All 12 tests passing
  - Completes WI-045 acceptance review items

- **WI-051: Add Error Code Links to Language Reference** - 2025-12-31 **[DOCS ENHANCED]**
  - Added error code links to `docs/language-reference.md`
  - WP7001 link for job `runs_on` required field
  - WP7002 link for agent_job `runs_on` required field
  - WP6001 link for cycle termination condition
  - WP6005 link for cycle `max_iters` recommendation

- **WI-049: Create Error Code Documentation** - 2025-12-31 **[DOCS COMPLETE]**
  - Created `docs/errors.md` with all 7 diagnostic codes documented
  - Codes: WP0001, WP0002, WP6001, WP6005, WP7001, WP7002, WP7004
  - Each code includes severity, description, example, and solution
  - Updated `docs/README.md` with link to error reference
  - Unblocks WI-051 (error code links in language reference)

- **WI-048: Fix iterative-refinement Example Missing runs_on** - 2025-12-31 **[ACCEPTANCE FIX]**
  - Added `runs_on: ubuntu-latest` to `agent_job review_docs` in cycle body
  - Fixes WP7002 validation error in example file
  - Discovered during WI-045 end-user acceptance review

- **WI-045: Enhanced Editor Validation and Required Field Diagnostics** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Added semantic validation for required fields (runs_on, prompt, command)
  - New diagnostic codes: WP7001, WP7002, WP7004
  - 14 new test cases (340 total tests passing)
  - Diagnostics surface in VS Code with red/yellow squiggles

- **WI-047: Improve README and Onboarding Experience** - 2025-12-30 **[ONBOARDING COMPLETE]**
  - Complete README.md overhaul with 5-minute quickstart
  - `docs/bootstrap.md` - Self-hosting workflow documentation
  - `docs/project-structure.md` - Contributor guide with package overview
  - `docs/quick-reference.md` - One-page cheat sheet for common patterns
  - Addresses user feedback on discoverability

- **WI-041: Write documentation and example specs** - 2025-12-30 **[DOCS COMPLETE]**
  - Stream A: Core documentation (4 files in docs/)
    - `docs/README.md` - Documentation index
    - `docs/getting-started.md` - Installation, first workflow, project structure
    - `docs/cli-reference.md` - All 4 CLI commands with options, exit codes
    - `docs/language-reference.md` - Complete syntax reference
  - Stream B: Example documentation (8 READMEs + 3 new examples)
    - READMEs for: minimal, simple-job, agent-task, cycle-basic, matrix-build
    - New: `examples/ci-pipeline/` with workpipe + expected.yml + README
    - New: `examples/release-workflow/` with workpipe + expected.yml + README
    - New: `examples/iterative-refinement/` with workpipe + expected.yml + README
    - `examples/README.md` expanded with full example index
  - Stream C (Bootstrap docs, project README) deferred to WI-042

- **WI-040: Create bootstrap workflow template** - 2025-12-30 **[SELF-HOSTING ENABLED]**
  - `templates/bootstrap.yml` - Standalone bootstrap template
  - `workpipe init --bootstrap` command
  - Bootstrap workflow triggers on `.workpipe` and `.wp` changes
  - Auto-compiles and commits generated YAML
  - `workpipe/ci.workpipe` - Self-hosting example
  - CLI now has 4 commands: build, check, fmt, init
  - 10 init command tests

- **WI-038: Build VS Code extension with syntax highlighting** - 2025-12-30 **[MILESTONE E STARTED]**
  - ADR-0009: VS Code Extension Architecture
  - ARCHITECTURE.md updated with Editor Integration section
  - `packages/vscode-extension/` package created
  - TextMate grammar (`workpipe.tmLanguage.json`) for all constructs
  - Language configuration for bracket matching
  - Real-time compiler diagnostics (error squiggles)
  - Support for `.workpipe` and `.wp` files
  - 9 extension tests

### Phase 8: Cycles (Strategy B) - MILESTONE B FULLY POLISHED
- **WI-036: Enforce max_iterations and termination** - 2025-12-30
  - Created `packages/compiler/src/semantics/cycle-validation.ts`
  - WP6005 warning for cycles with `until` but no `max_iters`
  - `termination_reason` output in decide job
  - 10 new tests

- **WI-037: Generate concurrency groups for cycle key** - 2025-12-30
  - Added `ConcurrencyIR` type to yaml-ir.ts
  - `generateConcurrency()` function in transform.ts
  - Concurrency block emission in emit.ts
  - Golden test updated with concurrency
  - 4 new tests

- **WI-032-035: Cycle codegen - Phased execution jobs** - 2025-12-30
  - ADR-0008: Strategy B Cycle Lowering and Phased Execution Model
  - New IR types: WorkflowDispatchInputIR, DownloadArtifactStepIR, ScriptStepIR
  - Enhanced TriggerIR with workflowDispatch support
  - Enhanced JobIR with outputs and if conditions
  - `transformCycle()` generates 4 jobs per cycle:
    - `<cycle>_hydrate` - downloads state artifact
    - `<cycle>_body_<job>` - executes iteration jobs
    - `<cycle>_decide` - evaluates guard_js termination
    - `<cycle>_dispatch` - triggers next iteration
  - `mergeTriggerWithDispatch()` adds workflow_dispatch inputs
  - Golden test for cycle-basic example
  - 7 new codegen tests (240 total tests passing)

- **WI-031: Build SCC detection for cycle analysis** - 2025-12-30
  - Graph types: JobVertex, JobGraph, SCC, GraphAnalysis
  - `buildJobGraph()` from workflow AST
  - Tarjan's SCC algorithm (O(V+E))
  - `computeTopologicalOrder()` via Kahn's algorithm
  - `analyzeGraph()` complete analysis
  - 25 analysis tests

- **WI-030: Implement cycle syntax and AST** - 2025-12-30 **[MILESTONE B STARTED]**
  - ADR-0007: Cycle Syntax and Guard Block Design
  - Grammar: CycleDecl, CycleBody, MaxItersProperty, KeyProperty, UntilProperty
  - Grammar: GuardJs with triple-quoted strings, BodyBlock
  - AST types: CycleNode, CycleBodyNode, GuardJsNode
  - Updated WorkflowNode with cycles array
  - WP6001 diagnostic for cycles without termination condition
  - Example fixture: examples/cycle-basic/
  - 7 grammar tests, 6 AST tests

### Phase 3: Types + Outputs
- **WI-044: Implement diagnostic system with span tracking** - 2025-12-30 **[PRODUCTION QUALITY]**
  - ADR-0006: Diagnostic System Design and Error Reporting Strategy
  - Consolidates WI-006 (spans) and WI-015 (diagnostics framework)
  - Diagnostic types: Diagnostic, DiagnosticSeverity, CompileResult<T>
  - SourceMap class with line/column computation
  - Diagnostic builder functions: createDiagnostic, parseError, semanticError
  - Pretty formatter with color support and `--no-color` option
  - Refactored compile() to return CompileResult<string>
  - Backward compatibility via compileToYaml()
  - 45 new diagnostic tests (193 total tests passing)

### Phase 7: Agent Tasks
- **WI-026: Implement agent_task syntax and AST** - 2025-12-30 **[CORE DIFFERENTIATOR]**
  - ADR-0005: Agent Task Design and Claude Code Integration
  - Extended Lezer grammar with agent_job, agent_task, tools, mcp, prompts
  - AST types: AgentJobNode, AgentTaskNode, ToolsConfig, McpConfig, PromptValue
  - YAML IR: ClaudeCodeStepIR, UploadArtifactStepIR
  - Transform generates Claude Code Action steps with claude_args
  - Example fixture: examples/agent-task/
  - 17 new grammar tests, comprehensive AST tests
  - 148 total tests passing

### Phase 3: Types + Outputs
- **WI-043: Wire CLI check command to compiler** - 2025-12-30
  - Full check command implementation
  - Parses files and builds AST to validate
  - Error output in `file:line:column: message` format
  - Verbose mode with checkmarks
  - Proper exit codes (0=valid, 2=validation failure)
  - 16 check command tests (104 total tests passing)

### Phase 2: Minimal Workflow Codegen
- **WI-042: Wire CLI build command to compiler** - 2025-12-30 **[MILESTONE A FULLY COMPLETE]**
  - Full build command implementation
  - Reads source files, invokes `compile()`, writes YAML output
  - Workflow name extraction with filename fallback
  - Dry-run, verbose, and output directory options
  - Error handling with graceful continuation
  - 12 build command tests
  - WorkPipe now usable from command line

- **WI-008: Implement YAML IR and emitter** - 2025-12-30
  - ADR-0004: YAML IR Design and Emission Strategy
  - ARCHITECTURE.md Code Generation section
  - YAML IR types (`packages/compiler/src/codegen/yaml-ir.ts`)
  - AST-to-IR transformer (`packages/compiler/src/codegen/transform.ts`)
  - YAML emitter with `yaml` package (`packages/compiler/src/codegen/emit.ts`)
  - `compile()` function exported from `@workpipe/compiler`
  - Golden tests integrated with real output
  - 17 codegen tests
  - Expression quoting converts correctly
  - Job order preserved, trigger forms correct

### Phase 1: Parser + AST + Formatter - PHASE COMPLETE
- **WI-007: Implement WorkPipe formatter (fmt command)** - 2025-12-30 **[CLI SUITE COMPLETE]**
  - CST-based formatting (preserves comments)
  - Created `packages/compiler/src/format/printer.ts`
  - 2-space indentation (configurable)
  - Proper brace placement, spacing, trailing newlines
  - Triple-quoted string preservation
  - `--check` mode for CI, `--write` mode for in-place
  - 44 format tests + 18 CLI tests
  - 316 total tests passing

- **WI-005: Implement CST to AST transformation** - 2025-12-30
  - AST node types (`packages/compiler/src/ast/types.ts`)
  - AST builder with `buildAST()` (`packages/compiler/src/ast/builder.ts`)
  - Cursor iteration for CST traversal
  - Text extraction with spans preserved
  - String unquoting with escape processing
  - Partial AST production on parse errors
  - 21 AST unit tests
  - Both fixtures parse and build correctly

- **WI-004: Create Lezer grammar for WorkPipe DSL** - 2025-12-30
  - ADR-0003: Lezer Grammar Design and Expression Language
  - ARCHITECTURE.md Grammar Design section
  - Grammar file (`packages/lang/src/workpipe.grammar`)
  - Parser wrapper with `parse()`, `printTree()`, `hasErrors()`, `getErrors()`
  - Type declarations for generated parser and terms
  - 19 parser tests
  - Both fixture files parse successfully
  - Error recovery working for incomplete input

### Phase 0: Repo + Contracts
- **WI-003: Establish testing infrastructure and conventions** - 2025-12-30
  - Golden test framework (`packages/compiler/src/testing/golden.ts`)
  - `runGoldenTest()` and `listFixtures()` utilities
  - Example fixtures: `examples/minimal/` and `examples/simple-job/`
  - Placeholder tests for lang, compiler, and action packages
  - CI workflow (`.github/workflows/ci.yml`)
  - Coverage configuration (80% compiler, 60% others)
  - ARCHITECTURE.md Testing Strategy section expanded
  - 19 tests passing

- **WI-002: Define CLI interface and command contracts** - 2025-12-30
  - ADR-0002 documenting CLI contract and exit codes
  - ARCHITECTURE.md updated with CLI Contract section
  - Exit codes utility (`packages/cli/src/utils/exit-codes.ts`)
  - File resolver with glob support (`packages/cli/src/utils/file-resolver.ts`)
  - Build command with -o, -w, --dry-run, -v options
  - Check command with file pattern support
  - Fmt command with --write, --check options
  - 15 unit tests passing

- **WI-001: Initialize monorepo structure with package scaffolding** - 2025-12-30
  - pnpm workspaces configured
  - All 4 packages scaffolded (@workpipe/lang, compiler, cli, action)
  - TypeScript project references working
  - ESLint + Prettier configured
  - Build verified working

---

## Notes

- Work items are numbered sequentially (WI-XXX format)
- Priority levels: P0-Critical, P1-High, P2-Medium, P3-Low
- Each work item has a detailed document in `work_items/WI-XXX-*.md`
- Dependencies between items are tracked in individual work item files
