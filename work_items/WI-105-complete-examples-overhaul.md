# Complete Examples Overhaul - Showcase Agentic Workflows

**ID**: WI-105
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01 (All phases complete)

## Progress Log

### 2026-01-01: Phase 4 Finalization COMPLETE
- All 23 showcase examples verified to compile successfully
- Each example has README.md with clear explanation
- Examples README updated with comprehensive learning path and categorization
- Legacy examples preserved in "Legacy Examples" section (intentional - avoids breaking existing references)
- Fragment library examples serve as reusable starting point for users
- Examples now serve as both documentation and marketing material
- **WI-105 COMPLETE** - All phases delivered

### 2026-01-01: Phase 2 Fragment Showcase COMPLETE (Tracking Correction)
- Phase 2 was already implemented but tracking was not updated
- All 5 fragment examples verified to exist:
  1. fragment-basics - Single-file job_fragment and steps_fragment usage
  2. agent-task-fragments - Reusable agent task patterns with fragment library
  3. cross-file-fragments - Import fragments from shared library files
  4. microservices-with-fragments - Parameterized microservice deployment patterns
  5. fragment-composition - Multi-level fragment composition
- Each example has .workpipe source, expected.yml, and README.md
- Phase 2 now correctly marked as COMPLETE

### 2026-01-01: Phase 3 Implementation COMPLETE
- All 10 Phase 3 multi-agent workflow examples implemented and compiling successfully
- Examples created:
  1. code-review-team - 5 specialized reviewers (security, performance, style, API, test coverage) with synthesizer
  2. documentation-team - Sequential pipeline: analyzer, writer, editor, reviewer
  3. security-audit-team - Parallel scanners (SAST, dependency, secrets, container) + risk analyzer + remediation planner
  4. testing-team - 6 agents: change detector, unit/integration writers, executor, coverage analyzer, flaky detector
  5. issue-triage-team - Classifier, priority assessor, label suggester, assignee recommender, response drafter, synthesizer
  6. release-manager-team - Commit analyzer, version determiner, changelog generator, release notes writer, human approval gate
  7. pr-review-orchestrator - Diff analyzer, test coverage checker, docs checker, breaking change detector, dependency auditor, coordinator
  8. architecture-review-team - Design pattern analyzer, dependency graph builder, performance hotspot finder, tech debt assessor, doc updater, human gate
  9. onboarding-assistant-team - Tour generator, FAQ builder, example finder, getting started writer, knowledge compiler
  10. incident-response-team - Log analyzer, root cause investigator, impact assessor, hotfix drafter, human approval, postmortem writer
- Each example demonstrates multi-agent coordination with typed outputs
- Human feedback gates included in relevant examples
- Ready for Phase 4: Finalization

### 2026-01-01: Phase Reorganization
- User requested phase reorder: Fragment Showcase now Phase 2, AI/Agentic now Phase 3
- Rationale: Fragment examples enable Phase 3 examples to use reusable agent patterns
- Phase 3 scope expanded: Multi-agent teams across entire dev lifecycle
- Added human feedback gates requirement for Phase 3 examples
- Phase 2 design delegated to architects

### 2026-01-01: Phase 1 Implementation COMPLETE
- All 8 Phase 1 examples implemented and committed
- Examples created: cross-platform-matrix-test, smart-pr-workflow, typed-release-pipeline, environment-matrix-deploy, cycle-convergence, diamond-dependency, staged-approval, parallel-iterative-agents
- Each example has .workpipe source, expected.yml, and README.md
- All examples compile successfully
- Ready for Phase 2: Fragment System Showcase

### 2026-01-01: Phase 1 Designs Complete
- Both architects completed Phase 1 design work
- 8 examples designed covering types, matrices, guards, cycles, stages, dependencies
- Ready for implementation

### 2026-01-01: Work Item Started
- WI-106 (Fragment System) complete - all dependencies unblocked
- Delegating Phase 1 design to two architects in parallel

## Description

Completely wipe the `examples/` directory and create new, impressive examples that showcase WorkPipe's power. This is a marketing/showcase priority focused on:

1. **Drawing users in** - These examples should be the "wow factor" that makes developers want to use WorkPipe
2. **Agentic workflows** - Heavy emphasis on AI-powered automation with Claude Code integration
3. **Type safety showcase** - Demonstrate user-defined types, structured outputs, type checking
4. **Complex multi-workflow architectures** - Show how WorkPipe makes advanced patterns a breeze

## Key Themes

- "Look what's possible" - Push the boundaries
- Real-world enterprise scenarios
- Type safety as a superpower
- AI agents as first-class workflow citizens

## Deliverables

### Phase 1: Regular Examples (8 examples) - DESIGNED

**Architect A (Types, Matrices, Guards) - 4 examples:**

1. **cross-platform-matrix-test** - DESIGNED
   - Matrix builds across OS/Node versions with typed test results
   - Features: Matrix syntax, user-defined types for test results, outputs
   - Wow factor: One DSL file compiles to complex multi-platform CI

2. **smart-pr-workflow** - DESIGNED
   - Guard conditions with helper functions for smart PR handling
   - Features: guard_js blocks, guards.hasLabel(), guards.isDraft(), conditional jobs
   - Wow factor: Intelligent conditional execution vs YAML spaghetti

3. **typed-release-pipeline** - DESIGNED
   - Cross-file type imports with agent-generated changelog
   - Features: Import system, shared types, agent_task for changelog generation
   - Wow factor: Type safety across files + AI-assisted releases

4. **environment-matrix-deploy** - DESIGNED
   - Matrices + guards for staged multi-environment deployments
   - Features: Matrix for environments, guard conditions for approvals, stages
   - Wow factor: Complex deployment orchestration made readable

**Architect B (Cycles, Stages, Dependencies) - 4 examples:**

5. **cycle-convergence** - DESIGNED
   - Iterative refinement with convergence detection
   - Features: Cycles with guard_js termination, state passing between iterations
   - Wow factor: Impossible-in-YAML iteration patterns

6. **diamond-dependency** - DESIGNED
   - Complex fan-out/fan-in job dependency patterns
   - Features: needs chains, parallel jobs, typed output passing
   - Wow factor: Clear visualization of complex DAGs

7. **staged-approval** - DESIGNED
   - Stage gating with security review checkpoints
   - Features: Multi-stage pipeline, conditional advancement, manual gates
   - Wow factor: Enterprise governance made simple

8. **parallel-iterative-agents** - DESIGNED
   - Multi-agent orchestration within cycles
   - Features: Cycles containing multiple agent_tasks, coordination patterns
   - Wow factor: Autonomous team within a workflow

**Phase 1 Design Checklist:**
- [x] Type system showcase (cross-platform-matrix-test, typed-release-pipeline)
- [x] Loops and iteration patterns (cycle-convergence, parallel-iterative-agents)
- [x] Stages and job dependencies (diamond-dependency, staged-approval)
- [x] Matrix builds with typed outputs (cross-platform-matrix-test, environment-matrix-deploy)
- [x] Guard conditions and conditional execution (smart-pr-workflow, environment-matrix-deploy)

**Phase 1 Implementation: COMPLETE**
- [x] All 8 examples implemented with .workpipe, expected.yml, and README.md
- [x] All examples compile successfully

### Phase 2: Fragment System Showcase (5 examples) - COMPLETE

**Purpose:** Demonstrate job_fragment and steps_fragment patterns that enable Phase 3 examples to leverage reusable, parameterized workflow components.

**Design Status:** COMPLETE

**Examples Created:**

- [x] **fragment-basics** - Single-file job_fragment and steps_fragment usage
  - Job fragment with parameterized runs_on, steps
  - Steps fragment with default parameter values
  - Fragment instantiation syntax showcase

- [x] **agent-task-fragments** - Reusable agent task patterns with fragment library
  - Fragment containing agent_task with parameterized prompts
  - Shared tool configurations
  - Agent output schema inheritance

- [x] **cross-file-fragments** - Import fragments from shared library files
  - Common CI fragments (lint, test, build)
  - Parameterized reuse across multiple workflows
  - Demonstrates fragment import/export patterns

- [x] **microservices-with-fragments** - Parameterized microservice deployment patterns
  - Service-specific fragment instantiation
  - Environment-aware deployments
  - Reusable deployment patterns

- [x] **fragment-composition** - Multi-level fragment composition
  - Fragments that use other fragments
  - Fragment parameter forwarding
  - Complex workflow assembly from primitives

**Phase 2 Design Checklist:**
- [x] job_fragment examples with clear parameterization
- [x] steps_fragment examples with defaults
- [x] Cross-file import patterns for fragments
- [x] Agent task fragment patterns (enables Phase 3)
- [x] Fragment composition patterns

### Phase 3: AI/Agentic Multi-Agent Workflows (10 examples) - COMPLETE

**Key Theme:** Multi-agent workflows with different agents performing different specialized tasks - entire dev team lifecycle automated, not just code.

**Design Status:** COMPLETE

**Requirements:**
- MUST demonstrate type system with structured agent outputs
- MUST include human feedback gates in relevant examples
- MUST showcase advanced agentic patterns (coordination, handoffs, escalation)

**Example Teams (Multi-Agent Coordination):**

1. **code-review-team** - Multiple specialized reviewers - COMPLETE
   - [x] Security reviewer agent
   - [x] Performance reviewer agent
   - [x] Style/maintainability reviewer agent
   - [x] API design reviewer agent
   - [x] Test coverage reviewer agent
   - [x] Aggregator agent that synthesizes reviews
   - Human gate: Final approval before merge

2. **documentation-team** - Sequential analyzer/writer/editor/reviewer pipeline - COMPLETE
   - [x] Code analyzer agent (extracts documentation needs)
   - [x] Doc writer agent (generates from analysis)
   - [x] Editor agent (improves clarity, consistency)
   - [x] Reviewer agent (checks accuracy, completeness)
   - Human gate: Review before publish

3. **security-audit-team** - Parallel scanners + risk analyzer + remediation - COMPLETE
   - [x] SAST scanner agent
   - [x] Dependency scanner agent
   - [x] Secrets scanner agent
   - [x] Container scanner agent
   - [x] Risk analyzer agent (aggregates findings)
   - [x] Remediation planner agent
   - Human gate: Security sign-off

4. **release-manager-team** - Changelog, versioning, release notes agents - COMPLETE
   - [x] Commit analyzer agent (from commits/PRs)
   - [x] Version determiner agent (semver analysis)
   - [x] Changelog generator agent
   - [x] Release notes writer agent
   - Human gate: Release approval

5. **issue-triage-team** - Classifier, prioritizer, assigner agents - COMPLETE
   - [x] Issue classifier agent (bug/feature/question)
   - [x] Priority assessor agent
   - [x] Label suggester agent
   - [x] Assignee recommender agent
   - [x] Response drafter agent
   - [x] Synthesizer agent

6. **testing-team** - Test writer, runner, analyst agents - COMPLETE
   - [x] Change detector agent
   - [x] Unit test writer agent
   - [x] Integration test writer agent
   - [x] Test executor agent
   - [x] Coverage analyzer agent
   - [x] Flaky test detector agent

7. **architecture-review-team** - Design, dependency, performance analysts - COMPLETE
   - [x] Design pattern analyzer agent
   - [x] Dependency graph builder agent
   - [x] Performance hotspot finder agent
   - [x] Tech debt assessor agent
   - [x] Architecture doc updater agent
   - Human gate: ADR approval

8. **onboarding-assistant-team** - Code tour, FAQ, example agents - COMPLETE
   - [x] Codebase tour generator agent
   - [x] FAQ builder agent (from issues/discussions)
   - [x] Example finder agent
   - [x] Getting started guide writer agent
   - [x] Knowledge compiler agent

9. **pr-review-orchestrator** - Comprehensive PR review coordination - COMPLETE
   - [x] Diff analyzer agent
   - [x] Test coverage checker agent
   - [x] Docs checker agent
   - [x] Breaking change detector agent
   - [x] Dependency auditor agent
   - [x] Review coordinator agent

10. **incident-response-team** - Detector, analyzer, responder agents - COMPLETE
    - [x] Log analyzer agent
    - [x] Root cause investigator agent
    - [x] Impact assessor agent
    - [x] Hotfix drafter agent
    - [x] Postmortem writer agent
    - Human gate: Deploy hotfix approval

**Phase 3 Design Checklist:**
- [x] Each example demonstrates multi-agent coordination (3+ agents)
- [x] Typed structured outputs between agents
- [x] Human feedback gates where appropriate
- [x] Clear handoff and coordination patterns
- [x] All 10 examples compile successfully

### Phase 4: Finalization - COMPLETE

- [x] All existing examples archived or removed (Legacy examples preserved in dedicated section)
- [x] Each example has README with clear explanation
- [x] All examples compile and generate valid YAML
- [x] Examples serve as both documentation and marketing material
- [x] Examples README provides clear learning path and categorization
- [x] Fragment library examples serve as reusable starting point for users

## Implementation Checklist

### Phase 1 Implementation (8 examples) - COMPLETE

**Batch 1 - Types + Dependencies:**
- [x] 1. cross-platform-matrix-test (Architect A design)
- [x] 6. diamond-dependency (Architect B design)

**Batch 2 - Guards + Stages:**
- [x] 2. smart-pr-workflow (Architect A design)
- [x] 7. staged-approval (Architect B design)

**Batch 3 - Advanced Patterns:**
- [x] 3. typed-release-pipeline (Architect A design)
- [x] 5. cycle-convergence (Architect B design)

**Batch 4 - Complex Orchestration:**
- [x] 4. environment-matrix-deploy (Architect A design)
- [x] 8. parallel-iterative-agents (Architect B design)

### Phase 2 Implementation (Fragment Showcase - 5 examples) - COMPLETE
- [x] Phase 2 design complete (architect review)
- [x] fragment-basics example implemented
- [x] agent-task-fragments example implemented
- [x] cross-file-fragments example implemented
- [x] microservices-with-fragments example implemented
- [x] fragment-composition example implemented

### Phase 3 Implementation (AI/Agentic Teams - 10 examples) - COMPLETE
- [x] Phase 3 design complete
- [x] code-review-team example implemented
- [x] documentation-team example implemented
- [x] security-audit-team example implemented
- [x] release-manager-team example implemented
- [x] issue-triage-team example implemented
- [x] testing-team example implemented
- [x] architecture-review-team example implemented
- [x] onboarding-assistant-team example implemented
- [x] pr-review-orchestrator example implemented
- [x] incident-response-team example implemented

### Phase 4 Finalization - COMPLETE
- [x] All existing examples archived or removed (Legacy examples preserved in dedicated section)
- [x] Each example has README with clear explanation
- [x] All examples compile and generate valid YAML
- [x] Examples serve as both documentation and marketing material
- [x] Examples README provides clear learning path and categorization
- [x] Fragment library examples serve as reusable starting point

## Acceptance Criteria

- [x] All existing examples archived or removed (Legacy examples preserved in dedicated section)
- [x] 8 Phase 1 examples showcasing types, loops, stages, matrices, guards (COMPLETE)
- [x] 5 Phase 2 Fragment Showcase examples demonstrating reusable patterns (COMPLETE)
- [x] 10 Phase 3 AI/Agentic Multi-Agent Team workflow examples (COMPLETE)
- [x] Human feedback gates demonstrated in relevant examples (COMPLETE)
- [x] Each example has README with clear explanation (COMPLETE)
- [x] All Phase 1, Phase 2, and Phase 3 examples compile and generate valid YAML (COMPLETE)
- [x] Fragment library patterns serve as reusable starting point for users (COMPLETE)
- [x] Examples serve as both documentation and marketing material (COMPLETE)

## Technical Context

This work item depends on:
- Stable grammar and parser (complete)
- User-defined type system (complete - Milestone A++)
- Import system (complete - Milestone F)
- Agent task syntax (complete - Phase 7)
- Cycle syntax (complete - Milestone B)
- Matrix syntax (complete - Milestone D)
- Guard syntax (complete - Milestone C)

All required features are implemented. This is purely a showcase/documentation effort.

## Dependencies

- WI-100: Examples Catalog Audit (should complete first to understand current state)
- WI-101 through WI-104: P1 items should complete before this P2 work
- **WI-106: Fragment System** - P1-High, should complete before this work item
  - Fragments enable the "composability story" that makes examples truly impressive
  - Phase 2 AI examples should showcase fragment patterns for agent reuse
  - Wait for WI-106 completion OR explicitly scope initial examples to non-fragment patterns

## Implementation Notes

### Recommended Implementation Approach: Batched Parallel

Given the scope (8 Phase 1 examples + 10-15 Phase 2 examples), implement in **4 batches of 2 examples each**:

1. **Batch approach advantages:**
   - Each batch can be done by two engineers in parallel
   - Natural checkpoints for QA validation
   - Early batches inform patterns for later batches
   - Reduces risk of large-scale issues discovered late

2. **Each batch deliverables:**
   - 2 complete examples with .workpipe files
   - 2 expected.yml files (generated)
   - 2 README.md files explaining the use case
   - All examples compile without errors

3. **Batch ordering rationale:**
   - Batch 1 (Types + Dependencies): Foundation patterns, simplest features
   - Batch 2 (Guards + Stages): Build on Batch 1, add conditional logic
   - Batch 3 (Advanced): Cross-file imports, cycles - more complex
   - Batch 4 (Orchestration): Most complex, combines multiple features

### Phase 2 Timing

Phase 2 AI examples should begin design once Batch 2 of Phase 1 is complete. This allows:
- Phase 1 patterns to inform Phase 2 designs
- Phase 2 design to happen in parallel with Phase 1 Batches 3-4 implementation
- Continuous progress without blocking

### Quality Bar

Each example must:
1. Compile without errors
2. Generate valid GitHub Actions YAML
3. Have a README explaining the use case
4. Demonstrate a clear WorkPipe advantage over raw YAML
5. Be impressive enough to share on social media / in docs

## Notes

- This is marketing/showcase priority, not critical path
- Complete after P0/P1 work items
- User explicitly requested this as a lower priority than current work
- Focus on "wow factor" and drawing developers to WorkPipe
