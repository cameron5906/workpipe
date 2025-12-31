# Implement YAML IR and Emitter

**ID**: WI-008
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A (Vertical slice)
**Phase**: 2 (Minimal Workflow Codegen)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Implement the YAML Intermediate Representation (IR) and emitter that transforms WorkPipe AST into GitHub Actions workflow YAML. This is the core code generation infrastructure that produces the final output.

The emitter must produce:
- Deterministic, stable YAML output (same input always produces identical output)
- Valid GitHub Actions workflow syntax
- Human-readable formatting with consistent indentation

## Acceptance Criteria

- [x] YAML IR types defined in `packages/compiler/src/codegen/yaml-ir.ts`
- [x] AST-to-IR transformer in `packages/compiler/src/codegen/transform.ts`
- [x] YAML emitter in `packages/compiler/src/codegen/emit.ts`
- [x] IR types for GitHub Actions structures:
  - [x] `WorkflowIR` - top-level workflow
  - [x] `TriggerIR` - on clause configuration
  - [x] `JobIR` - job definition
  - [x] `StepIR` - step (run or uses)
- [x] Emitter produces valid GitHub Actions YAML
- [x] Output is deterministic (stable key ordering, consistent formatting)
- [x] `compile()` function exported from `@workpipe/compiler`
- [x] Golden tests verify output matches expected YAML for both fixtures
- [x] Update `examples/minimal/expected.yml` and `examples/simple-job/expected.yml` with actual output

## Technical Context

### From PROJECT.md

Section 11.1 (Compiler pipeline):
> 7. **IR -> YAML**:
>    - deterministic ordering
>    - stable formatting

Section 11.2 (Implementation language):
> - YAML emitter (`yaml` package recommended for stable output; avoid "string templates")

### AST Node Types (from WI-005)

The AST nodes to transform:

```typescript
interface WorkflowNode {
  kind: "workflow";
  name: string;
  trigger: TriggerNode | null;
  jobs: readonly JobNode[];
}

interface TriggerNode {
  kind: "trigger";
  events: readonly string[];
}

interface JobNode {
  kind: "job";
  name: string;
  runsOn: string | null;
  needs: readonly string[];
  condition: ExpressionNode | null;
  steps: readonly StepNode[];
}

type StepNode = RunStepNode | UsesStepNode;

interface RunStepNode {
  kind: "run";
  command: string;
}

interface UsesStepNode {
  kind: "uses";
  action: string;
}
```

### Target GitHub Actions YAML Structure

For the minimal fixture, output should be:
```yaml
name: minimal

on: push

jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo Hello, WorkPipe!
```

For the simple-job fixture, output should be:
```yaml
name: simple_job

on:
  - push
  - pull_request

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs:
      - build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: npm run deploy
```

### YAML IR Design

The IR should mirror GitHub Actions structure:

```typescript
// packages/compiler/src/codegen/yaml-ir.ts

export interface WorkflowIR {
  name: string;
  on: TriggerIR;
  jobs: Record<string, JobIR>;
}

export type TriggerIR = string | string[] | Record<string, TriggerConfigIR>;

export interface TriggerConfigIR {
  // For complex triggers like workflow_dispatch with inputs
  // Will be expanded in later phases
}

export interface JobIR {
  "runs-on": string;
  needs?: string[];
  if?: string;
  steps: StepIR[];
}

export type StepIR = RunStepIR | UsesStepIR;

export interface RunStepIR {
  run: string;
  name?: string;
}

export interface UsesStepIR {
  uses: string;
  with?: Record<string, string>;
}
```

### Expression to String Conversion

The `if` condition needs to convert expressions to GitHub Actions expression syntax:

```typescript
function expressionToString(expr: ExpressionNode): string {
  switch (expr.kind) {
    case "binary":
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    case "property":
      return expr.path.join(".");
    case "string":
      return `'${expr.value}'`;
    case "boolean":
      return expr.value.toString();
  }
}
```

### Using the `yaml` Package

```typescript
import { stringify } from "yaml";

const ir: WorkflowIR = { ... };
const yamlOutput = stringify(ir, {
  lineWidth: 0,  // Don't wrap lines
  defaultKeyType: "PLAIN",
  defaultStringType: "QUOTE_DOUBLE",
});
```

### Compiler Entry Point

```typescript
// packages/compiler/src/codegen/index.ts

import { buildAST } from "../ast";
import { transform } from "./transform";
import { emit } from "./emit";

export function compile(source: string): string {
  const workflows = buildAST(source);
  if (workflows.length === 0) {
    throw new Error("No workflow found in source");
  }

  // For now, compile first workflow only
  const ir = transform(workflows[0]);
  return emit(ir);
}
```

## Dependencies

- WI-005: CST to AST transformation (complete) - provides AST
- WI-003: Testing infrastructure (complete) - provides golden test framework

## Notes

- Use the `yaml` package for serialization (already in design doc recommendations)
- Key ordering in YAML matters for readability: `name`, `on`, `jobs` should be in that order
- Job keys should appear in definition order from the source
- Single-event triggers should use scalar form (`on: push`), multiple should use array
- The `if` field should NOT have `${{ }}` wrapper - GitHub Actions adds it automatically
- Consider creating a `compileFile()` wrapper that reads from disk (for CLI integration)
- Ensure step arrays maintain source order
- For this work item, focus on the two existing fixtures; complex features come later

## Testing

Use the golden test framework from WI-003:

```typescript
import { runGoldenTest } from "@workpipe/compiler/testing";

describe("codegen", () => {
  it("compiles minimal workflow", async () => {
    await runGoldenTest("minimal");
  });

  it("compiles simple-job workflow", async () => {
    await runGoldenTest("simple-job");
  });
});
```

Update the `expected.yml` files with the actual compiler output once working.

## References

- GitHub Actions workflow syntax: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
- yaml package: https://www.npmjs.com/package/yaml
