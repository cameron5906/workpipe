# Complete Examples Overhaul - Showcase Agentic Workflows

**ID**: WI-105
**Status**: In Progress
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Progress Log

### 2026-01-01: Phase 1 Implementation COMPLETE
- All 8 Phase 1 examples implemented and committed
- Examples created: cross-platform-matrix-test, smart-pr-workflow, typed-release-pipeline, environment-matrix-deploy, cycle-convergence, diamond-dependency, staged-approval, parallel-iterative-agents
- Each example has .workpipe source, expected.yml, and README.md
- All examples compile successfully
- Ready for Phase 2: AI/Agentic workflow examples

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

### Phase 2: AI/Agentic Workflow Examples (10-15 examples)

**Creative, impressive examples showing:**

- [ ] Autonomous teams embedded in GitHub - Multi-agent coordination
- [ ] Code review agents with structured feedback
- [ ] Documentation generation agents
- [ ] Security audit agents
- [ ] Test generation agents
- [ ] PR triage and auto-labeling
- [ ] Issue analysis and routing
- [ ] Release management automation
- [ ] Dependency update agents
- [ ] Performance profiling agents
- [ ] Architecture decision agents
- [ ] Multi-model orchestration (different models for different tasks)
- [ ] Iterative improvement cycles (agent refines its own output)
- [ ] Human-in-the-loop approval workflows
- [ ] Cross-repository coordination

### Phase 3: Finalization

- [ ] All existing examples archived or removed
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
- [ ] Examples serve as both documentation and marketing material
- [ ] Examples README provides clear learning path and categorization

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

### Phase 2 Implementation (10-15 AI examples)
- [ ] Examples designed (pending Phase 1 completion)
- [ ] Examples implemented (pending design)

### Phase 3 Finalization
- [ ] All existing examples archived or removed
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
- [ ] Examples serve as both documentation and marketing material
- [ ] Examples README provides clear learning path and categorization

## Acceptance Criteria

- [ ] All existing examples archived or removed
- [ ] 8 Phase 1 examples showcasing types, loops, stages, matrices, guards
- [ ] 10-15 Phase 2 AI workflow examples with creative, impressive use cases
- [ ] Each example has README with clear explanation
- [ ] All examples compile and generate valid YAML
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
