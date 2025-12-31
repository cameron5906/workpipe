# WI-041: Write Documentation and Example Specs

**ID**: WI-041
**Status**: Completed
**Priority**: P3-Low
**Milestone**: E (Tooling)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Create comprehensive user documentation and example specifications for the WorkPipe DSL compiler. This work item covers the creation of a user guide, language reference, CLI documentation, and a complete set of example workflows demonstrating common patterns.

The documentation should enable new users to:
1. Understand what WorkPipe is and why it exists
2. Install and configure the CLI
3. Write their first WorkPipe specification
4. Understand all language constructs (jobs, triggers, agent tasks, cycles)
5. Use the CLI commands effectively (build, check, fmt, init)
6. Set up bootstrap workflows for self-hosting

## Acceptance Criteria

- [x] User documentation is clear, accurate, and covers all implemented features
- [x] All CLI commands are documented with examples
- [x] Language reference covers all syntax constructs
- [x] At least 5 complete example specifications exist with explanatory comments
- [x] Examples cover: CI pipeline, release workflow, agent pipeline, matrix builds, cycles
- [x] Getting started guide enables a new user to compile their first workflow
- [x] Documentation builds/renders correctly (if using a doc generator)

## Deliverables Checklist

### Stream A: Core Documentation

- [x] `docs/README.md` - Documentation index and navigation
- [x] `docs/getting-started.md` - Installation, first workflow, basic concepts
- [x] `docs/cli-reference.md` - All CLI commands with options and examples
  - [x] `workpipe build` command documentation
  - [x] `workpipe check` command documentation
  - [x] `workpipe fmt` command documentation
  - [x] `workpipe init` command documentation
- [x] `docs/language-reference.md` - Complete language syntax reference
  - [x] Workflow block syntax
  - [x] Trigger syntax (on, workflow_dispatch, etc.)
  - [x] Job syntax (job, agent_job)
  - [x] Step syntax (run, uses, agent_task)
  - [x] Cycle syntax (cycle, max_iters, key, until, body)
  - [x] Expression syntax

### Stream B: Example Specifications

- [x] Update `examples/README.md` with comprehensive index and descriptions
- [x] `examples/ci-pipeline/` - Standard CI workflow (build, test, lint)
- [x] `examples/release-workflow/` - Release automation with versioning
- [x] `examples/agent-pipeline/` - Multi-agent task pipeline (expand existing)
- [x] `examples/matrix-build/` - Matrix strategy example (placeholder for future)
- [x] `examples/iterative-refinement/` - Cycle-based iterative workflow
- [x] Each example includes:
  - [x] `.workpipe` source file with comments
  - [x] `expected.yml` generated output
  - [x] `README.md` explaining the pattern

### Stream C: Bootstrap and Self-Hosting (DEFERRED)

- [ ] `docs/bootstrap.md` - Setting up self-hosting workflows
- [ ] `docs/project-structure.md` - Recommended repo layout
- [ ] Update project README.md with:
  - [ ] Project overview and status
  - [ ] Quick start instructions
  - [ ] Link to documentation

**Note:** Stream C has been deferred to a future work item. The core documentation (Stream A) and example documentation (Stream B) are complete and provide sufficient coverage for users to get started with WorkPipe.

## Technical Context

### Relevant CLAUDE.md Sections
- Section 4: The WorkPipe mental model (spec folder conventions)
- Section 5: Language overview (syntax reference material)
- Section 9: Agentic tasks (Claude Code Action documentation)
- Section 10: Cycles (Strategy B documentation)
- Section 13: Bootstrap workflow (self-hosting documentation)

### Existing Documentation
- `PROJECT.md` - Design document (source of truth for language design)
- `ARCHITECTURE.md` - Internal architecture (developer-focused)
- `adr/` - Architecture Decision Records
- `examples/` - Existing example specifications (4 examples)

### Current Examples State
| Example | Status | Description |
|---------|--------|-------------|
| `minimal/` | Complete | Basic "hello world" workflow |
| `simple-job/` | Complete | Multi-step job example |
| `agent-task/` | Complete | Claude Code Action integration |
| `cycle-basic/` | Complete | Cycle with guard and max_iters |

### CLI Commands Implemented
- `workpipe build` - Compile .workpipe to YAML
- `workpipe check` - Validate without output
- `workpipe fmt` - Format source files
- `workpipe init` - Initialize project with bootstrap

## Dependencies

- None (documentation work is independent)

## Notes

- Documentation should be written for end users, not compiler developers
- Keep language simple and accessible
- Include copy-pasteable examples
- Consider adding troubleshooting section for common errors
- Reference PROJECT.md Section 12 for error code documentation patterns
- Examples should demonstrate real-world use cases, not just syntax

## Parallel Work Guidance

This work item can be parallelized across three streams:
- **Stream A (Core Documentation)**: Can be done independently
- **Stream B (Examples)**: Can be done independently, references Stream A for consistency
- **Stream C (Bootstrap/README)**: Should follow Stream A completion for consistency

Recommended approach: Start Streams A and B in parallel, then complete Stream C.
