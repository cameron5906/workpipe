# Complete Examples Overhaul - Showcase Agentic Workflows

**ID**: WI-105
**Status**: In Progress
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Progress Log

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

### Phase 2: Fragment System Showcase (4-6 examples)

**Purpose:** Demonstrate job_fragment and steps_fragment patterns that enable Phase 3 examples to leverage reusable, parameterized workflow components.

**Design Status:** PENDING

**Examples to create:**

- [ ] **fragment-basics** - Single-file job_fragment and steps_fragment usage
  - Job fragment with parameterized runs_on, steps
  - Steps fragment with default parameter values
  - Fragment instantiation syntax showcase

- [ ] **cross-file-fragments** - Import fragments from shared library files
  - Common CI fragments (lint, test, build)
  - Parameterized reuse across multiple workflows
  - Demonstrates fragment import/export patterns

- [ ] **agent-task-fragments** - Reusable agent task patterns
  - Fragment containing agent_task with parameterized prompts
  - Shared tool configurations
  - Agent output schema inheritance

- [ ] **conditional-fragment-usage** - Fragments with guard conditions
  - Steps fragments that include guard_js blocks
  - Conditional fragment instantiation
  - Matrix-aware fragment expansion

- [ ] **composed-fragments** - Fragments that use other fragments
  - Multi-level fragment composition
  - Fragment parameter forwarding
  - Complex workflow assembly from primitives

- [ ] **fragment-library-pattern** - Best practices for fragment libraries
  - Directory structure for shared fragments
  - Versioning and deprecation patterns
  - Documentation conventions

**Phase 2 Design Checklist:**
- [ ] job_fragment examples with clear parameterization
- [ ] steps_fragment examples with defaults
- [ ] Cross-file import patterns for fragments
- [ ] Agent task fragment patterns (enables Phase 3)
- [ ] Fragment composition patterns

### Phase 3: AI/Agentic Multi-Agent Workflows (10-15 examples)

**Key Theme:** Multi-agent workflows with different agents performing different specialized tasks - entire dev team lifecycle automated, not just code.

**Design Status:** PENDING (blocked on Phase 2 completion)

**Requirements:**
- MUST use fragments from Phase 2 for agent reuse
- MUST demonstrate type system with structured agent outputs
- SHOULD include human feedback gates in some examples
- SHOULD showcase advanced agentic patterns (coordination, handoffs, escalation)

**Example Teams (Multi-Agent Coordination):**

1. **code-review-team** - Multiple specialized reviewers
   - [ ] Security reviewer agent
   - [ ] Performance reviewer agent
   - [ ] Style/maintainability reviewer agent
   - [ ] Aggregator agent that synthesizes reviews
   - Human gate: Final approval before merge

2. **documentation-team** - Writer, editor, reviewer agents
   - [ ] Doc writer agent (generates from code)
   - [ ] Editor agent (improves clarity, consistency)
   - [ ] Reviewer agent (checks accuracy, completeness)
   - [ ] Publisher agent (formats for docs site)
   - Human gate: Review before publish

3. **security-team** - Scanner, analyst, remediation agents
   - [ ] Vulnerability scanner agent
   - [ ] Risk analyst agent (severity, impact assessment)
   - [ ] Remediation agent (suggests/applies fixes)
   - [ ] Compliance checker agent
   - Human gate: Security sign-off for high-severity issues

4. **release-management-team** - Changelog, versioning, deployment agents
   - [ ] Changelog generator agent (from commits/PRs)
   - [ ] Version determiner agent (semver analysis)
   - [ ] Release notes writer agent
   - [ ] Deployment orchestrator agent
   - Human gate: Release approval

5. **issue-triage-team** - Classifier, prioritizer, assigner agents
   - [ ] Issue classifier agent (bug/feature/question)
   - [ ] Priority assessor agent
   - [ ] Assignee recommender agent
   - [ ] Response drafter agent
   - Human gate: Optional review for high-priority issues

6. **testing-team** - Test writer, runner, analyst agents
   - [ ] Unit test writer agent
   - [ ] Integration test designer agent
   - [ ] Test runner agent with coverage analysis
   - [ ] Coverage gap identifier agent
   - [ ] Flaky test detector agent

7. **architecture-review-team** - Design, dependency, performance analysts
   - [ ] Design reviewer agent (patterns, SOLID)
   - [ ] Dependency checker agent (updates, vulnerabilities)
   - [ ] Performance analyst agent (hotspots, optimization)
   - [ ] Architecture doc updater agent
   - Human gate: ADR approval

8. **onboarding-assistant-team** - Code tour, FAQ, example agents
   - [ ] Codebase tour generator agent
   - [ ] FAQ builder agent (from issues/discussions)
   - [ ] Example creator agent
   - [ ] Getting started guide updater agent

9. **refactoring-team** - Analyzer, planner, executor agents
   - [ ] Tech debt analyzer agent
   - [ ] Refactoring planner agent
   - [ ] Code modifier agent (applies changes)
   - [ ] Regression tester agent
   - Human gate: Approve refactoring plan

10. **incident-response-team** - Detector, analyzer, responder agents
    - [ ] Log analyzer agent
    - [ ] Root cause investigator agent
    - [ ] Hotfix drafter agent
    - [ ] Postmortem writer agent
    - Human gate: Deploy hotfix approval

**Phase 3 Design Checklist:**
- [ ] Each example demonstrates multi-agent coordination (3+ agents)
- [ ] Fragment reuse from Phase 2 library patterns
- [ ] Typed structured outputs between agents
- [ ] Human feedback gates where appropriate
- [ ] Clear handoff and coordination patterns
- [ ] Cycle usage for iterative refinement where applicable

### Phase 4: Finalization

- [ ] All existing examples archived or removed
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
- [ ] Examples serve as both documentation and marketing material
- [ ] Examples README provides clear learning path and categorization
- [ ] Fragment library examples serve as reusable starting point for users

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

### Phase 2 Implementation (Fragment Showcase - 4-6 examples)
- [ ] Phase 2 design complete (architect review)
- [ ] fragment-basics example implemented
- [ ] cross-file-fragments example implemented
- [ ] agent-task-fragments example implemented
- [ ] conditional-fragment-usage example implemented
- [ ] composed-fragments example implemented
- [ ] fragment-library-pattern example implemented

### Phase 3 Implementation (AI/Agentic Teams - 10-15 examples)
- [ ] Phase 3 design complete (blocked on Phase 2)
- [ ] code-review-team example implemented
- [ ] documentation-team example implemented
- [ ] security-team example implemented
- [ ] release-management-team example implemented
- [ ] issue-triage-team example implemented
- [ ] testing-team example implemented
- [ ] architecture-review-team example implemented
- [ ] onboarding-assistant-team example implemented
- [ ] refactoring-team example implemented
- [ ] incident-response-team example implemented

### Phase 4 Finalization
- [ ] All existing examples archived or removed
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
- [ ] Examples serve as both documentation and marketing material
- [ ] Examples README provides clear learning path and categorization
- [ ] Fragment library examples serve as reusable starting point

## Acceptance Criteria

- [ ] All existing examples archived or removed
- [x] 8 Phase 1 examples showcasing types, loops, stages, matrices, guards (COMPLETE)
- [ ] 4-6 Phase 2 Fragment Showcase examples demonstrating reusable patterns
- [ ] 10-15 Phase 3 AI/Agentic Multi-Agent Team workflow examples
- [ ] Human feedback gates demonstrated in relevant examples
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
- [ ] Fragment library patterns serve as reusable starting point for users
- [ ] Examples serve as both documentation and marketing material

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
