# Complete Examples Overhaul - Showcase Agentic Workflows

**ID**: WI-105
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

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

### Phase 1: Regular Examples (5-10 examples)

**Assign to 2 architects working in parallel to design:**

- [ ] Type system showcase (user-defined types, imports, structured outputs)
- [ ] Loops and iteration patterns (cycles, iterative refinement)
- [ ] Stages and job dependencies
- [ ] Matrix builds with typed outputs
- [ ] Guard conditions and conditional execution

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

## Acceptance Criteria

- [ ] All existing examples archived or removed
- [ ] 5-10 regular examples showcasing types, loops, stages
- [ ] 10-15 AI workflow examples with creative, impressive use cases
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

## Implementation Notes

### Parallel Architect Assignments

**Architect A (Regular Examples):**
- Type system showcase
- Matrix builds with typed outputs
- Guard conditions

**Architect B (Regular Examples):**
- Loops and iteration patterns
- Stages and job dependencies

**Phase 2 can proceed with multiple agents in parallel once Phase 1 designs are approved.**

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
