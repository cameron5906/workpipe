# Implement Cycle Syntax and AST

**ID**: WI-030
**Status**: Completed
**Priority**: P1-High
**Milestone**: B (Strategy B cycle support)
**Phase**: 8 (Cycles)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Implement the `cycle` syntax and AST nodes for WorkPipe's Strategy B cycle support. This enables iterative workflows that span multiple GitHub Actions runs, working around the DAG-only constraint of GitHub Actions job graphs.

Cycles are a key differentiator - they allow WorkPipe to express workflows that iterate until a condition is met, something impossible in native GitHub Actions YAML.

## Acceptance Criteria

- [x] Grammar extended with `cycle` block construct
- [x] Cycle configuration properties:
  - [x] `max_iters` - hard iteration limit (required safety rail)
  - [x] `until` - convergence predicate (optional)
  - [x] `key` - unique identifier for concurrency grouping
- [x] `body` block containing jobs to execute per iteration
- [x] AST types for `CycleNode`, `CycleBodyNode`, `GuardJsNode`
- [x] AST builder handles cycle constructs
- [x] Validation: cycles must have `max_iters` or `until` (safety rail) - WP6001 diagnostic
- [x] Example fixture with golden test (`examples/cycle-basic/`)
- [x] Unit tests for grammar and AST (13 new tests)

## Technical Context

### From PROJECT.md Section 10 (Cycles - Strategy B)

> GitHub Actions job graphs must be acyclic. WorkPipe will accept cycles in the *spec graph* and compile them to **phases**.

**Strategy B lowering:**
- Phase 0 (bootstrap): Run pre-cycle jobs, produce cycle state artifact, dispatch Phase 1
- Phase N (iterative): Download previous state, execute cycle body, check termination, dispatch next phase or stop

**Termination requirements:**
> WorkPipe requires every cycle to define at least one:
> - `max_iters` (hard stop)
> - `until guard_js` (convergence predicate based on outputs)

### Proposed Syntax

```workpipe
workflow iterative_refinement {
  on: workflow_dispatch

  cycle refine {
    max_iters = 10
    key = "refinement-${github.run_id}"

    until guard_js """
      return state.quality_score > 0.95;
    """

    body {
      job analyze {
        runs_on: ubuntu-latest
        steps: [
          run("analyze-code.sh")
        ]
        emits analysis: json
      }

      agent_job improve {
        consumes analysis from analyze.analysis

        agent_task "improver" {
          model = "opus"
          prompt = template("Improve based on: {{analysis}}")
          output_artifact = "improvements"
        }
      }

      job evaluate {
        consumes improvements from improve.improvements
        steps: [
          run("evaluate-quality.sh")
        ]
        outputs {
          quality_score: float = steps.eval.outputs.score
        }
      }
    }
  }

  job finalize after refine {
    steps: [
      run("finalize.sh")
    ]
  }
}
```

### AST Types

```typescript
// packages/compiler/src/ast/types.ts

export interface CycleNode {
  readonly kind: "cycle";
  readonly name: string;
  readonly maxIters: number | null;
  readonly key: string | null;
  readonly until: GuardJsNode | null;
  readonly body: CycleBodyNode;
  readonly span: Span;
}

export interface CycleBodyNode {
  readonly kind: "cycle_body";
  readonly jobs: readonly AnyJobNode[];
  readonly span: Span;
}

export interface GuardJsNode {
  readonly kind: "guard_js";
  readonly code: string;
  readonly span: Span;
}

// Update AnyJobNode union
export type AnyJobNode = JobNode | AgentJobNode;

// Add cycle to workflow
export interface WorkflowNode {
  readonly kind: "workflow";
  readonly name: string;
  readonly trigger: TriggerNode | null;
  readonly jobs: readonly AnyJobNode[];
  readonly cycles: readonly CycleNode[];  // NEW
  readonly span: Span;
}
```

### Grammar Extensions

```lezer
CycleDecl {
  kw<"cycle"> Identifier "{" CycleBody "}"
}

CycleBody {
  CycleProperty*
  BodyBlock?
}

CycleProperty {
  MaxItersProperty |
  KeyProperty |
  UntilProperty
}

MaxItersProperty {
  kw<"max_iters"> "=" Number
}

KeyProperty {
  kw<"key"> "=" String
}

UntilProperty {
  kw<"until"> GuardJs
}

GuardJs {
  kw<"guard_js"> TripleQuotedString
}

BodyBlock {
  kw<"body"> "{" (JobDecl | AgentJobDecl)* "}"
}
```

### Validation Rules

1. **Safety rail**: Every cycle must have `max_iters` OR `until` (or both)
2. **Key uniqueness**: `key` should be unique per workflow run (use expressions)
3. **Body not empty**: Cycle body must contain at least one job

## Dependencies

- WI-026: Agent task syntax (complete) - agent jobs can be in cycle body
- WI-005: AST transformation (complete) - pattern to follow
- WI-004: Lezer grammar (complete) - extend existing grammar

## Implementation Notes

This work item covers **syntax and AST only**. The actual lowering to phased workflow runs (generating the dispatch jobs, state artifacts, etc.) will be handled in subsequent work items:

- WI-031: Build SCC detection for cycle analysis
- WI-032: Generate cycle_hydrate job (state download)
- WI-033: Generate cycle_body jobs from body block
- WI-034: Generate cycle_decide job (continue logic)
- WI-035: Generate cycle_dispatch job (workflow_dispatch API call)
- WI-036: Enforce max_iterations and termination
- WI-037: Generate concurrency groups for cycle key

## Testing

```typescript
describe("cycle grammar", () => {
  it("parses cycle with max_iters", () => {
    const input = `
      workflow test {
        on: push
        cycle loop {
          max_iters = 5
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `;
    expect(hasErrors(parse(input))).toBe(false);
  });

  it("parses cycle with until guard", () => {
    const input = `
      workflow test {
        on: push
        cycle loop {
          max_iters = 10
          until guard_js """return state.done;"""
          body {
            job step1 { runs_on: ubuntu-latest steps: [] }
          }
        }
      }
    `;
    expect(hasErrors(parse(input))).toBe(false);
  });
});

describe("cycle AST", () => {
  it("builds CycleNode from parse tree", () => {
    const ast = buildAST(cycleSource);
    expect(ast[0].cycles).toHaveLength(1);
    expect(ast[0].cycles[0].maxIters).toBe(5);
  });
});
```

## References

- PROJECT.md Section 10: Cycles (Strategy B)
- GitHub Actions workflow_dispatch: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch
- Cross-run artifact downloads: https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/
