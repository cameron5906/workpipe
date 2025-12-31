# ADR-0008: Strategy B Cycle Lowering and Phased Execution Model

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

ADR-0007 established the syntax and AST design for cycles in WorkPipe. This ADR specifies how `cycle` blocks are lowered (compiled) into GitHub Actions workflow YAML that implements iterative execution across multiple workflow runs.

GitHub Actions requires job graphs to be acyclic (DAGs). WorkPipe's Strategy B compilation model transforms explicit `cycle` blocks into a phased execution pattern using `workflow_dispatch` self-dispatch. Each workflow run equals one iteration; at the end of each iteration, the workflow dispatches itself with updated loop state until a termination condition is met.

This ADR covers the combined scope of WI-032 through WI-035:
- WI-032: cycle_hydrate job generation
- WI-033: cycle_body job generation
- WI-034: cycle_decide job generation
- WI-035: cycle_dispatch job generation

These four work items were combined into a single implementation unit because they form an indivisible, cohesive pattern that cannot be meaningfully tested in isolation.

**Key design tensions to resolve:**

1. **Job structure**: How many jobs should the cycle compile to, and what are their responsibilities?
2. **State passing**: How is iteration state passed between workflow runs?
3. **Guard execution**: How is the `guard_js` termination predicate evaluated at runtime?
4. **Dispatch mechanism**: How does one iteration trigger the next?
5. **Concurrency control**: How do we prevent overlapping cycle runs?
6. **Permissions**: What token permissions are required for the pattern to work?

## Decision

### 1. Four-Job Pattern

**Decision**: Each `cycle` block compiles to exactly four jobs with distinct responsibilities.

```yaml
jobs:
  cycle_hydrate:
    # Phase 1: Download state from previous run (skipped on iteration 0)

  cycle_body:
    # Phase 2: Execute the user's cycle body jobs

  cycle_decide:
    # Phase 3: Evaluate termination condition, emit continue/done signal

  cycle_dispatch:
    # Phase 4: Trigger next iteration if not done
```

**Job naming convention**: `<cycle_name>_hydrate`, `<cycle_name>_body`, `<cycle_name>_decide`, `<cycle_name>_dispatch`

For a cycle named `refine`, the jobs would be: `refine_hydrate`, `refine_body`, `refine_decide`, `refine_dispatch`.

**Rationale:**
- Clear separation of concerns aids debugging and monitoring
- Each job appears as a distinct step in GitHub Actions UI
- Failures are easy to localize (hydration failed vs. body failed vs. dispatch failed)
- Enables future enhancements (e.g., retry logic per phase)

**Job dependencies:**
```yaml
jobs:
  refine_hydrate:
    if: inputs._cycle_phase != '0'
    # ...

  refine_body:
    needs: [refine_hydrate]
    if: always() && (inputs._cycle_phase == '0' || needs.refine_hydrate.result == 'success')
    # ...

  refine_decide:
    needs: [refine_body]
    # ...

  refine_dispatch:
    needs: [refine_decide]
    if: needs.refine_decide.outputs.continue == 'true'
    # ...
```

### 2. Workflow Dispatch Inputs

**Decision**: Cycles inject three workflow_dispatch inputs with underscore-prefixed names to avoid collision with user inputs.

```yaml
on:
  workflow_dispatch:
    inputs:
      _cycle_phase:
        description: 'Cycle iteration number (0 = initial run)'
        required: false
        default: '0'
        type: string
      _cycle_key:
        description: 'Concurrency group identifier for this cycle'
        required: false
        default: ''
        type: string
      _cycle_prev_run_id:
        description: 'Run ID of previous iteration (for artifact download)'
        required: false
        default: ''
        type: string
```

**Naming rationale:**
- Underscore prefix (`_`) signals these are internal/system inputs
- Avoids collision with user-defined workflow inputs
- Consistent with common conventions for internal parameters

**Input semantics:**
- `_cycle_phase`: `"0"` for the initial (bootstrap) run, `"1"`, `"2"`, etc. for subsequent iterations
- `_cycle_key`: The cycle's `key` property value (or derived default), used for concurrency grouping
- `_cycle_prev_run_id`: The `github.run_id` from the previous iteration, required for cross-run artifact download

### 3. State Artifact Schema

**Decision**: Cycle state is persisted as a JSON artifact with a defined schema.

**Artifact naming**: `workpipe-state-<cycle_name>-iter-<N>-run-<run_id>`

Example: `workpipe-state-refine-iter-3-run-12345678`

**Schema:**
```json
{
  "iteration": 3,
  "key": "refine-key",
  "prevRunId": "12345678",
  "done": false,
  "maxIters": 10,
  "outputs": {
    "refine_body": {
      "quality_score": "0.87",
      "items_processed": "42"
    }
  }
}
```

**Field definitions:**

| Field | Type | Description |
|-------|------|-------------|
| `iteration` | number | Current iteration number (0-indexed internally, 1-indexed for display) |
| `key` | string | Cycle key for concurrency grouping |
| `prevRunId` | string | Run ID of the previous iteration |
| `done` | boolean | Whether termination condition was met |
| `maxIters` | number | Maximum iterations allowed (from cycle config) |
| `outputs` | object | Captured job outputs from cycle_body jobs, keyed by job name |

**Rationale:**
- JSON is human-readable and debuggable
- Captures all state needed for guard_js evaluation
- `outputs` field enables guard_js to access cycle_body job outputs
- Artifact immutability (v4) is handled by unique naming per iteration

### 4. Guard JS Execution Model

**Decision**: The `guard_js` code executes inline in a Node.js `run:` step within the `cycle_decide` job.

**Generated step:**
```yaml
- name: Evaluate termination condition
  id: guard
  run: |
    const fs = require('fs');
    const state = JSON.parse(fs.readFileSync('.workpipe/cycle-state.json', 'utf8'));

    // User's guard_js code (dedented, injected here)
    const result = (() => {
      return state.outputs.quality_score > 0.95;
    })();

    // Check max_iters safety rail
    const hitMaxIters = state.iteration >= state.maxIters - 1;
    const shouldContinue = !result && !hitMaxIters;

    console.log(`Guard result: ${result}, Hit max iters: ${hitMaxIters}, Continue: ${shouldContinue}`);

    const output = `continue=${shouldContinue}\ndone=${result || hitMaxIters}`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + '\n');
  shell: node {0}
```

**Execution context:**
- The `state` variable is available to user guard_js code
- `state.outputs` contains captured outputs from cycle_body jobs
- `state.iteration` is the current iteration number
- Guard code must return a boolean (truthy = terminate, falsy = continue)

**Rationale:**
- Inline execution avoids extra file I/O or action dependencies
- Node.js `shell` is available on all GitHub-hosted runners
- IIFE wrapper isolates user code from generated scaffolding
- `max_iters` check is applied as a safety rail regardless of guard result

**Error handling:**
- If guard_js throws, the step fails and the workflow stops (fail-safe)
- Runtime errors surface in GitHub Actions logs with stack traces

### 5. Dispatch Mechanism

**Decision**: Use the `gh workflow run` CLI command for self-dispatch.

**Generated step in cycle_dispatch:**
```yaml
- name: Dispatch next iteration
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    gh workflow run "${{ github.workflow }}" \
      --ref "${{ github.ref }}" \
      -f _cycle_phase="${{ needs.refine_decide.outputs.next_phase }}" \
      -f _cycle_key="${{ inputs._cycle_key }}" \
      -f _cycle_prev_run_id="${{ github.run_id }}"
```

**Rationale:**
- `gh` CLI is pre-installed on all GitHub-hosted runners
- Simpler than adding `actions/github-script` dependency
- Direct mapping to workflow_dispatch inputs via `-f` flags
- `GH_TOKEN` environment variable is the standard auth mechanism

**Alternatives rejected:**
- `actions/github-script@v7`: Overkill for a simple dispatch; adds action dependency
- Direct REST API call via curl: More complex, less readable, requires manual JSON construction

### 6. Concurrency Groups

**Decision**: Generate a `concurrency` block using the cycle's `_cycle_key` input.

```yaml
concurrency:
  group: ${{ inputs._cycle_key || 'default-cycle-group' }}
  cancel-in-progress: false
```

**Semantics:**
- All iterations of the same cycle share the same concurrency group
- `cancel-in-progress: false` ensures iterations complete rather than being cancelled
- If `_cycle_key` is empty (initial manual trigger), falls back to default group name

**Rationale:**
- Prevents overlapping runs of the same cycle
- Does not cancel in-progress work (important for expensive iterations)
- Cycle `key` property directly controls the group (predictable behavior)

**Initial run handling:**
When a workflow is triggered manually (not via self-dispatch), `_cycle_key` will be empty. The fallback ensures the concurrency group still works, but users should be aware that manual triggers without specifying `_cycle_key` may not group correctly with ongoing cycles.

### 7. Token Permissions

**Decision**: Document required permissions; optionally generate a `permissions` block.

**Required permissions:**
- `actions: write` - Required for `gh workflow run` to dispatch workflows
- `actions: read` - Required for cross-run artifact download

**Generated permissions block (optional):**
```yaml
permissions:
  actions: write
  contents: read
```

**Rationale:**
- Explicit permissions are more secure than relying on defaults
- `actions: write` is not granted by default in many repository configurations
- Documentation must clearly state permission requirements

**User responsibility:**
If the repository uses restricted default permissions, users must either:
1. Allow WorkPipe to generate a `permissions` block
2. Ensure their repository settings grant adequate permissions
3. Use a PAT or GitHub App token with appropriate scopes

## Complete Generated YAML Example

For this WorkPipe source:

```workpipe
workflow refinement {
  on: workflow_dispatch

  cycle refine {
    max_iters = 10
    key = "refine-${github.run_id}"

    until guard_js """
      return state.outputs.evaluate.quality_score > 0.95;
    """

    body {
      job analyze {
        runs_on: ubuntu-latest
        steps: [
          run: "echo 'Analyzing...'"
        ]
      }

      job evaluate {
        needs: analyze
        runs_on: ubuntu-latest
        steps: [
          run: "echo 'quality_score=0.87' >> $GITHUB_OUTPUT"
        ]
        outputs: {
          quality_score: steps.evaluate.outputs.quality_score
        }
      }
    }
  }
}
```

The compiler generates:

```yaml
name: refinement

on:
  workflow_dispatch:
    inputs:
      _cycle_phase:
        description: 'Cycle iteration number (0 = initial run)'
        required: false
        default: '0'
        type: string
      _cycle_key:
        description: 'Concurrency group identifier for this cycle'
        required: false
        default: ''
        type: string
      _cycle_prev_run_id:
        description: 'Run ID of previous iteration (for artifact download)'
        required: false
        default: ''
        type: string

concurrency:
  group: ${{ inputs._cycle_key || 'refinement-refine' }}
  cancel-in-progress: false

permissions:
  actions: write
  contents: read

jobs:
  refine_hydrate:
    runs-on: ubuntu-latest
    if: inputs._cycle_phase != '0'
    steps:
      - name: Download previous state
        uses: actions/download-artifact@v4
        with:
          name: workpipe-state-refine-iter-${{ inputs._cycle_phase }}-run-${{ inputs._cycle_prev_run_id }}
          path: .workpipe
          github-token: ${{ github.token }}
          repository: ${{ github.repository }}
          run-id: ${{ inputs._cycle_prev_run_id }}
    outputs:
      state_downloaded: 'true'

  refine_body_analyze:
    runs-on: ubuntu-latest
    needs: [refine_hydrate]
    if: always() && (inputs._cycle_phase == '0' || needs.refine_hydrate.result == 'success')
    steps:
      - run: echo 'Analyzing...'

  refine_body_evaluate:
    runs-on: ubuntu-latest
    needs: [refine_hydrate, refine_body_analyze]
    if: always() && (inputs._cycle_phase == '0' || needs.refine_hydrate.result == 'success')
    steps:
      - run: echo 'quality_score=0.87' >> $GITHUB_OUTPUT
        id: evaluate
    outputs:
      quality_score: ${{ steps.evaluate.outputs.quality_score }}

  refine_decide:
    runs-on: ubuntu-latest
    needs: [refine_body_evaluate]
    steps:
      - name: Prepare state file
        run: |
          mkdir -p .workpipe
          cat > .workpipe/cycle-state.json << 'EOF'
          {
            "iteration": ${{ inputs._cycle_phase }},
            "key": "${{ inputs._cycle_key }}",
            "prevRunId": "${{ inputs._cycle_prev_run_id }}",
            "maxIters": 10,
            "outputs": {
              "evaluate": {
                "quality_score": "${{ needs.refine_body_evaluate.outputs.quality_score }}"
              }
            }
          }
          EOF
      - name: Evaluate termination condition
        id: guard
        run: |
          const fs = require('fs');
          const state = JSON.parse(fs.readFileSync('.workpipe/cycle-state.json', 'utf8'));

          const result = (() => {
            return state.outputs.evaluate.quality_score > 0.95;
          })();

          const hitMaxIters = state.iteration >= state.maxIters - 1;
          const shouldContinue = !result && !hitMaxIters;
          const nextPhase = parseInt(state.iteration) + 1;

          console.log(`Guard result: ${result}, Hit max iters: ${hitMaxIters}, Continue: ${shouldContinue}`);

          fs.appendFileSync(process.env.GITHUB_OUTPUT, `continue=${shouldContinue}\n`);
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `done=${result || hitMaxIters}\n`);
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `next_phase=${nextPhase}\n`);
        shell: node {0}
      - name: Upload state artifact
        uses: actions/upload-artifact@v4
        with:
          name: workpipe-state-refine-iter-${{ steps.guard.outputs.next_phase }}-run-${{ github.run_id }}
          path: .workpipe/cycle-state.json
    outputs:
      continue: ${{ steps.guard.outputs.continue }}
      done: ${{ steps.guard.outputs.done }}
      next_phase: ${{ steps.guard.outputs.next_phase }}

  refine_dispatch:
    runs-on: ubuntu-latest
    needs: [refine_decide]
    if: needs.refine_decide.outputs.continue == 'true'
    steps:
      - name: Dispatch next iteration
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh workflow run "${{ github.workflow }}" \
            --ref "${{ github.ref }}" \
            -f _cycle_phase="${{ needs.refine_decide.outputs.next_phase }}" \
            -f _cycle_key="${{ inputs._cycle_key || 'refinement-refine' }}" \
            -f _cycle_prev_run_id="${{ github.run_id }}"
```

## Alternatives Considered

### Alternative 1: Single Monolithic Job

**Approach**: Compile the entire cycle into a single job with multiple steps.

```yaml
jobs:
  refine_cycle:
    steps:
      - name: Hydrate state
      - name: Run analyze
      - name: Run evaluate
      - name: Decide continuation
      - name: Dispatch next
```

**Pros:**
- Fewer jobs in GitHub Actions UI
- Simpler job dependency graph
- Potentially faster (no job startup overhead)

**Cons:**
- Harder to debug: which step failed?
- Cannot see parallel execution of body jobs
- Monolithic step logs are harder to navigate
- No job-level retry granularity

**Decision**: Rejected. The four-job pattern provides better observability and debugging experience, which is critical for iterative workflows that may run many times.

### Alternative 2: Separate Workflow Files Per Phase

**Approach**: Generate multiple workflow files, one per phase.

```
.github/workflows/
  refinement-bootstrap.yml
  refinement-iterate.yml
  refinement-finalize.yml
```

**Pros:**
- Each workflow file is simpler
- Clear separation of phases
- Independent versioning of phases

**Cons:**
- Poor developer experience (multiple files to manage)
- Cross-file coordination is error-prone
- Defeats WorkPipe's single-file abstraction goal
- Harder to see the overall flow

**Decision**: Rejected. Single-file generation from single-file source maintains the WorkPipe value proposition.

### Alternative 3: actions/github-script for Dispatch

**Approach**: Use `actions/github-script@v7` with Octokit for dispatching.

```yaml
- uses: actions/github-script@v7
  with:
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: '${{ github.workflow }}',
        ref: '${{ github.ref }}',
        inputs: {
          _cycle_phase: '${{ needs.refine_decide.outputs.next_phase }}',
          _cycle_key: '${{ inputs._cycle_key }}',
          _cycle_prev_run_id: '${{ github.run_id }}'
        }
      });
```

**Pros:**
- Type-safe Octokit API
- Rich error handling options
- Familiar for JavaScript developers

**Cons:**
- Adds external action dependency
- More verbose than `gh` CLI
- Overkill for a simple dispatch operation

**Decision**: Rejected. The `gh` CLI is simpler, pre-installed, and sufficient for this use case.

### Alternative 4: External State Store (e.g., Repository Variable)

**Approach**: Store cycle state in a GitHub repository variable instead of artifacts.

**Pros:**
- No artifact immutability concerns
- Faster access (no download step)
- Visible in repository settings

**Cons:**
- Repository variables have size limits
- Requires `variables: write` permission
- Less portable across forks
- Not as discoverable as artifacts

**Decision**: Rejected. Artifacts are the standard mechanism for cross-run state and have better tooling support.

## Consequences

### Positive

1. **Observable execution**: Four jobs with clear names make cycle execution easy to monitor in GitHub Actions UI.

2. **Debuggable failures**: When a cycle fails, the failing job name immediately indicates the phase (hydration, body, decision, dispatch).

3. **Standard patterns**: Uses well-known GitHub Actions patterns (artifacts, workflow_dispatch, concurrency groups).

4. **Safety guaranteed**: `max_iters` check is enforced in generated code regardless of guard_js behavior.

5. **No external dependencies**: Uses only `gh` CLI (pre-installed) and core actions (upload/download-artifact).

6. **Deterministic output**: Same WorkPipe source always generates the same YAML (modulo formatting).

### Negative

1. **Verbose generated YAML**: The four-job pattern produces substantial YAML that may be intimidating to read.

2. **Job startup overhead**: Each job incurs GitHub Actions job startup time (~5-15 seconds), which adds latency to each iteration.

3. **Cross-run artifact dependency**: Relies on `actions/download-artifact@v4` cross-run feature, which requires specific token permissions.

4. **Guard JS runtime errors**: Errors in user-provided guard_js code only surface at runtime, not compile time.

5. **Concurrency group limitations**: Manual triggers without `_cycle_key` may not group correctly with ongoing cycles.

### Neutral

1. **Underscore-prefixed inputs**: The `_cycle_*` naming convention is arbitrary but consistent.

2. **State artifact schema**: The schema is specific to WorkPipe; users should not depend on it directly.

3. **Node.js requirement**: Guard JS execution requires Node.js, which is available on all GitHub-hosted runners.

## Open Questions Resolved

**Q1: Should guard_js code run inline or be written to a file first?**
A: Inline. Simpler, avoids extra I/O, and the IIFE wrapper provides sufficient isolation.

**Q2: Use actions/github-script or gh CLI for dispatch?**
A: `gh` CLI. Simpler and pre-installed.

**Q3: What goes in the state artifact?**
A: Iteration number, key, previous run ID, done flag, max_iters, and captured outputs from body jobs.

**Q4: How do jobs outside the cycle depend on cycle completion?**
A: They should use `needs: [<cycle_name>_decide]` and check `needs.<cycle_name>_decide.outputs.done == 'true'`. (Future work may add syntactic sugar for this.)

**Q5: Should the compiler emit a permissions block?**
A: Yes, optionally. Documentation must clearly state that `actions: write` is required.

**Q6: How to handle the initial trigger vs. self-dispatch?**
A: Initial trigger has `_cycle_phase = '0'` (default), which skips hydration and uses fresh state.

## References

- [ADR-0007: Cycle Syntax and Guard Block Design](0007-cycle-syntax-and-guard-block-design.md) - Syntax and AST design (this ADR extends it)
- [ADR-0004: YAML IR Design and Emission Strategy](0004-yaml-ir-design-and-emission-strategy.md) - IR types and transform architecture
- PROJECT.md Section 10: Cycles (Strategy B) - Canonical specification
- [GitHub Actions: download-artifact cross-run](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/) - v4 cross-run artifact download
- [GitHub Actions: workflow_dispatch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch) - Dispatch trigger documentation
- [GitHub Actions: Concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency) - Concurrency group behavior
- [GitHub CLI: gh workflow run](https://cli.github.com/manual/gh_workflow_run) - CLI dispatch command
