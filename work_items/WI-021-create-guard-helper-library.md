# WI-021: Create Guard Helper Library

**ID**: WI-021
**Status**: Completed
**Priority**: P3-Low
**Milestone**: C (Guards + Advanced Triggers)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Create a `@workpipe/guard-helpers` library that provides ergonomic helper functions for use within `guard_js` blocks. Currently, guard_js blocks require users to write raw JavaScript to access GitHub context, parse event data, and perform common conditional checks. This library will provide a pre-built set of utilities to make guard authoring easier and more maintainable.

### Current State

Guard_js blocks currently compile to inline Node.js scripts with a minimal context object:

```javascript
const context = {
  event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
  ref: process.env.GITHUB_REF,
  inputs: JSON.parse(process.env.INPUTS || '{}')
};
```

Users must write raw JavaScript to perform common checks like:
- Checking if specific labels are present
- Checking PR state (draft, merged, approved)
- Checking branch patterns
- Checking file paths changed
- Comparing versions/iterations

### Goal

Provide a helper library that can be injected or bundled into guard_js evaluations, offering ergonomic APIs like:

```javascript
// Instead of:
const labels = context.event.issue?.labels || [];
const hasPriority = labels.some(l => l.name === 'priority');

// Users could write:
return guards.hasLabel('priority');
```

## Acceptance Criteria

### Core Implementation
- [ ] Create `packages/guard-helpers/` package with TypeScript source
- [ ] Implement context access helpers:
  - [ ] `guards.event` - typed access to event payload
  - [ ] `guards.ref` - current ref string
  - [ ] `guards.inputs` - workflow_dispatch inputs
  - [ ] `guards.actor` - triggering user
- [ ] Implement label helpers:
  - [ ] `guards.hasLabel(name: string): boolean`
  - [ ] `guards.hasAnyLabel(names: string[]): boolean`
  - [ ] `guards.hasAllLabels(names: string[]): boolean`
  - [ ] `guards.getLabels(): string[]`
- [ ] Implement branch/ref helpers:
  - [ ] `guards.isBranch(pattern: string | RegExp): boolean`
  - [ ] `guards.isTag(pattern?: string | RegExp): boolean`
  - [ ] `guards.isDefaultBranch(): boolean`
  - [ ] `guards.isPullRequest(): boolean`
- [ ] Implement PR helpers:
  - [ ] `guards.isDraft(): boolean`
  - [ ] `guards.isApproved(): boolean` (if review events available)
  - [ ] `guards.getPRNumber(): number | null`
  - [ ] `guards.getBaseBranch(): string | null`
- [ ] Implement iteration/cycle helpers:
  - [ ] `guards.iteration`: current iteration number (for cycles)
  - [ ] `guards.state`: access to cycle state artifact
  - [ ] `guards.isFirstIteration(): boolean`
  - [ ] `guards.isMaxIteration(max: number): boolean`

### Integration with Compiler
- [ ] Update `transform.ts` to inject helper library into guard_js scripts
- [ ] Option A: Inline the helper code into the generated script
- [ ] Option B: Reference npm package (requires users to install)
- [ ] Decide on bundling strategy based on GitHub Actions constraints

### Testing
- [ ] Unit tests for each helper function
- [ ] Integration tests with guard_js compilation
- [ ] Golden test updates for examples using helpers

### Documentation
- [ ] Update `docs/language-reference.md` with guard helpers section
- [ ] Add example showing helper usage
- [ ] Document the `guards` object API

## Technical Context

### Relevant Files
- `packages/compiler/src/codegen/transform.ts` - Contains `transformGuardJsStep()` function (lines 228-256)
- `examples/guard-job/guard-job.workpipe` - Example of raw guard_js usage
- `examples/cycle-basic/cycle-basic.workpipe` - Example of guard_js in cycle context

### Current guard_js Compilation (from transform.ts)
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
fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + result + '\\n');`;
  // ...
}
```

### Design Considerations
1. **Bundling Strategy**: The helper library needs to be available at runtime in GitHub Actions. Options:
   - Inline the minified helper code into each guard_js script (larger output but self-contained)
   - Require users to have `@workpipe/guard-helpers` installed (smaller output but dependency requirement)
   - Use a CDN-hosted bundle (network dependency during workflow runs)

2. **Type Safety**: TypeScript types for GitHub event payloads (can leverage @octokit/webhooks-types)

3. **Backward Compatibility**: Existing guard_js blocks that access `context` directly must continue to work

4. **Cycle State Access**: For cycles, the `guards.state` helper needs to parse the downloaded artifact

## Dependencies

- WI-019: Implement guard_js compilation (COMPLETE)
- WI-020: Generate guard job outputs with GITHUB_OUTPUT (COMPLETE)

## Downstream Items

None - this is an enhancement work item

## Notes

- This is a P3-Low priority enhancement item
- Consider whether the library should be optional or automatically injected
- The `guards` namespace avoids collision with user-defined variables
- May want to consider tree-shaking for the inline bundling approach
