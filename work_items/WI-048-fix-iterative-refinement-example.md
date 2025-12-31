# WI-048: Fix iterative-refinement Example Missing runs_on

**ID**: WI-048
**Status**: Completed
**Priority**: P1-High
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

The `examples/iterative-refinement/iterative-refinement.workpipe` example file has a bug: the `agent_job review_docs` inside the cycle body is missing the required `runs_on` field. This causes WP7002 validation error, breaking the example.

**Source:** End-user acceptance review of WI-045

## Problem

```workpipe
cycle improve_docs {
  body {
    agent_job review_docs {
      // MISSING: runs_on: ubuntu-latest
      steps: [...]
    }
  }
}
```

Running `workpipe check` on this file produces:
```
WP7002: Agent job 'review_docs' in cycle 'improve_docs' is missing required 'runs_on' field
```

## Acceptance Criteria

- [x] Add `runs_on: ubuntu-latest` to `agent_job review_docs` in `examples/iterative-refinement/iterative-refinement.workpipe`
- [x] Regenerate `examples/iterative-refinement/expected.yml` if it exists
- [x] Verify `workpipe check examples/iterative-refinement/iterative-refinement.workpipe` passes with no errors
- [x] All tests continue to pass

## Technical Context

This is a simple one-line fix to add the missing required field. The validation code in `packages/compiler/src/semantics/required-fields.ts` correctly detects this issue (WP7002 for agent_job missing runs_on).

## Dependencies

None - this is a standalone bug fix.

## Notes

- This was caught during end-user acceptance review of WI-045
- Example files should be validated as part of CI to prevent regressions
- Consider adding a test that validates all example files compile without errors
