# WI-092: AST and Parser Updates for Step Syntax

**ID**: WI-092
**Status**: Backlog
**Priority**: P1-High
**Milestone**: Step Syntax Improvements (ADR-0013)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Update AST node types and the CST-to-AST builder to handle the new step syntax from ADR-0013 (ACCEPTED). This includes:

1. New AST nodes for `ShellStep` and `UsesBlockStep`
2. AST builder logic to process new CST nodes
3. Handling single-line vs multi-line shell blocks
4. Preserving source spans for diagnostics

### New Syntax Supported

```workpipe
steps {
  shell {
    pnpm install
    pnpm build
  }

  shell { echo "Single line" }

  uses("actions/checkout@v4") {
    with: { ref: "main" }
  }
}
```

## Acceptance Criteria

### AST Node Types

- [ ] Add `ShellStepNode` type with `content: string` and `span: SourceSpan`
- [ ] Add `UsesBlockStepNode` type with `action: string`, `with?: ObjectLiteral`, and `span: SourceSpan`
- [ ] Update `StepNode` union to include new step types
- [ ] Update `JobNode.steps` to accept both array and block-style steps

### AST Builder

- [ ] Implement `buildShellStep()` to extract shell content from `ShellBlock` CST node
- [ ] Implement `buildUsesBlockStep()` to extract action and with-properties
- [ ] Implement `buildStepsBlock()` to handle `StepsBlock` CST node
- [ ] Handle both `steps:` property (array) and `steps { }` block syntax
- [ ] Preserve exact source positions for all new node types

### Content Handling

- [ ] Single-line shell blocks: `shell { echo hello }` - content is `echo hello`
- [ ] Multi-line shell blocks: content is everything between `{` and `}`
- [ ] Leading/trailing whitespace preserved in AST (stripping happens in codegen)
- [ ] Nested braces inside shell content are correctly captured

### Tests

- [ ] AST builder tests for `ShellStepNode` construction
- [ ] AST builder tests for `UsesBlockStepNode` construction
- [ ] AST builder tests for `StepsBlock` containing mixed step types
- [ ] AST builder tests for single-line vs multi-line shell
- [ ] Source span tests for new node types
- [ ] Error recovery tests for partial AST on malformed input

## Technical Context

### Current AST Types (from packages/compiler/src/ast/types.ts)

```typescript
export type StepNode =
  | RunStepNode
  | UsesStepNode
  | AgentTaskStepNode
  | GuardJsStepNode;

export interface RunStepNode {
  type: "run";
  command: string;
  span: SourceSpan;
}

export interface UsesStepNode {
  type: "uses";
  action: string;
  with?: Record<string, unknown>;
  span: SourceSpan;
}
```

### Proposed AST Additions

```typescript
export type StepNode =
  | RunStepNode
  | ShellStepNode       // New
  | UsesStepNode
  | UsesBlockStepNode   // New
  | AgentTaskStepNode
  | GuardJsStepNode;

export interface ShellStepNode {
  type: "shell";
  content: string;  // Raw content from shell block (whitespace preserved)
  multiline: boolean;  // True if block spans multiple lines
  span: SourceSpan;
}

export interface UsesBlockStepNode {
  type: "uses_block";
  action: string;
  with?: Record<string, unknown>;
  span: SourceSpan;
}
```

### AST Builder Changes

The builder will need to handle the new CST node types:

```typescript
// In packages/compiler/src/ast/builder.ts

function buildStep(cursor: TreeCursor, source: string): StepNode | null {
  const nodeType = cursor.name;

  switch (nodeType) {
    case "RunStep":
      return buildRunStep(cursor, source);
    case "ShellStep":          // New
      return buildShellStep(cursor, source);
    case "UsesStep":
      return buildUsesStep(cursor, source);
    case "UsesBlockStep":      // New
      return buildUsesBlockStep(cursor, source);
    case "AgentTaskStep":
      return buildAgentTaskStep(cursor, source);
    case "GuardJsStep":
      return buildGuardJsStep(cursor, source);
    default:
      return null;
  }
}

function buildShellStep(cursor: TreeCursor, source: string): ShellStepNode {
  const span = getSpan(cursor);
  cursor.firstChild(); // Enter ShellStep
  cursor.nextSibling(); // Skip 'shell' keyword
  cursor.nextSibling(); // Enter ShellBlock
  cursor.firstChild(); // Skip '{'
  cursor.nextSibling(); // shellContent

  const content = source.slice(cursor.from, cursor.to);
  const multiline = content.includes('\n');

  cursor.parent();
  cursor.parent();

  return { type: "shell", content, multiline, span };
}
```

### Related Files

- `packages/compiler/src/ast/types.ts` - AST type definitions
- `packages/compiler/src/ast/builder.ts` - CST-to-AST transformation
- `packages/compiler/src/__tests__/ast-builder.test.ts` - Builder tests

### Related ADRs

- ADR-0003: Lezer Grammar Design and Expression Language
- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- **WI-091**: Grammar - Steps Block and Shell Keyword (must complete first)

## Notes

This work item focuses ONLY on AST representation. The content is captured verbatim with whitespace preserved. Indentation stripping and YAML generation happen in WI-093 (Codegen).

The `multiline` flag on `ShellStepNode` helps codegen decide formatting, but the content itself is not modified at the AST level.
