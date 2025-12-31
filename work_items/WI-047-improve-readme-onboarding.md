# WI-047: Improve README and Onboarding Experience

**ID**: WI-047
**Status**: In Progress
**Priority**: P1-High
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-30
**Updated**: 2025-12-30 (Chunk 1 complete)

## Description

The project README needs to be more educational and accessible for new users. Currently, users have to dig through multiple documents to understand how to get started with WorkPipe.

**User Feedback:**
> "It would be nice if the readme was a little more educational. I had to dig pretty deep to figure out how to use this thing and get set up when i loaded the repo landing page."

This work item addresses the deferred Stream C from WI-041 (Documentation) and expands it based on user feedback. The goal is to make the repository landing page (README.md) a complete onboarding experience.

## Acceptance Criteria

- [x] README.md provides a complete "zero to workflow" experience
- [x] README.md explains what WorkPipe is and why it exists (value proposition)
- [x] README.md includes installation instructions that work immediately
- [x] README.md shows a complete example from DSL to generated YAML
- [x] README.md links to deeper documentation without requiring it for basic usage
- [x] New users can compile their first workflow within 5 minutes of reading
- [ ] README.md includes troubleshooting for common setup issues
- [ ] Project structure is clear for contributors vs users

## Deliverables Checklist

### README.md Overhaul
- [x] Add clear project tagline/description at the top
- [x] Add "Why WorkPipe?" section explaining the problem it solves
- [x] Add quick comparison: WorkPipe DSL vs raw YAML (side by side)
- [x] Add installation section with npm/pnpm commands
- [x] Add "5-Minute Quickstart" section with:
  - [x] Create a .workpipe file
  - [x] Run the build command
  - [x] See the generated YAML
  - [x] Copy to .github/workflows/
- [x] Add "What's Next?" section linking to docs
- [x] Add project status badges (build, npm version if published)
- [x] Add contributing guidelines section (or link)
- [x] Add license information

### Bootstrap Documentation
- [ ] Create `docs/bootstrap.md` explaining self-hosting workflows
- [ ] Document `workpipe init --bootstrap` command usage
- [ ] Explain the compile-on-push workflow pattern

### Project Structure Guide
- [ ] Create `docs/project-structure.md` for contributors
- [ ] Document packages and their purposes
- [ ] Document development workflow (build, test, lint)
- [ ] Document how to run examples

### Quick Reference Card
- [ ] Add cheat sheet or quick reference in README or separate doc
- [ ] Cover most common patterns in one page

## Technical Context

### Current State
- `docs/README.md` exists but is minimal (documentation index)
- `docs/getting-started.md` exists with more detail
- Project root has no README.md (or minimal one)
- WI-041 deferred Stream C which included README improvements

### Deferred Items from WI-041
From WI-041 Stream C (now incorporated here):
- `docs/bootstrap.md` - Setting up self-hosting workflows
- `docs/project-structure.md` - Recommended repo layout
- Update project README.md with overview, quick start, links

### Target User Journey
1. User lands on GitHub repo
2. README immediately explains what this is and why they'd want it
3. README shows installation (one command)
4. README shows complete example (before/after)
5. README links to deeper docs for advanced features
6. User can be productive in under 5 minutes

### Key Content to Include

**Value Proposition:**
- Write cleaner, more maintainable CI/CD pipelines
- Type-safe workflow definitions
- Agent task integration for AI-powered workflows
- Iterative cycles for complex automation

**Side-by-Side Comparison:**
```
WorkPipe (12 lines)          |  Generated YAML (30 lines)
------------------------------|-----------------------------
workflow ci {                 |  name: ci
  on: push                    |  on:
                              |    push: {}
  job test {                  |  jobs:
    runs_on: ubuntu-latest    |    test:
    steps: [                  |      runs-on: ubuntu-latest
      uses("actions/checkout@v4")  |  steps:
      run("npm test")         |        - uses: actions/checkout@v4
    ]                         |        - run: npm test
  }                           |
}                             |
```

## Dependencies

- WI-041: Documentation (complete) - provides foundation docs
- No blocking dependencies

## Notes

- This is a user-facing priority - directly impacts adoption
- Keep README concise; link to docs for depth
- Test the "5-minute quickstart" with someone unfamiliar with the project
- Consider adding a short demo GIF or video link
- This addresses real user friction reported in feedback
