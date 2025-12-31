# WorkPipe Backlog

## Overview

This backlog tracks all work items for the WorkPipe project - a DSL compiler that generates GitHub Actions workflow YAML files.

**Project Milestones** (from design doc):
- **Milestone A**: Vertical slice (end-to-end) - One .workpipe file compiles to working YAML
- **Milestone B**: Strategy B cycle support
- **Milestone C**: Guards + advanced triggers
- **Milestone D**: Matrices
- **Milestone E**: Tooling (VS Code extension)

**Implementation Phases** (from PROJECT.md):
- Phase 0: Repo + contracts
- Phase 1: Parser + AST + formatter
- Phase 2: Minimal workflow codegen
- Phase 3: Types + outputs
- Phase 4: Artifacts
- Phase 5: Guards
- Phase 6: Matrices
- Phase 7: Agent tasks
- Phase 8: Cycles (Strategy B)
- Phase 9: Tooling polish

---

## In Progress

(None)

---

## Up Next (Priority Order)

1. **WI-050: Surface Diagnostic Hints in VS Code Extension** - P3-Low
   - Compiler `hint` field not displayed in VS Code
   - Only message and code shown currently
   - Improve developer experience

---

## PROJECT STATUS SUMMARY

| Milestone | Status | Description |
|-----------|--------|-------------|
| **A** | COMPLETE | Vertical slice - end-to-end compilation |
| **A+** | COMPLETE | Agent tasks + diagnostics + formatter |
| **B** | COMPLETE | Strategy B cycles with full safety |
| **C** | Not Started | Guards + advanced triggers |
| **D** | Not Started | Matrices |
| **E** | IN PROGRESS | Tooling (VS Code extension + bootstrap) |

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| 0: Repo + contracts | COMPLETE | Monorepo, CLI contracts |
| 1: Parser + AST + formatter | COMPLETE | Lezer grammar, AST, fmt command |
| 2: Minimal workflow codegen | COMPLETE | YAML IR, build command |
| 3: Types + outputs | PARTIAL | Diagnostics done; type system future |
| 4: Artifacts | PARTIAL | Cycle artifacts done; general future |
| 5: Guards | Not Started | guard_js in cycles done; general future |
| 6: Matrices | Not Started | |
| 7: Agent tasks | COMPLETE | Claude Code Action integration |
| 8: Cycles (Strategy B) | COMPLETE | Phased execution, concurrency |
| 9: Tooling polish | IN PROGRESS | VS Code extension, bootstrap workflow |

**Test Count:** 340 tests passing
**Work Items Completed:** 26
**Work Items In Progress:** 0
**Work Items In Backlog:** 1 (WI-050)
**CLI Commands:** 4 (build, check, fmt, init)
**Packages:** 5 (lang, compiler, cli, action, vscode-extension)

---

## MILESTONE B FULLY POLISHED: PRODUCTION-READY CYCLES

**WorkPipe now compiles cycles to phased execution workflows with full safety features!**

```yaml
# Generated from cycle block:
name: cycle-example
on:
  workflow_dispatch:
    inputs:
      phase: { default: '0' }
      run_id: { default: '' }
concurrency:
  group: ${{ github.workflow }}-${{ github.event.inputs.phase || 'bootstrap' }}
  cancel-in-progress: false
jobs:
  refine_hydrate:    # Downloads previous state
  refine_body_step1: # Executes iteration
  refine_decide:     # Evaluates guard_js, outputs termination_reason
  refine_dispatch:   # Triggers next iteration (respects max_iters)
```

**Capabilities delivered:**
- Parse WorkPipe DSL with Lezer grammar (error recovery)
- Build typed AST from CST (including agent and cycle constructs)
- Transform AST to YAML IR (Claude Code Action steps)
- Emit valid GitHub Actions YAML
- CLI with build, check commands
- Structured diagnostics with error codes and spans
- Agent tasks with Claude Code Action integration
- Cycle syntax: max_iters, key, until guard_js, body block
- SCC detection with Tarjan's algorithm
- **Full cycle codegen: hydrate, body, decide, dispatch jobs**
- **Cross-run artifact download for state persistence**
- **Guard_js evaluation for termination**
- **workflow_dispatch for iteration triggering**
- **WP6005 diagnostic for cycles without max_iters safety**
- **termination_reason output (guard_satisfied | max_iterations | continue)**
- **Concurrency groups prevent parallel cycle races**
- 316 tests passing

---

## Ready for Development

### Phase 9: Tooling (Milestone E) - Remaining
1. **WI-039: Add diagnostics display to VS Code extension** - P2-Medium
   - Enhance existing diagnostics with code actions
   - Add hover information
   - Note: WI-045 covers required field validation (user feedback priority)

### Future Enhancements (Phase 3+)
4. **WI-046: Type System for Task/Job Data Flow** - P2-Medium
   - User feedback: Wants type declarations for data passing between tasks/jobs
   - Type annotations for outputs, inputs, artifacts
   - Compile-time type checking
   - Consolidates/extends WI-012, WI-013, WI-014

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

---

## Completed

### Phase 9: Tooling - MILESTONE E IN PROGRESS
- ✅ **WI-051: Add Error Code Links to Language Reference** - 2025-12-31 **[DOCS ENHANCED]**
  - Added error code links to `docs/language-reference.md`
  - WP7001 link for job `runs_on` required field
  - WP7002 link for agent_job `runs_on` required field
  - WP6001 link for cycle termination condition
  - WP6005 link for cycle `max_iters` recommendation

- ✅ **WI-049: Create Error Code Documentation** - 2025-12-31 **[DOCS COMPLETE]**
  - Created `docs/errors.md` with all 7 diagnostic codes documented
  - Codes: WP0001, WP0002, WP6001, WP6005, WP7001, WP7002, WP7004
  - Each code includes severity, description, example, and solution
  - Updated `docs/README.md` with link to error reference
  - Unblocks WI-051 (error code links in language reference)

- ✅ **WI-048: Fix iterative-refinement Example Missing runs_on** - 2025-12-31 **[ACCEPTANCE FIX]**
  - Added `runs_on: ubuntu-latest` to `agent_job review_docs` in cycle body
  - Fixes WP7002 validation error in example file
  - Discovered during WI-045 end-user acceptance review

- ✅ **WI-045: Enhanced Editor Validation and Required Field Diagnostics** - 2025-12-31 **[USER FEEDBACK ADDRESSED]**
  - Added semantic validation for required fields (runs_on, prompt, command)
  - New diagnostic codes: WP7001, WP7002, WP7004
  - 14 new test cases (340 total tests passing)
  - Diagnostics surface in VS Code with red/yellow squiggles

- ✅ **WI-047: Improve README and Onboarding Experience** - 2025-12-30 **[ONBOARDING COMPLETE]**
  - Complete README.md overhaul with 5-minute quickstart
  - `docs/bootstrap.md` - Self-hosting workflow documentation
  - `docs/project-structure.md` - Contributor guide with package overview
  - `docs/quick-reference.md` - One-page cheat sheet for common patterns
  - Addresses user feedback on discoverability

- ✅ **WI-041: Write documentation and example specs** - 2025-12-30 **[DOCS COMPLETE]**
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

- ✅ **WI-040: Create bootstrap workflow template** - 2025-12-30 **[SELF-HOSTING ENABLED]**
  - `templates/bootstrap.yml` - Standalone bootstrap template
  - `workpipe init --bootstrap` command
  - Bootstrap workflow triggers on `.workpipe` and `.wp` changes
  - Auto-compiles and commits generated YAML
  - `workpipe/ci.workpipe` - Self-hosting example
  - CLI now has 4 commands: build, check, fmt, init
  - 10 init command tests

- ✅ **WI-038: Build VS Code extension with syntax highlighting** - 2025-12-30 **[MILESTONE E STARTED]**
  - ADR-0009: VS Code Extension Architecture
  - ARCHITECTURE.md updated with Editor Integration section
  - `packages/vscode-extension/` package created
  - TextMate grammar (`workpipe.tmLanguage.json`) for all constructs
  - Language configuration for bracket matching
  - Real-time compiler diagnostics (error squiggles)
  - Support for `.workpipe` and `.wp` files
  - 9 extension tests

### Phase 8: Cycles (Strategy B) - MILESTONE B FULLY POLISHED
- ✅ **WI-036: Enforce max_iterations and termination** - 2025-12-30
  - Created `packages/compiler/src/semantics/cycle-validation.ts`
  - WP6005 warning for cycles with `until` but no `max_iters`
  - `termination_reason` output in decide job
  - 10 new tests

- ✅ **WI-037: Generate concurrency groups for cycle key** - 2025-12-30
  - Added `ConcurrencyIR` type to yaml-ir.ts
  - `generateConcurrency()` function in transform.ts
  - Concurrency block emission in emit.ts
  - Golden test updated with concurrency
  - 4 new tests

- ✅ **WI-032-035: Cycle codegen - Phased execution jobs** - 2025-12-30
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

- ✅ **WI-031: Build SCC detection for cycle analysis** - 2025-12-30
  - Graph types: JobVertex, JobGraph, SCC, GraphAnalysis
  - `buildJobGraph()` from workflow AST
  - Tarjan's SCC algorithm (O(V+E))
  - `computeTopologicalOrder()` via Kahn's algorithm
  - `analyzeGraph()` complete analysis
  - 25 analysis tests

- ✅ **WI-030: Implement cycle syntax and AST** - 2025-12-30 **[MILESTONE B STARTED]**
  - ADR-0007: Cycle Syntax and Guard Block Design
  - Grammar: CycleDecl, CycleBody, MaxItersProperty, KeyProperty, UntilProperty
  - Grammar: GuardJs with triple-quoted strings, BodyBlock
  - AST types: CycleNode, CycleBodyNode, GuardJsNode
  - Updated WorkflowNode with cycles array
  - WP6001 diagnostic for cycles without termination condition
  - Example fixture: examples/cycle-basic/
  - 7 grammar tests, 6 AST tests

### Phase 3: Types + Outputs
- ✅ **WI-044: Implement diagnostic system with span tracking** - 2025-12-30 **[PRODUCTION QUALITY]**
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
- ✅ **WI-026: Implement agent_task syntax and AST** - 2025-12-30 **[CORE DIFFERENTIATOR]**
  - ADR-0005: Agent Task Design and Claude Code Integration
  - Extended Lezer grammar with agent_job, agent_task, tools, mcp, prompts
  - AST types: AgentJobNode, AgentTaskNode, ToolsConfig, McpConfig, PromptValue
  - YAML IR: ClaudeCodeStepIR, UploadArtifactStepIR
  - Transform generates Claude Code Action steps with claude_args
  - Example fixture: examples/agent-task/
  - 17 new grammar tests, comprehensive AST tests
  - 148 total tests passing

### Phase 3: Types + Outputs
- ✅ **WI-043: Wire CLI check command to compiler** - 2025-12-30
  - Full check command implementation
  - Parses files and builds AST to validate
  - Error output in `file:line:column: message` format
  - Verbose mode with checkmarks
  - Proper exit codes (0=valid, 2=validation failure)
  - 16 check command tests (104 total tests passing)

### Phase 2: Minimal Workflow Codegen
- ✅ **WI-042: Wire CLI build command to compiler** - 2025-12-30 **[MILESTONE A FULLY COMPLETE]**
  - Full build command implementation
  - Reads source files, invokes `compile()`, writes YAML output
  - Workflow name extraction with filename fallback
  - Dry-run, verbose, and output directory options
  - Error handling with graceful continuation
  - 12 build command tests
  - WorkPipe now usable from command line

- ✅ **WI-008: Implement YAML IR and emitter** - 2025-12-30
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
- ✅ **WI-007: Implement WorkPipe formatter (fmt command)** - 2025-12-30 **[CLI SUITE COMPLETE]**
  - CST-based formatting (preserves comments)
  - Created `packages/compiler/src/format/printer.ts`
  - 2-space indentation (configurable)
  - Proper brace placement, spacing, trailing newlines
  - Triple-quoted string preservation
  - `--check` mode for CI, `--write` mode for in-place
  - 44 format tests + 18 CLI tests
  - 316 total tests passing

- ✅ **WI-005: Implement CST to AST transformation** - 2025-12-30
  - AST node types (`packages/compiler/src/ast/types.ts`)
  - AST builder with `buildAST()` (`packages/compiler/src/ast/builder.ts`)
  - Cursor iteration for CST traversal
  - Text extraction with spans preserved
  - String unquoting with escape processing
  - Partial AST production on parse errors
  - 21 AST unit tests
  - Both fixtures parse and build correctly

- ✅ **WI-004: Create Lezer grammar for WorkPipe DSL** - 2025-12-30
  - ADR-0003: Lezer Grammar Design and Expression Language
  - ARCHITECTURE.md Grammar Design section
  - Grammar file (`packages/lang/src/workpipe.grammar`)
  - Parser wrapper with `parse()`, `printTree()`, `hasErrors()`, `getErrors()`
  - Type declarations for generated parser and terms
  - 19 parser tests
  - Both fixture files parse successfully
  - Error recovery working for incomplete input

### Phase 0: Repo + Contracts
- ✅ **WI-003: Establish testing infrastructure and conventions** - 2025-12-30
  - Golden test framework (`packages/compiler/src/testing/golden.ts`)
  - `runGoldenTest()` and `listFixtures()` utilities
  - Example fixtures: `examples/minimal/` and `examples/simple-job/`
  - Placeholder tests for lang, compiler, and action packages
  - CI workflow (`.github/workflows/ci.yml`)
  - Coverage configuration (80% compiler, 60% others)
  - ARCHITECTURE.md Testing Strategy section expanded
  - 19 tests passing

- ✅ **WI-002: Define CLI interface and command contracts** - 2025-12-30
  - ADR-0002 documenting CLI contract and exit codes
  - ARCHITECTURE.md updated with CLI Contract section
  - Exit codes utility (`packages/cli/src/utils/exit-codes.ts`)
  - File resolver with glob support (`packages/cli/src/utils/file-resolver.ts`)
  - Build command with -o, -w, --dry-run, -v options
  - Check command with file pattern support
  - Fmt command with --write, --check options
  - 15 unit tests passing

- ✅ **WI-001: Initialize monorepo structure with package scaffolding** - 2025-12-30
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
