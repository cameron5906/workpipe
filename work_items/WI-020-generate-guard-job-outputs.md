# WI-020: Generate Guard Job Outputs with GITHUB_OUTPUT

**ID**: WI-020
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: C (Guards + advanced triggers)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Enhance guard_js codegen to automatically wire job outputs so downstream jobs can consume guard results. Currently, guard_js steps write to `$GITHUB_OUTPUT`, but the job-level outputs are not automatically generated from guard steps.

Per PROJECT.md Section 7.2:
> A `guard_js """..."""` block compiles into:
> - a small script step (Node) that receives event payload, ref/branch metadata, inputs
> - writes `result=true/false` to `$GITHUB_OUTPUT`
> - downstream jobs use `if: needs.guard.outputs.should_run == 'true'`

WI-019 delivered the guard_js step compilation. This work item completes the guard story by:
1. Auto-generating job outputs from guard_js steps
2. Wiring downstream `if:` conditions when using guard outputs

## Current State (WI-019 Delivered)

The `transformGuardJsStep()` function in `transform.ts` currently:
- Generates a Node.js script step
- Writes `result=<value>` to `$GITHUB_OUTPUT`
- Uses the step ID for the `id:` field

What's missing:
- Job outputs are NOT automatically populated from guard_js steps
- Users must manually declare outputs in the DSL (see examples/guard-job)

## Acceptance Criteria

- [x] **Auto-generate guard outputs**: When a job contains a guard_js step, automatically add the step's `result` to job outputs
  - Output name: Use the step's id (e.g., `steps.decide.result` -> outputs.decide_result or outputs.result)
  - Format: `<step_id>_result` or just `result` if only one guard_js step
- [x] **Preserve explicit outputs**: If user declares explicit outputs, merge with auto-generated guard outputs
- [x] **Update example**: Update `examples/guard-job/` to demonstrate auto-generated outputs
- [x] **Tests**: Add tests for automatic output generation (target: 5+ new tests)
- [ ] **Documentation**: Update `docs/language-reference.md` to document auto-output behavior (deferred - minor)

## Technical Context

### Current Transform Code (transform.ts lines 228-255)

```typescript
function transformGuardJsStep(step: GuardJsStepNode): StepIR[] {
  const guardCode = step.code;

  const guardScript = `
const fs = require('fs');
const context = {
  event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
  ref: process.env.GITHUB_REF,
  inputs: JSON.parse(process.env.INPUTS || '{}')
};
const result = (function() { ${guardCode} })();
console.log('Guard result:', result);
fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + result + '\\n');
`.trim();

  const scriptStep: ScriptStepIR = {
    kind: "script",
    name: "Evaluate guard",
    id: step.id,
    run: `node -e "${guardScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
    shell: "bash",
    env: {
      INPUTS: "${{ toJson(inputs) }}",
    },
  };

  return [scriptStep];
}
```

### Proposed Changes

1. **Option A: Modify transformRegularJob/transformAgentJob**
   - After transforming steps, scan for guard_js steps
   - For each guard_js step, add to job outputs: `{ [step.id + '_result']: '${{ steps.' + step.id + '.outputs.result }}' }`
   - Merge with any explicit user-declared outputs

2. **Option B: Return output metadata from transformGuardJsStep**
   - Have `transformGuardJsStep` return `{ steps: StepIR[], outputs: OutputIR[] }`
   - Collect outputs during step transformation
   - Apply to job IR

### Example DSL

```workpipe
workflow guard_example {
  on: issues

  job guard {
    runs_on: ubuntu-latest
    steps: [
      step "decide" guard_js """
        return context.event.action === 'opened';
      """
    ]
    // No explicit outputs needed - auto-generated from guard_js step
  }

  job process {
    runs_on: ubuntu-latest
    needs: guard
    // Can reference: needs.guard.outputs.decide_result
    steps: [
      run("echo Processing...")
    ]
  }
}
```

### Generated YAML

```yaml
jobs:
  guard:
    runs-on: ubuntu-latest
    outputs:
      decide_result: ${{ steps.decide.outputs.result }}  # AUTO-GENERATED
    steps:
      - name: Evaluate guard
        id: decide
        run: node -e "..."
        shell: bash

  process:
    runs-on: ubuntu-latest
    needs: [guard]
    steps:
      - run: echo Processing...
```

### Key Files to Modify

1. `packages/compiler/src/codegen/transform.ts` - Add output collection from guard_js steps
2. `packages/compiler/src/__tests__/codegen.test.ts` - Add tests for auto-outputs
3. `examples/guard-job/guard-job.workpipe` - Simplify to show auto-output behavior
4. `docs/language-reference.md` - Document the feature

### Related Work Items

- WI-019: Implement guard_js compilation (COMPLETED - prerequisite)
- WI-021: Create guard helper library (BACKLOG - enhancement)

## Dependencies

- WI-019 (Completed) - guard_js step compilation infrastructure

## Notes

- Consider naming convention: `<step_id>_result` vs just `result`
- If multiple guard_js steps in one job, each needs a unique output name
- The DSL already supports explicit `outputs:` block - this should be merged, not replaced
- Cycle guard_js already handles outputs differently (termination_reason, continue) - keep that separate
