# Generate Cycle Codegen - Phased Execution Jobs (Combined WI-032-035)

**ID**: WI-032 (consolidated WI-032, WI-033, WI-034, WI-035)
**Status**: Completed
**Priority**: P1-High
**Milestone**: B (Strategy B cycle support)
**Phase**: 8 (Cycles)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Generate all 4 phased execution jobs for Strategy B cycle lowering. This consolidated work item covers:
1. **cycle_hydrate** - Downloads state from previous run
2. **cycle_body** - Executes one iteration of cycle jobs
3. **cycle_decide** - Checks termination condition (guard_js)
4. **cycle_dispatch** - Triggers next iteration via workflow_dispatch

## Acceptance Criteria

### cycle_hydrate
- [x] Generate `cycle_hydrate` job in YAML IR
- [x] Job uses `actions/download-artifact@v4` with cross-run capability
- [x] Job accepts `run-id` input for previous run identification
- [x] Job exposes cycle state as outputs for body jobs
- [x] Job handles bootstrap case (iteration 0, no previous state)

### cycle_body
- [x] Generate `cycle_body_<job>` jobs for each job in cycle body
- [x] Jobs depend on hydrate job
- [x] Jobs execute user-defined steps

### cycle_decide
- [x] Generate `cycle_decide` job with guard_js evaluation
- [x] Job runs after all body jobs complete
- [x] Job outputs continue decision

### cycle_dispatch
- [x] Generate `cycle_dispatch` job with workflow_dispatch trigger
- [x] Job uses GitHub API to dispatch next iteration
- [x] Job passes cycle state forward

### Infrastructure
- [x] YAML IR types extended (WorkflowDispatchInputIR, DownloadArtifactStepIR, ScriptStepIR)
- [x] Transform handles cyclic workflows with `transformCycle()`
- [x] Emit serializes all new IR types
- [x] workflow_dispatch inputs added automatically
- [x] Unit tests for cycle codegen
- [x] Golden test for cycle-basic example

## Technical Context

### From PROJECT.md Section 10.2 (Strategy B lowering)

> **Phase N (iterative runs):**
> - First job downloads previous run's cycle-state artifact using `actions/download-artifact` cross-run inputs (`run-id`, token)

### Cross-Run Artifact Download

GitHub Actions v4 artifacts support cross-run downloads:

```yaml
- uses: actions/download-artifact@v4
  with:
    name: cycle-state-${{ inputs.cycle_key }}
    run-id: ${{ inputs.prev_run_id }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Workflow Dispatch Inputs

The workflow needs inputs for cycle coordination:

```yaml
on:
  workflow_dispatch:
    inputs:
      _cycle_phase:
        description: 'Cycle phase (0=bootstrap, N=iteration)'
        required: false
        default: '0'
      _cycle_prev_run_id:
        description: 'Previous run ID for artifact download'
        required: false
      _cycle_key:
        description: 'Cycle key for artifact naming'
        required: false
```

### cycle_hydrate Job Structure

```yaml
jobs:
  cycle_hydrate:
    runs-on: ubuntu-latest
    if: inputs._cycle_phase != '0'
    outputs:
      iteration: ${{ steps.load.outputs.iteration }}
      state: ${{ steps.load.outputs.state }}
    steps:
      - name: Download cycle state
        uses: actions/download-artifact@v4
        with:
          name: cycle-state-${{ inputs._cycle_key }}
          run-id: ${{ inputs._cycle_prev_run_id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          path: .workpipe/state

      - name: Load state
        id: load
        run: |
          STATE=$(cat .workpipe/state/cycle-state.json)
          echo "iteration=$(echo $STATE | jq -r '.iteration')" >> $GITHUB_OUTPUT
          echo "state<<EOF" >> $GITHUB_OUTPUT
          echo "$STATE" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
```

### Bootstrap Case (Phase 0)

On first run (phase 0), the hydrate job is skipped via `if` condition:

```yaml
cycle_hydrate:
  if: inputs._cycle_phase != '0'
```

The body jobs run with initial state defaults.

### YAML IR Extension

```typescript
// packages/compiler/src/codegen/yaml-ir.ts

export interface CycleHydrateJobIR {
  type: 'cycle_hydrate';
  cycleName: string;
  cycleKey: string;
}

// Extended JobIR union
export type JobIR = StandardJobIR | CycleHydrateJobIR | CycleBodyJobIR | CycleDecideJobIR | CycleDispatchJobIR;
```

### Transform Integration

```typescript
// packages/compiler/src/codegen/transform.ts

function transformCyclicWorkflow(workflow: WorkflowNode, analysis: GraphAnalysis): WorkflowIR {
  const jobs: Record<string, JobIR> = {};

  // Add workflow_dispatch trigger with cycle inputs
  const triggers = addCycleInputs(workflow.trigger);

  // For each cycle in the workflow
  for (const cycle of workflow.cycles) {
    // Generate cycle_hydrate job
    jobs[`${cycle.name}_hydrate`] = generateCycleHydrateJob(cycle);

    // Generate cycle_body jobs (WI-033)
    // Generate cycle_decide job (WI-034)
    // Generate cycle_dispatch job (WI-035)
  }

  // Add non-cycle jobs
  for (const job of workflow.jobs) {
    if (!analysis.isInCycle(job.name)) {
      jobs[job.name] = transformJob(job);
    }
  }

  return { name: workflow.name, on: triggers, jobs };
}
```

## Dependencies

- WI-031: SCC detection (complete) - identifies cyclic components
- WI-030: Cycle syntax (complete) - provides CycleNode
- WI-008: YAML IR (complete) - base IR types to extend

## Files to Modify

- `packages/compiler/src/codegen/yaml-ir.ts` - Add cycle job IR types
- `packages/compiler/src/codegen/transform.ts` - Handle cyclic workflows
- `packages/compiler/src/codegen/emit.ts` - Emit cycle jobs

## Files to Create

- `packages/compiler/src/codegen/cycle-jobs.ts` - Cycle job generation
- `packages/compiler/src/__tests__/cycle-codegen.test.ts` - Tests

## Testing

```typescript
describe("cycle_hydrate generation", () => {
  it("generates hydrate job with artifact download", () => {
    const workflow = buildAST(`
      workflow test {
        on: workflow_dispatch
        cycle loop {
          max_iters = 5
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `)[0];

    const result = compile(workflow);
    expect(result.ok).toBe(true);

    const yaml = result.value;
    expect(yaml).toContain("loop_hydrate:");
    expect(yaml).toContain("actions/download-artifact@v4");
    expect(yaml).toContain("run-id:");
  });

  it("adds workflow_dispatch inputs for cycle coordination", () => {
    // ...
  });

  it("skips hydrate on bootstrap phase", () => {
    // Check if condition
  });
});
```

## Notes

- The hydrate job must run before any body jobs
- Cross-run artifact download requires `actions:read` permission
- State JSON format should be defined and documented
- Consider compression for large state objects
- Error handling for missing artifacts (first run, or previous run failed)
- This is the first of 4 cycle codegen work items (WI-032 through WI-035)

## References

- GitHub Actions download-artifact v4: https://github.com/actions/download-artifact
- Cross-run artifacts blog: https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/
- PROJECT.md Section 10.2: Strategy B lowering
- PROJECT.md Section 10.4: Permissions for dispatch + artifact reads
