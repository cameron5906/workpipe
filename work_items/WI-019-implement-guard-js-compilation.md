# WI-019: Implement guard_js Compilation (General Guards)

**ID**: WI-019
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: C (Guards + advanced triggers)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement compilation of `guard_js` blocks as standalone guard jobs (outside of cycles). This extends the existing cycle guard_js pattern to support general-purpose conditional workflow execution.

Per PROJECT.md Section 7.2:
> A `guard_js """..."""` block compiles into:
> - a small script step (Node) that receives event payload, ref/branch metadata, inputs
> - writes `result=true/false` to `$GITHUB_OUTPUT`
> - downstream jobs use `if: needs.guard.outputs.should_run == 'true'`

This enables complex conditional logic that cannot be expressed in native GitHub Actions YAML, such as:
- "only run on issue label X"
- "only run if files under /docs changed"
- "only run if PR author is in allowlist"

## Acceptance Criteria

- [x] **Grammar**: Extend grammar to allow `guard_js` blocks in job steps (GuardJsStep added)
- [x] **AST**: Add support for `guard_js` as a step type within regular jobs (GuardJsStepNode)
- [x] **Codegen**: Transform `guard_js` step into Node.js script that:
  - Receives `github` context (event payload, ref, inputs)
  - Executes the guard code
  - Writes result (`true`/`false`) to `$GITHUB_OUTPUT`
- [x] **Job outputs**: Guard job automatically gets `result: bool` output
- [x] **Downstream wiring**: Jobs with `when guard.outputs.result` compile to `if: needs.guard.outputs.result == 'true'`
- [x] **Tests**: Unit tests for guard job codegen (10 new test cases, 303 tests total in compiler)
- [x] **Golden test**: Add `examples/guard-job/` with guard example and expected YAML
- [x] **Documentation**: Update `docs/language-reference.md` with guard job syntax

## Deliverables Summary

- **Grammar**: Extended `packages/lang/src/workpipe.grammar` with GuardJsStep production
- **AST**: Added GuardJsStepNode to `packages/compiler/src/ast/types.ts`
- **Codegen**: Implemented guard_js to Node.js script transformation in `packages/compiler/src/codegen/transform.ts`
- **Example**: Created `examples/guard-job/` with working example and expected YAML
- **Tests**: 10 new test cases added (303 tests total in compiler package)

## Technical Context

### Existing Implementation to Reuse

The cycle `guard_js` implementation in `packages/compiler/src/codegen/transform.ts` provides the template:

```typescript
// From createDecideJob():
const guardScript = `
const fs = require('fs');
let state = {};
if (fs.existsSync('.cycle-state/state.json')) {
  state = JSON.parse(fs.readFileSync('.cycle-state/state.json', 'utf8'));
}
const phase = parseInt(process.env.PHASE || '0', 10);
const maxIters = ${maxIters ?? "null"};
const context = { ...state, ${keyName}: phase };
const guardResult = (function() { ${guardCode} })();
...
`;
```

For general guards, the pattern simplifies to:
1. No cycle state file needed
2. Context comes from `github.*` environment variables
3. Output is a single boolean result

### Proposed Syntax

```workpipe
job guard {
  runs_on: ubuntu-latest
  step "decide" guard_js """
    // context includes github.event, github.ref, inputs
    return context.event.issue?.labels?.some(l => l.name === 'priority');
  """
  outputs {
    should_run: bool = steps.decide.result
  }
}

job process when guard.outputs.should_run {
  runs_on: ubuntu-latest
  needs: [guard]
  steps: [
    run("./process.sh")
  ]
}
```

### Generated YAML Pattern

```yaml
jobs:
  guard:
    runs-on: ubuntu-latest
    outputs:
      should_run: ${{ steps.decide.outputs.result }}
    steps:
      - name: Evaluate guard
        id: decide
        run: |
          node -e "
            const context = {
              event: JSON.parse(process.env.GITHUB_EVENT_PATH ? require('fs').readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8') : '{}'),
              ref: process.env.GITHUB_REF,
              // ... other context
            };
            const result = (function() { return context.event.issue?.labels?.some(l => l.name === 'priority'); })();
            const fs = require('fs');
            fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + (result ? 'true' : 'false') + '\\n');
          "
        shell: bash

  process:
    runs-on: ubuntu-latest
    needs: [guard]
    if: needs.guard.outputs.should_run == 'true'
    steps:
      - run: ./process.sh
```

### Key Files to Modify

1. `packages/lang/src/workpipe.grammar` - Add guard_js step syntax
2. `packages/compiler/src/ast/types.ts` - Add GuardJsStepNode
3. `packages/compiler/src/ast/builder.ts` - Parse guard_js steps
4. `packages/compiler/src/codegen/transform.ts` - Transform guard_js to ScriptStepIR
5. `packages/compiler/src/codegen/emit.ts` - Emit guard script

### Related Design Documents

- **PROJECT.md Section 7**: Triggers + Guards specification
- **ADR-0007**: Cycle Syntax and Guard Block Design (guard_js as opaque string)
- **ADR-0003**: Lezer Grammar Design (triple-quoted string handling)

## Dependencies

- None (builds on existing guard_js infrastructure from cycle implementation)

## Notes

- Reuse the triple-quoted string tokenization from cycle guard_js
- The guard code is executed at GitHub Actions runtime, not compile time
- Consider whether to provide a `@workpipe/guard-helpers` library (WI-021) later
- Error handling: runtime JS errors will surface in GitHub Actions logs
