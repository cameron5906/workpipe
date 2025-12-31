# Examples Showcase Enhancement

**ID**: WI-075
**Status**: Backlog
**Priority**: P1-High
**Milestone**: E (Tooling Polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Enhance the examples directory to be a compelling showcase for WorkPipe's capabilities. The examples should be discoverable, well-organized, and demonstrate WorkPipe's power in solving real-world CI/CD challenges.

Current examples exist but need:
- Better organization and categorization
- Consistent quality and formatting
- Clear learning progression
- Validation that all examples compile and work

## Acceptance Criteria

### Examples Index Enhancement
- [ ] Redesign examples/README.md as an attractive showcase page
- [ ] Add categories with clear descriptions (Getting Started, Core Features, Advanced, Enterprise)
- [ ] Include difficulty indicators (Beginner, Intermediate, Advanced)
- [ ] Add "What you'll learn" bullets for each example
- [ ] Create visual organization (tables, sections, or grid)

### Example Validation
- [ ] Verify all examples compile without errors using `workpipe build`
- [ ] Verify expected.yml files are up-to-date with current compiler output
- [ ] Fix or document any examples using unsupported syntax
- [ ] Add test coverage to ensure examples stay valid

### Per-Example README Enhancement
- [ ] Standardize README format across all examples
- [ ] Each README must include:
  - Brief description (2-3 sentences)
  - "What this demonstrates" section
  - Key syntax highlights
  - How to build/test the example
  - Links to related documentation
- [ ] Add syntax highlighting hints for code blocks

### Category Organization

#### Getting Started (Beginner)
- [ ] minimal/ - Absolute simplest workflow
- [ ] simple-job/ - Job dependencies and conditionals

#### Core Features (Intermediate)
- [ ] job-outputs/ - Typed job outputs
- [ ] json-outputs/ - JSON data passing
- [ ] user-defined-types/ - Reusable type definitions
- [ ] matrix-build/ - Multi-dimensional matrices

#### Advanced Features
- [ ] agent-task/ - AI-powered tasks with Claude Code
- [ ] cycle-basic/ - Iterative workflows
- [ ] iterative-refinement/ - Cycles with agent tasks

#### CI/CD Patterns
- [ ] ci-pipeline/ - Standard CI workflow
- [ ] release-workflow/ - Release automation

#### Enterprise Patterns
- [ ] enterprise-e2e-pipeline/ - Complex testing
- [ ] multi-environment-deploy/ - Multi-stage deployment
- [ ] microservices-build/ - Parallel builds

### Featured Examples
- [ ] Identify 3-5 "featured" examples that best showcase WorkPipe
- [ ] Add "Featured Example" badges or callouts
- [ ] Consider adding these to main README

### New Example Candidates (if time permits)
- [ ] Consider adding guard-job example if missing
- [ ] Consider adding example combining multiple advanced features
- [ ] Consider adding "migration from raw YAML" example

## Technical Context

Current examples directory structure:
- 14 examples with READMEs
- Most have expected.yml files
- Some examples (WI-057: enterprise-e2e-pipeline, multi-environment-deploy) may use unsupported syntax

Validation command:
```bash
workpipe build examples/**/*.workpipe
```

Golden test framework available in `packages/compiler/src/testing/golden.ts`

## Dependencies

- WI-074 (documentation audit) should verify example links in docs

## Notes

- Known issue: Some examples from WI-057 may use aspirational syntax
- Focus on quality over quantity - better to have fewer excellent examples
- Consider adding a "Gallery" section to main README linking to best examples
