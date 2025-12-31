# Enforce max_iterations and Termination

**ID**: WI-036
**Status**: Completed
**Priority**: P1-High
**Milestone**: B (Strategy B cycle support - Polish)
**Phase**: 8 (Cycles)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Strengthen cycle termination handling by:
1. Adding semantic validation that cycles must have a termination condition
2. Enhancing the dispatch job to explicitly log when max_iters is reached
3. Adding diagnostics for potential unbounded cycles
4. Ensuring proper termination state is communicated through job outputs

## Current State Analysis

The current implementation in `packages/compiler/src/codegen/transform.ts` already has **partial** max_iterations enforcement:

```typescript
// createDispatchJob (lines 370-397)
const maxItersCheck = maxIters
  ? ` && \${{ needs.${cycleName}_hydrate.outputs.phase }} < ${maxIters}`
  : "";

// Applied to dispatch job's `if` condition:
if: `needs.${decideJobName}.outputs.continue == 'true'${maxItersCheck}`,
```

**What works:**
- When `max_iters` is set, the dispatch job won't trigger if phase >= maxIters
- The guard_js (`until`) condition is evaluated in the decide job

**What's missing:**
- No validation requiring cycles to have termination conditions
- No explicit "terminated due to max_iters" logging
- No WP6xxx diagnostic for potentially unbounded cycles
- No termination reason output for downstream jobs

## Acceptance Criteria

### Semantic Validation
- [x] Add WP6005 warning for cycles with `until` but no `max_iters` (safety recommendation)
- [x] Diagnostic integrated into compile flow via `validateCycles()`
- [x] Created `packages/compiler/src/semantics/cycle-validation.ts`

### Enhanced Termination Handling
- [x] Add `termination_reason` output to decide job ("guard_satisfied" | "max_iterations" | "continue")
- [x] Termination reason computed based on guard result and max_iters check
- [x] Reason exposed as job output for downstream consumption

### Code Quality
- [x] 10 new tests for cycle validation and termination handling
- [x] Validation integrated into compile() flow
- [x] 254 total tests passing

## Technical Context

### From PROJECT.md Section 10.2 (Strategy B lowering)

> Safety valves:
> - `max_iters` caps total workflow_dispatch triggers for a given cycle key
> - `on_timeout` can emit partial results or alert

### Diagnostic Code Assignment

From `packages/compiler/src/diagnostics/codes.ts`:
- WP6xxx = Cycle warnings/errors
- WP6001 = Cycle without termination (already exists conceptually)
- **WP6002** = New: Unbounded cycle warning

### Implementation Approach

1. **Add semantic check in AST validation phase:**

```typescript
// packages/compiler/src/semantics/cycle-validation.ts (new file)
export function validateCycles(workflow: WorkflowNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const cycle of workflow.cycles) {
    if (cycle.maxIters === null && cycle.until === null) {
      diagnostics.push({
        code: 'WP6002',
        severity: 'warning',
        message: `Cycle '${cycle.name}' has no termination condition (max_iters or until). ` +
                 `This cycle may run indefinitely.`,
        span: cycle.span,
      });
    }
  }

  return diagnostics;
}
```

2. **Enhance decide job outputs:**

```typescript
// In createDecideJob
outputs: {
  continue: "${{ steps.eval_guard.outputs.continue }}",
  termination_reason: "${{ steps.eval_guard.outputs.termination_reason }}",
}
```

3. **Add termination reason to guard script:**

```javascript
// In guard script
if (result) {
  fs.writeFileSync('.cycle-state/continue.txt', 'false');
  fs.writeFileSync('.cycle-state/reason.txt', 'guard_satisfied');
} else {
  fs.writeFileSync('.cycle-state/continue.txt', 'true');
  fs.writeFileSync('.cycle-state/reason.txt', 'continue');
}
```

4. **Add max_iters check to dispatch job with logging:**

```yaml
jobs:
  cycle_dispatch:
    steps:
      - name: Check termination
        id: check
        run: |
          PHASE=${{ needs.cycle_hydrate.outputs.phase }}
          MAX_ITERS=5  # injected from cycle.maxIters
          if [ "$PHASE" -ge "$MAX_ITERS" ]; then
            echo "Cycle terminated: max_iterations ($MAX_ITERS) reached"
            echo "terminated=true" >> $GITHUB_OUTPUT
            echo "reason=max_iterations" >> $GITHUB_OUTPUT
          else
            echo "terminated=false" >> $GITHUB_OUTPUT
          fi
```

## Dependencies

- WI-032-035: Cycle codegen (complete) - provides base implementation to enhance
- WI-044: Diagnostic system (complete) - provides diagnostic infrastructure

## Files to Modify

- `packages/compiler/src/codegen/transform.ts` - Enhance decide/dispatch jobs
- `packages/compiler/src/diagnostics/codes.ts` - Add WP6002
- `packages/compiler/src/compile.ts` - Wire semantic validation

## Files to Create

- `packages/compiler/src/semantics/cycle-validation.ts` - Cycle validation
- `packages/compiler/src/__tests__/cycle-validation.test.ts` - Tests

## Testing

```typescript
describe("cycle termination enforcement", () => {
  it("warns when cycle has no termination condition", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle infinite {
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'WP6002',
        severity: 'warning',
      })
    );
  });

  it("does not warn when cycle has max_iters", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle bounded {
          max_iters = 5
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: 'WP6002' })
    );
  });

  it("does not warn when cycle has until", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle bounded {
          until guard_js """return context.done;"""
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: 'WP6002' })
    );
  });

  it("generates termination_reason output", () => {
    const result = compile(`
      workflow test {
        on: workflow_dispatch
        cycle loop {
          max_iters = 3
          body {
            job work { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `);

    expect(result.ok).toBe(true);
    expect(result.value).toContain("termination_reason");
  });
});
```

## Notes

- This is "polish" work - the core cycle functionality is already working
- The diagnostic is a warning, not an error, to allow intentional unbounded cycles
- Consider future work: `--strict-cycles` flag to make WP6002 an error
- The termination_reason output enables downstream automation (notifications, cleanup)
- Keep backward compatibility with existing cycle-basic fixture

## Effort Estimate

- Semantic validation: 1-2 hours
- Enhanced outputs: 1-2 hours
- Testing: 1-2 hours
- **Total: 3-6 hours** (small-medium scope)
