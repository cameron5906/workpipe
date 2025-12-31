# Implement CST to AST Transformation

**ID**: WI-005
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: A (Vertical slice)
**Phase**: 1 (Parser + AST + Formatter)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Transform the Lezer Concrete Syntax Tree (CST) into a typed Abstract Syntax Tree (AST) that represents the semantic structure of WorkPipe programs. The AST is the primary data structure used by all subsequent compiler phases (validation, code generation).

The Lezer parser produces a lightweight tree optimized for incremental parsing and editor use. We need to transform this into a richer AST with:
- Strongly-typed TypeScript interfaces for each node type
- Source location information (spans) for error reporting
- A structure that's convenient for semantic analysis and code generation

## Acceptance Criteria

- [x] AST node types defined in `packages/compiler/src/ast/types.ts`
- [x] AST builder function in `packages/compiler/src/ast/builder.ts`
- [x] Core AST node types implemented:
  - [x] `WorkflowNode` - top-level workflow definition
  - [x] `TriggerNode` - on clause with event types
  - [x] `JobNode` - job definition with properties
  - [x] `StepNode` - run or uses step
  - [x] `ExpressionNode` - expressions (comparison, property access, literals)
- [x] Each AST node includes source span (`{ start: number, end: number }`)
- [x] Builder handles all grammar productions from the Lezer parser
- [x] AST exported from `@workpipe/compiler` package
- [x] Unit tests for AST building covering both fixtures
- [x] Error handling for malformed CST (graceful degradation)

## Technical Context

### From PROJECT.md

Section 11.1 (Compiler pipeline):
> 1. **Parse** (`Lezer`): spec text -> concrete syntax tree (CST)
> 2. **AST build**: CST -> typed AST nodes with spans

Section 12 (Error model):
> WorkPipe errors must include:
> - file, line, column span
> - error code (stable)
> - short message + "what you probably meant"

### Lezer Grammar Node Types (from WI-004)

The Lezer parser produces these node types that need AST mappings:

```
Workflow          -> WorkflowNode
WorkflowDecl      -> WorkflowNode
WorkflowBody      -> (properties of WorkflowNode)
OnClause          -> triggers: TriggerNode[]
TriggerSpec       -> TriggerNode
EventName         -> string (event type)
JobDecl           -> JobNode
JobBody           -> (properties of JobNode)
RunsOnProperty    -> runsOn: string
NeedsProperty     -> needs: string[]
IfProperty        -> condition: ExpressionNode
StepsProperty     -> steps: StepNode[]
Step              -> StepNode
RunStep           -> StepNode { type: 'run', command: string }
UsesStep          -> StepNode { type: 'uses', action: string }
Expression        -> ExpressionNode
ComparisonExpr    -> BinaryExpressionNode
PropertyAccess    -> PropertyAccessNode
String            -> StringLiteralNode
Boolean           -> BooleanLiteralNode
Identifier        -> string
```

### Recommended AST Type Definitions

```typescript
// packages/compiler/src/ast/types.ts

export interface SourceSpan {
  start: number;
  end: number;
}

export interface BaseNode {
  span: SourceSpan;
}

export interface WorkflowNode extends BaseNode {
  type: 'workflow';
  name: string;
  triggers: TriggerNode[];
  jobs: JobNode[];
}

export interface TriggerNode extends BaseNode {
  type: 'trigger';
  events: string[];
}

export interface JobNode extends BaseNode {
  type: 'job';
  name: string;
  runsOn: string;
  needs: string[];
  condition: ExpressionNode | null;
  steps: StepNode[];
}

export type StepNode = RunStepNode | UsesStepNode;

export interface RunStepNode extends BaseNode {
  type: 'run';
  command: string;
}

export interface UsesStepNode extends BaseNode {
  type: 'uses';
  action: string;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | PropertyAccessNode
  | StringLiteralNode
  | BooleanLiteralNode;

export interface BinaryExpressionNode extends BaseNode {
  type: 'binary';
  operator: '==' | '!=';
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface PropertyAccessNode extends BaseNode {
  type: 'property_access';
  path: string[];  // e.g., ['github', 'ref']
}

export interface StringLiteralNode extends BaseNode {
  type: 'string';
  value: string;
}

export interface BooleanLiteralNode extends BaseNode {
  type: 'boolean';
  value: boolean;
}
```

### Using the Lezer Parser

The `@workpipe/lang` package exports:
- `parser` - the LRParser instance
- `parse(source: string): Tree` - parse source to tree
- Term constants for node type identification

```typescript
import { parse } from '@workpipe/lang';
import type { Tree, TreeCursor } from '@lezer/common';

function buildAST(source: string): WorkflowNode[] {
  const tree = parse(source);
  const cursor = tree.cursor();

  // Walk the tree and build AST nodes
  // cursor.name gives the node type name
  // cursor.from / cursor.to give the span
  // cursor.firstChild() / cursor.nextSibling() / cursor.parent() for navigation
}
```

### AST Builder Pattern

Recommend a visitor-style builder:

```typescript
// packages/compiler/src/ast/builder.ts

import { parse } from '@workpipe/lang';
import type { TreeCursor } from '@lezer/common';
import type { WorkflowNode, ... } from './types';

export function buildAST(source: string): WorkflowNode[] {
  const tree = parse(source);
  const cursor = tree.cursor();
  const workflows: WorkflowNode[] = [];

  // Top level is 'Workflow' node containing WorkflowDecl children
  if (cursor.firstChild()) {
    do {
      if (cursor.name === 'WorkflowDecl') {
        workflows.push(buildWorkflow(cursor, source));
      }
    } while (cursor.nextSibling());
  }

  return workflows;
}

function buildWorkflow(cursor: TreeCursor, source: string): WorkflowNode {
  // ... extract name, triggers, jobs from children
}
```

## Dependencies

- WI-004: Lezer grammar (complete) - provides the parser and CST
- WI-001: Monorepo structure (complete)

## Notes

- The AST should be immutable after construction (use `readonly` where appropriate)
- Include span information on every node for error reporting
- Handle missing/optional nodes gracefully (e.g., job with no `needs`)
- Consider a `visit()` utility function for traversing the AST
- The AST builder should not validate semantics - that's a separate phase
- Test with both valid and malformed input (parser with errors)
- Export AST types so CLI and other packages can use them
- Consider whether to preserve comments in the AST (probably not for v1)

## Example Expected Output

For the minimal fixture:
```workpipe
workflow minimal {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo Hello, WorkPipe!")
    ]
  }
}
```

The AST should be:
```typescript
{
  type: 'workflow',
  name: 'minimal',
  span: { start: 0, end: 143 },
  triggers: [{
    type: 'trigger',
    events: ['push'],
    span: { start: 22, end: 30 }
  }],
  jobs: [{
    type: 'job',
    name: 'hello',
    runsOn: 'ubuntu-latest',
    needs: [],
    condition: null,
    steps: [{
      type: 'run',
      command: 'echo Hello, WorkPipe!',
      span: { start: 93, end: 123 }
    }],
    span: { start: 34, end: 141 }
  }]
}
```

## References

- Lezer Tree API: https://lezer.codemirror.net/docs/ref/#common.Tree
- Lezer TreeCursor: https://lezer.codemirror.net/docs/ref/#common.TreeCursor
