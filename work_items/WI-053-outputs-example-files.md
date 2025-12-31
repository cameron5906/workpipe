# WI-053: Add Example Files Demonstrating Job Outputs Feature

**ID**: WI-053
**Status**: In Progress
**Priority**: P2-High
**Milestone**: E (Documentation)
**Phase**: 3+ (Types + Outputs)
**Created**: 2025-12-31
**Updated**: 2025-12-31 (Started)

## Description

End-user acceptance review for WI-046 found that no example files demonstrate the new outputs feature. Users learn best from examples, and the existing examples don't show how to use typed outputs between jobs.

This work item creates dedicated example(s) showing the outputs feature in action.

## Acceptance Criteria

- [ ] New example directory: `examples/job-outputs/`
- [ ] WorkPipe file demonstrating outputs declaration and consumption
- [ ] Expected YAML showing generated outputs block
- [ ] README explaining the example
- [ ] Example shows:
  - Declaring typed outputs on a job
  - Setting outputs from a step using `$GITHUB_OUTPUT`
  - Consuming outputs in a dependent job via `needs.*.outputs.*`

## Deliverables Checklist

- [ ] `examples/job-outputs/job-outputs.workpipe` - Source file
- [ ] `examples/job-outputs/expected.yml` - Generated YAML
- [ ] `examples/job-outputs/README.md` - Explanation
- [ ] Update `examples/README.md` to include new example in index

## Technical Context

The outputs feature is new in WI-046. Key aspects to demonstrate:
- `outputs:` block with typed fields (string, int, bool, json)
- Step that sets outputs via `echo "name=value" >> $GITHUB_OUTPUT`
- Job with `needs:` that references `needs.<job>.outputs.<name>`
- Type annotations are compile-time only (GitHub Actions treats all as strings)

## Example Structure

```workpipe
workflow output_demo {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      build_number: int
    }
    steps: [
      step "set_outputs" run("""
        echo "version=1.0.0" >> $GITHUB_OUTPUT
        echo "build_number=42" >> $GITHUB_OUTPUT
      """)
    ]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo Deploying version ${{ needs.build.outputs.version }}")
    ]
  }
}
```

## Dependencies

- WI-052: Documentation must explain outputs first (parallel work possible)
- WI-046: Part of outputs feature completion

## Notes

- Can be done in parallel with WI-052 (documentation)
- Should follow existing example conventions (see `examples/ci-pipeline/`)
