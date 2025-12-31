# WorkPipe — Language + Compiler Design Doc (Lezer DSL → GitHub Actions)

**Audience:** implementation team (compiler + tooling + CI owners)
**Status:** design v1 (Strategy **B** for cycles: multi-run “phased” execution via `workflow_dispatch`)
**Primary output:** one or more ready-to-commit `.github/workflows/*.yml` files + a **bootstrap workflow** that compiles any `*.workpipe` specs in-repo into `.github/workflows/`

------

## 1) Why WorkPipe exists

GitHub Actions YAML is simultaneously:

- deceptively simple,
- painfully strict (DAG-only job graph, odd expression rules),
- and full of hidden footguns (artifacts immutability in v4, token-trigger restrictions, dispatch caveats, matrix limits).

WorkPipe’s job is to **make the common path easy and safe**:

- “workflow” is the foundation type
- hardcode “runs-on: ubuntu-latest”
- make dependencies & parameter passing *typed and automatic*
- build in first-class “agentic tasks” (Claude Code GitHub Action)
- support all trigger types with guard abstractions
- support matrices
- support **cycles** (with Strategy B: cross-run phased scheduling)

------

## 2) Research notes (contracts we’re building on)

### 2.1 Artifacts: v4 immutability + cross-run downloads

- In `upload-artifact@v4`, **artifact names are immutable per workflow run**; you can’t upload multiple artifacts with the same name in a run, which matters a ton for matrices and “append to artifact” patterns. ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
- `download-artifact` in the newer model supports **cross-run downloads** if you provide `github-token`, `repository`, and `run-id`, and the token has `actions:read`. ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
  **Design implication:** WorkPipe must generate **globally unique artifact names** per producer, and cycles must pass `run_id` between phases so later phases can fetch earlier artifacts.

### 2.2 Workflow chaining & the “GITHUB_TOKEN won’t trigger more workflows” rule

GitHub’s default token has restrictions: events created by `GITHUB_TOKEN` generally **don’t trigger new workflow runs**, with special casing around explicitly dispatched workflows. ([GitHub Docs](https://docs.github.com/actions/using-workflows/triggering-a-workflow?utm_source=chatgpt.com))
**Design implication:** Strategy B (phased cycles) must advance via `workflow_dispatch` / REST dispatch, not by “commit a file to trigger the next stage.”

### 2.3 workflow_dispatch realities

- `workflow_dispatch` is a trigger like any other: if you also have `pull_request`, it’ll trigger on PRs too (people get confused by this constantly). ([Stack Overflow](https://stackoverflow.com/questions/76363988/github-actions-workflow-dispatch-event-triggers-automatically-on-pull-request))
- `workflow_dispatch` generally requires the workflow file to exist on the default branch to show/run from the UI (and practically, for many dispatch flows). ([GitHub](https://github.com/orgs/community/discussions/5435?utm_source=chatgpt.com))
  **Design implication:** WorkPipe’s compiler-generated workflows must be committed to default branch for reliable dispatch-based phase chaining.

### 2.4 Claude Code CLI flags (for agentic tasks)

Claude Code supports:

- `--json-schema` for validated structured output in print mode
- `--max-turns`, `--model`
- `--allowedTools`, `--disallowedTools`, `--tools`
- `--mcp-config` (+ `--strict-mcp-config`)
- system prompt controls (`--system-prompt`, `--system-prompt-file`, `--append-system-prompt`) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
  **Design implication:** WorkPipe “agent tasks” should compile into `claude_args` that directly map to these flags, and should treat tool/MCP config as first-class typed config.

### 2.5 Lezer as the parser foundation

Lezer is built for incremental parsing and editor tooling; its generator + grammar format is designed for **real language tooling**, not “toy regex parsing.” ([Lezer](https://lezer.codemirror.net/docs/guide/?utm_source=chatgpt.com))
**Design implication:** we can ship (a) a real compiler, and (b) a real VS Code extension experience with syntax highlighting + diagnostics, without reinventing parsing.

------

## 3) Goals / Non-goals

### Goals

1. **Readable spec** that compiles to GitHub Actions workflows (YAML)
2. **Typed parameter passing** across jobs (inputs, outputs, artifacts)
3. **Agentic tasks** with Claude Code Action + JSON-schema output artifacts
4. **Trigger coverage**: all GitHub triggers + “guard” abstraction for complex conditions
5. **Matrices** with safe defaults and deterministic artifact naming
6. **Cycles supported** using Strategy B (phased workflow runs)

### Non-goals (v1)

- Perfect 1:1 mapping of every YAML feature as first-class syntax (we’ll provide an escape hatch)
- A full general-purpose programming language (keep it declarative)
- Replacing GitHub Actions expression language entirely (we’ll wrap/contain it)

------

## 4) The WorkPipe mental model

A WorkPipe repo contains:

- `workpipe/` (or `workflows/` — pick one, but be consistent)
  - `*.workpipe` spec files (each defines one workflow)
- `.github/workflows/workpipe-compile.yml` (bootstrap compiler workflow, checked in)
- `.github/workflows/*.yml` generated outputs (also checked in)

Key philosophy:

- Specs are the source of truth.
- Generated workflows are deterministic and reviewable.
- Bootstrap workflow keeps generated files in sync.

------

## 5) Language overview (syntax + semantics)

### 5.1 File extension & top-level construct

- Extension: `*.workpipe`
- Top-level must be exactly one `workflow` block.

### 5.2 Example: “simple DAG + artifact passing + agent task”

```workpipe
workflow "Issue Pipeline" {
  triggers {
    on issues.closed
    on workflow_dispatch { input issue_number: int required }
  }

  inputs {
    issue_number: int? = triggers.workflow_dispatch.issue_number
  }

  job guard {
    step "decide" guard_js """
      // return true/false
      return !!context.payload.issue && context.payload.issue.number > 0;
    """
    outputs {
      should_run: bool = steps.decide.result
    }
  }

  job prep when guard.outputs.should_run {
    emits issue_ctx: json

    step "gather" run """
      echo '{"issue": ${ISSUE_NUMBER}}' > issue.json
    """ env { ISSUE_NUMBER = inputs.issue_number }

    emit issue_ctx from_file "issue.json"
  }

  agent_job triage after prep {
    needs guard

    agent_task "product-owner" {
      model = "sonnet"
      max_turns = 10

      tools {
        allowed = ["Read", "Glob", "Grep", "Bash(gh issue view:*)"]
      }

      mcp {
        strict = true
        config_file = ".mcp.json"
      }

      system_prompt = file("prompts/po.system.txt")
      prompt = template("""
        triage issue {{inputs.issue_number}}.
        Use the repo docs as canonical.
      """)

      output_schema = file("schemas/triage.schema.json")
      output_artifact = "triage_output"
    }

    consumes issue_ctx from prep.issue_ctx
  }
}
```

What this should compile to:

- `on:` with issue + workflow_dispatch inputs
- a `guard` job that sets an output via `GITHUB_OUTPUT` (or equivalent) ([GitHub Docs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands))
- artifact upload/download for `issue_ctx`
- a job step using `anthropics/claude-code-action@v1` with `claude_args` built from the agent_task config
- an uploaded artifact containing the structured JSON output (unique name, per run) ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))

------

## 6) Type system (the “no more YAML spaghetti strings” part)

### 6.1 Primitive types

- `string`, `int`, `float`, `bool`
- `json` (untyped JSON blob)
- `enum<...>` (string enum)
- `secret<string>` (compile-time “don’t echo me”, runtime from `secrets.X`)
- `path` (string with “path-ish” validations)

### 6.2 Workflow inputs

WorkPipe inputs can come from:

- `workflow_dispatch.inputs.*`
- event payload projections (e.g., `issues.closed.issue.number`)
- literals / defaults

WorkPipe compiler responsibilities:

- ensure required inputs exist on every trigger path (or require `?` optional)
- generate GitHub Actions `workflow_dispatch.inputs` definitions with correct types (where supported) ([GitHub Docs](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions?utm_source=chatgpt.com))

### 6.3 Job outputs

Jobs can define typed outputs:

- output values must originate from:
  - `steps.<id>.outputs.<name>` (if the step is an action)
  - or a generated “set output” helper step writing to `$GITHUB_OUTPUT` ([GitHub Docs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands))

Compiler enforces:

- outputs referenced must exist
- referenced type must match declared type (or be explicitly cast)

### 6.4 Artifacts as typed values

Artifacts are how we pass structured data and files safely:

- `emits foo: json`
- `consumes foo from other_job.foo`

Compiler generates:

- `upload-artifact@v4` with unique artifact name
- `download-artifact` in consumers (same run for DAG; cross-run for cycle phases) ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))

**Naming rule (hard requirement):**
Artifact name = `wp.<workflow_slug>.<producer_job>.<artifact_id>.<run_attempt>.<matrix_fingerprint?>`

This prevents v4 “same name twice” failures in matrices. ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))

------

## 7) Triggers + Guards

### 7.1 Trigger coverage

WorkPipe aims to support **all GitHub triggers** by providing:

- a typed “trigger DSL” for the common filters (branches, tags, paths, types)
- an escape hatch for event-specific config blocks
- “guard jobs” for advanced filtering that YAML can’t express cleanly

### 7.2 Guard abstraction

A `guard_js """..."""` block compiles into:

- a small script step (Node) that receives:
  - event payload
  - ref/branch metadata
  - inputs
- writes `result=true/false` to `$GITHUB_OUTPUT`
- downstream jobs use `if: needs.guard.outputs.should_run == 'true'`

This is the cleanest way to hide nonsense like:

- “only run on issue label X”
- “only run if files under /docs changed”
- “only run if PR author is in allowlist”

WorkPipe makes guards first-class so teams stop copy/pasting brittle bash one-liners.

------

## 8) Matrices (without artifact-name landmines)

### 8.1 Syntax

```workpipe
job test matrix {
  axes {
    node: [18, 20]
    shard: [1..4]
  }
  max_parallel = 4
  fail_fast = false
}
```

### 8.2 Compiler responsibilities

- generate GitHub’s `strategy.matrix` with `include`/`exclude` as needed
- automatically incorporate matrix identity into:
  - artifact names
  - job display names
- enforce job-count limits and warn on “too large” expansions (GitHub has practical limits; design should include a hard ceiling + friendly error). ([Lezer](https://lezer.codemirror.net/docs/guide/?utm_source=chatgpt.com))

------

## 9) Agentic tasks (Claude Code Action) as a first-class construct

### 9.1 What we’re standardizing

WorkPipe’s `agent_task` config must control:

- MCP config (`--mcp-config`, `--strict-mcp-config`) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
- allowed/disallowed tools (`--allowedTools`, `--disallowedTools`, optionally `--tools`) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
- model (`--model`) and max turns (`--max-turns`) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
- system prompt strategy (`--append-system-prompt` default; allow replace/file) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
- structured output (`--json-schema`) ([Claude Code](https://code.claude.com/docs/en/cli-reference))
- output artifact naming + retrieval

### 9.2 Practical structured output design (the “don’t depend on action internals” rule)

Because we can’t safely assume the Claude action exposes structured output in a uniform way across versions, WorkPipe will enforce this robust pattern:

1. Compiler generates a **known output file path**, e.g.:
   - `.workpipe/out/<task_id>.json`
2. Compiler injects into the system prompt (or appended system prompt) a hard requirement:
   - “Write final JSON matching this schema to `<path>`; no extra keys; overwrite file.”
3. A subsequent step uploads that file as an artifact (`upload-artifact@v4`) with a unique name. ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
4. Consumers download artifact and parse JSON using a tiny helper step.

This avoids fragile coupling to action output fields while still using the Claude Code Action as requested.

### 9.3 Compilation sketch (YAML-ish)

(illustrative; actual YAML generator should be deterministic)

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    github_token: ${{ steps.app-token.outputs.token }}
    claude_args: >
      --model sonnet
      --max-turns 10
      --strict-mcp-config
      --mcp-config .mcp.json
      --json-schema '${{ env.WP_SCHEMA_JSON }}'
      --append-system-prompt '${{ env.WP_SYSTEM_APPEND }}'
    prompt: ${{ env.WP_PROMPT }}
- name: Upload agent output
  uses: actions/upload-artifact@v4
  with:
    name: wp.issue-pipeline.triage.triage_output.${{ github.run_attempt }}
    path: .workpipe/out/triage_output.json
```

------

## 10) Cycles (Strategy B): phased execution across workflow runs

GitHub Actions job graphs must be acyclic. WorkPipe will accept cycles in the *spec graph* and compile them to **phases**.

### 10.1 The model

- Treat the workflow as a directed graph of jobs (edges exist when a job consumes an output/artifact from another job, or has explicit `after`).
- If the graph is acyclic: generate normal DAG YAML.
- If cyclic: compute strongly connected components (SCCs). Any SCC with >1 node (or a self-loop) is a “cycle component.”

### 10.2 Strategy B lowering

Compile cyclic components into an iterative multi-run mechanism:

**Phase 0 (bootstrap run):**

- Run all non-cyclic jobs that can run before the cycle component
- Produce a “cycle state artifact”:
  - current iteration number
  - any carried state (JSON)
  - list of pending jobs
- Dispatch Phase 1 using REST `createWorkflowDispatch` and pass:
  - `phase=1`
  - `prev_run_id=${{ github.run_id }}`
  - `cycle_state_artifact_name=...`

**Phase N (iterative runs):**

- First job downloads previous run’s cycle-state artifact using `actions/download-artifact` cross-run inputs (`run-id`, token) ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
- Execute one iteration worth of the cycle component:
  - either:
    - (a) one “unrolled” pass through the SCC’s jobs in a deterministic order, or
    - (b) a “cycle driver job” that runs steps representing those jobs (less parallelism, simpler state)
- Emit updated cycle-state artifact
- If termination condition met (max iterations OR convergence predicate): stop
- Else dispatch next phase with `prev_run_id=this_run_id`

### 10.3 Termination & safety rails

WorkPipe requires every cycle to define at least one:

- `max_iters` (hard stop)
- `until guard_js` (convergence predicate based on outputs)
- optional backoff strategy for dispatching next phase

This prevents “congratulations, you invented a CI infinity machine.”

### 10.4 Permissions for dispatch + artifact reads

- Dispatching a workflow via REST requires appropriate `permissions` on `GITHUB_TOKEN` (or a PAT/App token). At minimum, configure workflow permissions explicitly rather than relying on defaults. ([GitHub Docs](https://docs.github.com/actions/security-guides/automatic-token-authentication?utm_source=chatgpt.com))
- Cross-run artifact downloads require `actions:read` on the token used. ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))

------

## 11) Compiler architecture

### 11.1 Pipeline

1. **Parse** (`Lezer`): spec text → concrete syntax tree (CST)
2. **AST build**: CST → typed AST nodes with spans
3. **Name resolution**: symbol tables for workflows/jobs/steps/artifacts/inputs
4. **Type checking**: unify types across assignments, outputs, artifact contracts
5. **Graph build**: construct dependency graph from:
   - explicit `after`
   - implicit edges from referencing outputs/artifacts
6. **Cycle detection + lowering**:
   - SCC analysis
   - if cyclic → Strategy B phase-plan IR
7. **IR → YAML**:
   - deterministic ordering
   - stable formatting
8. **Write outputs**:
   - `.github/workflows/<workflow>.yml` (per spec)
   - `.github/workflows/workpipe-compile.yml` (bootstrap, if not already present / or managed)
9. **Diagnostics**:
   - parse errors
   - semantic errors
   - actionable suggestions

### 11.2 Implementation language

- TypeScript compiler package (Node 20 aligns with common GitHub Actions setups)
- Lezer grammar + generated parser
- YAML emitter (`yaml` package recommended for stable output; avoid “string templates”)

### 11.3 Lezer grammar strategy

- Keep grammar relatively small; push complexity into semantic phase.
- Use explicit keywords to avoid ambiguous parse states.
- Make whitespace/comments liberal.
- Preserve string blocks (`"""..."""`) for prompts/scripts.

Key: strong error recovery so we can emit diagnostics even with partially typed files. That’s one of Lezer’s strengths for editor tooling. ([Lezer](https://lezer.codemirror.net/docs/guide/?utm_source=chatgpt.com))

------

## 12) Error model (compiler diagnostics that don’t insult the reader)

WorkPipe errors must include:

- file, line, column span
- error code (stable)
- short message + “what you probably meant”
- fix-it hints when possible

Examples:

**WP1003 Unknown artifact**

> `triage consumes issue_ctx from prep.issue_ctx`
> `prep` does not emit `issue_ctx`. Did you mean `issue_ctx_v2`?

**WP2107 Artifact name collision in matrix**

> `emit report` inside a matrix job requires unique artifact naming.
> WorkPipe will auto-suffix with matrix fingerprint; disable auto-suffix only if you set `artifact_naming = explicit`.

**WP4002 Cycle has no termination**

> Cycle component `{A,B,C}` requires `max_iters` or `until ...`.
> Add `cycle { max_iters = 10 }` or `cycle { until guard_js "..." }`.

------

## 13) Bootstrap workflow (self-hosting compiler)

### 13.1 What it does

A single checked-in workflow:

- triggers on changes to `workpipe/**/*.workpipe` (and optionally compiler version files)
- installs Node + WorkPipe compiler
- runs `workpipe compile`
- writes generated YAML into `.github/workflows/`
- commits changes back to the repo (optional but recommended for “generated is always up to date”)

**Important:** pushes made using `GITHUB_TOKEN` won’t recursively trigger more workflows, which is actually good for preventing infinite loops. ([GitHub Docs](https://docs.github.com/actions/using-workflows/triggering-a-workflow?utm_source=chatgpt.com))

### 13.2 Safety rules

- If running on PR from fork: do **not** push generated workflows (restricted token); instead upload them as an artifact for review.
- If running on default branch push: push updates normally.

------

## 14) Escape hatches (because GitHub Actions is… GitHub Actions)

WorkPipe must allow:

- `raw_yaml` blocks at:
  - workflow level (`on`, `permissions`, `env`)
  - job level (`steps`, `services`, `timeout-minutes`, `container`, etc.)

But with guardrails:

- raw blocks are isolated
- compiler warns if raw YAML affects typed contracts (e.g., overwriting artifact names)

------

## 15) Implementation rubric (what the team builds, in order)

### Phase 0 — Repo + contracts

- Define spec folder convention (`workpipe/`)
- Define output convention (`.github/workflows/generated/*.yml` or flat)
- Define CLI:
  - `workpipe compile`
  - `workpipe fmt`
  - `workpipe check`

### Phase 1 — Parser + AST + formatter

- Lezer grammar v0
- AST builder with spans
- “format” pass (optional but huge for adoption)

### Phase 2 — Minimal workflow codegen

- triggers, 1–N jobs, run steps, basic `needs`
- deterministic YAML emitter

### Phase 3 — Types + outputs

- workflow inputs (dispatch + event projections)
- job outputs + step ids
- diagnostics framework

### Phase 4 — Artifacts

- emits/consumes
- unique naming strategy for v4 immutability ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
- cross-job artifact wiring

### Phase 5 — Guards

- guard-js compilation to job outputs (`$GITHUB_OUTPUT`) ([GitHub Docs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands))
- library of helpers (common predicates)

### Phase 6 — Matrices

- axes, include/exclude
- artifact naming with matrix fingerprint
- job count limit warnings ([Lezer](https://lezer.codemirror.net/docs/guide/?utm_source=chatgpt.com))

### Phase 7 — Agent tasks (Claude Code Action integration)

- compile `agent_task` to:
  - standardized checkout + auth scaffolding
  - `anthropics/claude-code-action@v1` step
  - output file contract + upload-artifact
- map flags:
  - `--model`, `--max-turns`, `--allowedTools`, `--disallowedTools`, `--mcp-config`, `--strict-mcp-config`, `--json-schema`, prompt flags ([Claude Code](https://code.claude.com/docs/en/cli-reference))

### Phase 8 — Cycles (Strategy B)

- SCC detection
- phase-plan IR
- dispatch step generation (REST)
- cross-run artifact retrieval with `run-id` ([The GitHub Blog](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/))
- termination enforcement

### Phase 9 — Tooling polish

- VS Code extension:
  - syntax highlighting from Lezer grammar
  - diagnostics from compiler
- docs + examples

------

## 16) Deliverables checklist (definition of “done enough to ship”)

-  `workpipe` CLI with `compile/check/fmt`
-  Lezer grammar + generated parser committed
-  deterministic YAML output (golden tests)
-  artifact passing works across jobs + matrix
-  agent_task generates Claude Code action job + uploads schema-valid JSON artifact
-  cycles compile to phased dispatch plan with hard termination
-  bootstrap workflow compiles specs and syncs `.github/workflows/`
-  documentation + 5 example specs (CI, release, agent pipeline, matrix, cycle)