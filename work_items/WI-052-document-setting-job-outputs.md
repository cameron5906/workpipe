# WI-052: Document How to Set Job Outputs (P1 Blocker for WI-046)

**ID**: WI-052
**Status**: Completed
**Priority**: P1-High
**Milestone**: E (Documentation)
**Phase**: 3+ (Types + Outputs)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Completed)

## Description

End-user acceptance review for WI-046 (Job Outputs feature) found a critical documentation gap: the language-reference.md explains how to DECLARE outputs but not how to SET them from steps.

The documentation shows:
```workpipe
outputs: {
  version: string
  build_number: int
}
```

But users don't know they need to use `echo "name=value" >> $GITHUB_OUTPUT` or a `set_outputs` step to actually populate these values.

**User Impact:** Without this documentation, users will declare outputs but their workflows will fail at runtime because the outputs are never set.

## Acceptance Criteria

- [x] `docs/language-reference.md` Job Outputs section explains how to set outputs
- [x] Shows `$GITHUB_OUTPUT` syntax for shell scripts
- [x] Shows step id + outputs pattern for GitHub Actions steps
- [x] Example is complete and runnable

## Deliverables Checklist

- [x] Update Job Outputs section in `docs/language-reference.md`
- [x] Add example showing full workflow: declare output, set output, consume output
- [x] Mention the GitHub Actions mechanism (`$GITHUB_OUTPUT` environment file)

## Technical Context

GitHub Actions outputs work via:
1. Step outputs: `echo "name=value" >> $GITHUB_OUTPUT`
2. Job outputs: Map step outputs to job outputs in the `outputs:` declaration

The codegen already generates the outputs mapping correctly. Users just need to know:
- They must have a step that sets the output
- The step must use `$GITHUB_OUTPUT` or be an action that sets outputs
- The output name in the step must match what's declared

## Dependencies

- Blocks WI-046 completion (this is a P1 blocker)

## Notes

- This is a documentation-only fix
- No code changes required
- Should be quick to complete
