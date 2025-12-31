# Generate Concurrency Groups for Cycle Key

**ID**: WI-037
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: B (Strategy B cycle support - Polish)
**Phase**: 8 (Cycles)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Generate GitHub Actions `concurrency` configuration for cycles to prevent parallel executions of the same cycle. This ensures that only one iteration of a given cycle can run at a time, preventing race conditions in state artifact handling.

## Problem Statement

Without concurrency groups, if two workflow_dispatch triggers happen in quick succession (e.g., user manually triggers while auto-dispatch is in flight), both iterations could:
1. Download the same state artifact
2. Run body jobs in parallel
3. Race to upload new state
4. Cause state corruption or lost iterations

GitHub Actions' `concurrency` feature solves this by queuing or canceling duplicate runs.

## Acceptance Criteria

### Core Functionality
- [x] Generate `concurrency` block for workflows with cycles
- [x] Use cycle key as the concurrency group identifier
- [x] Set `cancel-in-progress: false` to queue rather than cancel iterations
- [x] `generateConcurrency()` function handles single/multiple cycle cases

### YAML IR Extension
- [x] Add `ConcurrencyIR` type to yaml-ir.ts
- [x] Add `concurrency` field to WorkflowIR
- [x] Emit concurrency block in YAML output via emit.ts

### Configuration
- [x] Default behavior: auto-generate from cycle name/key
- [ ] Future work: `concurrency = "custom-group"` syntax

### Testing
- [x] 4 new tests for concurrency generation
- [x] Golden test updated with concurrency block
- [x] 254 total tests passing

## Technical Context

### GitHub Actions Concurrency

From GitHub Actions documentation:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.inputs.cycle_key }}
  cancel-in-progress: false
```

- `group`: Jobs/workflows with the same group are serialized
- `cancel-in-progress: false`: Queue new runs instead of canceling

### From PROJECT.md Section 10.3 (Concurrency guard)

> **Concurrency guard via cycle key:**
> ```yaml
> concurrency:
>   group: my-cycle-${{ inputs.cycle_key }}
>   cancel-in-progress: false
> ```

### Current Cycle Key Usage

From `transform.ts`, cycles already support a `key` property:

```typescript
const keyName = cycle.key ?? "phase";
```

This key should be used in the concurrency group.

### YAML IR Extension

```typescript
// packages/compiler/src/codegen/yaml-ir.ts

export interface ConcurrencyIR {
  group: string;
  cancelInProgress: boolean;
}

export interface WorkflowIR {
  name: string;
  on: TriggerIR;
  jobs: Map<string, JobIR>;
  concurrency?: ConcurrencyIR;  // New field
}
```

### Transform Implementation

```typescript
// packages/compiler/src/codegen/transform.ts

function generateConcurrency(cycles: readonly CycleNode[]): ConcurrencyIR | undefined {
  if (cycles.length === 0) return undefined;

  // For single cycle, use its key
  if (cycles.length === 1) {
    const keyName = cycles[0].key ?? "phase";
    return {
      group: `\${{ github.workflow }}-\${{ github.event.inputs.${keyName} || 'bootstrap' }}`,
      cancelInProgress: false,
    };
  }

  // For multiple cycles, use workflow + all keys
  // This is a simplification - real multi-cycle workflows may need more thought
  return {
    group: `\${{ github.workflow }}-\${{ github.run_id }}`,
    cancelInProgress: false,
  };
}
```

### Emit Implementation

```typescript
// packages/compiler/src/codegen/emit.ts

function emitWorkflow(ir: WorkflowIR): object {
  const result: Record<string, unknown> = {
    name: ir.name,
    on: emitTrigger(ir.on),
  };

  if (ir.concurrency) {
    result.concurrency = {
      group: ir.concurrency.group,
      'cancel-in-progress': ir.concurrency.cancelInProgress,
    };
  }

  result.jobs = emitJobs(ir.jobs);
  return result;
}
```

### Expected Output

```yaml
name: cycle-example
on:
  workflow_dispatch:
    inputs:
      phase:
        description: Current iteration phase for cycle refine
        required: false
        default: '0'
      run_id:
        description: Run ID for artifact retrieval
        required: false
        default: ''

concurrency:
  group: ${{ github.workflow }}-${{ github.event.inputs.phase || 'bootstrap' }}
  cancel-in-progress: false

jobs:
  refine_hydrate:
    # ...
```

## Dependencies

- WI-032-035: Cycle codegen (complete) - provides cycle transformation
- WI-008: YAML IR (complete) - provides base IR types

## Files to Modify

- `packages/compiler/src/codegen/yaml-ir.ts` - Add ConcurrencyIR type
- `packages/compiler/src/codegen/transform.ts` - Generate concurrency
- `packages/compiler/src/codegen/emit.ts` - Emit concurrency block

## Testing

```typescript
describe("cycle concurrency groups", () => {
  it("generates concurrency block for cycle workflow", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle refine {
          max_iters = 5
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.ok).toBe(true);
    expect(result.value).toContain("concurrency:");
    expect(result.value).toContain("cancel-in-progress: false");
    expect(result.value).toContain("github.event.inputs.phase");
  });

  it("uses custom key in concurrency group", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle refine {
          key = "iteration"
          max_iters = 5
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.ok).toBe(true);
    expect(result.value).toContain("github.event.inputs.iteration");
  });

  it("does not generate concurrency for non-cycle workflows", () => {
    const result = compile(`
      workflow test {
        on: push
        job build {
          runs_on: ubuntu-latest
          steps: [run: "echo hello"]
        }
      }
    `);

    expect(result.ok).toBe(true);
    expect(result.value).not.toContain("concurrency:");
  });
});
```

## Notes

- `cancel-in-progress: false` is critical - we want to queue iterations, not cancel them
- The `|| 'bootstrap'` fallback handles the initial trigger where inputs may be empty
- Multiple cycles in one workflow is an edge case - may need design review
- Consider job-level concurrency as an alternative (more granular but more complex)
- This is important for production safety but not blocking for basic functionality

## Effort Estimate

- YAML IR extension: 0.5-1 hour
- Transform logic: 1-2 hours
- Emit changes: 0.5-1 hour
- Testing: 1-2 hours
- **Total: 3-6 hours** (small-medium scope)

## References

- GitHub Actions concurrency: https://docs.github.com/en/actions/using-jobs/using-concurrency
- PROJECT.md Section 10.3: Concurrency guard
