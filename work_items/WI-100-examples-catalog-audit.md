# Examples Catalog Audit

**ID**: WI-100
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: E (Tooling)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

Some examples may still have issues or be missing expected functionality. An end-user review identified that the examples catalog needs a comprehensive audit to ensure all examples:
1. Compile without errors
2. Produce valid GitHub Actions YAML
3. Have accurate expected.yml files
4. Have complete and accurate README documentation
5. Cover all major WorkPipe features

This is related to but distinct from the known issues noted in BACKLOG.md about WI-057 examples with unsupported syntax.

## Acceptance Criteria

- [ ] Audit all examples in `examples/` directory
- [ ] For each example, verify:
  - [ ] Compiles with `workpipe build` without errors
  - [ ] expected.yml matches actual output
  - [ ] README.md accurately describes the example
  - [ ] All syntax used is currently supported
- [ ] Fix any examples that fail to compile
- [ ] Regenerate any stale expected.yml files
- [ ] Update any inaccurate README files
- [ ] Address or explicitly mark aspirational examples (multi-environment-deploy, enterprise-e2e-pipeline)
- [ ] Create list of any missing example coverage (features without examples)
- [ ] Update `examples/README.md` if any examples added/removed/changed

## Technical Context

Known issues from BACKLOG.md:
- `examples/multi-environment-deploy/` - may have unsupported syntax
- `examples/enterprise-e2e-pipeline/` - may have unsupported syntax

Current examples directory should include:
- minimal/
- simple-job/
- ci-pipeline/
- agent-task/
- cycle-basic/
- matrix-build/
- guard-job/
- job-outputs/
- user-defined-types/
- shared-types/
- release-workflow/
- iterative-refinement/
- microservices-build/
- multi-environment-deploy/
- enterprise-e2e-pipeline/

## Dependencies

- None

## Notes

This is a quality gate for public release. All examples should work out of the box.

If aspirational examples cannot be fixed with current syntax, they should either:
1. Be removed from the examples directory
2. Be clearly marked as "Future/Aspirational" in their README
3. Have issues created to implement the missing syntax
