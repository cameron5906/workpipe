# WI-093: Codegen - Indentation Stripping for Shell Blocks

**ID**: WI-093
**Status**: Completed
**Priority**: P1-High
**Milestone**: Step Syntax Improvements (ADR-0013)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement code generation for the new step syntax from ADR-0013 (ACCEPTED). Key responsibilities:

1. **Strip common indentation prefix** from shell content when outputting to YAML
2. Generate proper YAML `run:` commands from `ShellStepNode`
3. Generate YAML for `UsesBlockStepNode` with `with:` parameters
4. Handle single-line vs multi-line shell blocks appropriately

### ADR-0013 Decision: Indentation Stripping

When a shell block is written with indentation:

```workpipe
steps {
  shell {
    pnpm install
    pnpm build
  }
}
```

The generated YAML should NOT include the common leading whitespace:

```yaml
- run: |
    pnpm install
    pnpm build
```

NOT:

```yaml
- run: |
        pnpm install
        pnpm build
```

## Acceptance Criteria

### Indentation Stripping

- [x] Implement `stripCommonIndent(content: string): string` utility function
- [x] Find minimum leading whitespace across all non-empty lines
- [x] Strip that common prefix from each line
- [x] Handle mixed tabs/spaces gracefully (treat tab as single character)
- [x] Preserve intentional relative indentation within shell content
- [x] Handle empty lines (don't count their "indentation")

### Shell Step Codegen

- [x] Transform `ShellStepNode` to `RunStepIR`
- [x] Single-line: Generate `run: echo hello` (no literal block)
- [x] Multi-line: Generate `run: |` with indented content
- [x] Apply indentation stripping before YAML emission

### Uses Block Step Codegen

- [x] Transform `UsesBlockStepNode` to `UsesStepIR`
- [x] Generate `uses:` with action reference
- [x] Generate `with:` section from block properties
- [x] Merge/validate with any inline parameters

### YAML Emission

- [x] Extend emitter to handle `ShellStepNode` appropriately
- [x] Ensure multi-line run blocks use YAML literal style (`|`)
- [x] Proper indentation in generated YAML (2-space or 4-space as configured)

### Tests

- [x] Unit tests for `stripCommonIndent()` function
- [x] Test: consistent indentation (all lines same prefix)
- [x] Test: varying indentation (nested code blocks)
- [x] Test: empty lines in shell content
- [x] Test: tabs vs spaces
- [x] Test: single-line shell blocks
- [x] Integration tests for full codegen pipeline
- [x] Golden tests for new syntax examples

## Technical Context

### stripCommonIndent Algorithm

```typescript
// packages/compiler/src/codegen/transform.ts

function stripCommonIndent(content: string): string {
  const lines = content.split('\n');

  // Filter to non-empty lines for indent calculation
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return content;
  }

  // Find minimum leading whitespace
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    })
  );

  // Strip common prefix from each line
  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim();
}
```

### Transform Logic

```typescript
// packages/compiler/src/codegen/transform.ts

function transformShellStep(step: ShellStepNode): RunStepIR {
  const strippedContent = stripCommonIndent(step.content);

  return {
    type: "run",
    run: strippedContent,
  };
}

function transformUsesBlockStep(step: UsesBlockStepNode): UsesStepIR {
  return {
    type: "uses",
    uses: step.action,
    with: step.with,
  };
}
```

### Example Transformations

**Input:**
```workpipe
steps {
  shell {
    echo "Building..."
    pnpm build
    if [ $? -eq 0 ]; then
      echo "Success"
    fi
  }
}
```

**After stripCommonIndent:**
```
echo "Building..."
pnpm build
if [ $? -eq 0 ]; then
  echo "Success"
fi
```

**Generated YAML:**
```yaml
steps:
  - run: |
      echo "Building..."
      pnpm build
      if [ $? -eq 0 ]; then
        echo "Success"
      fi
```

### Related Files

- `packages/compiler/src/codegen/transform.ts` - AST-to-IR transformation
- `packages/compiler/src/codegen/emit.ts` - YAML emission
- `packages/compiler/src/codegen/yaml-ir.ts` - IR type definitions
- `packages/compiler/src/__tests__/transform.test.ts` - Transform tests

### Related ADRs

- ADR-0004: YAML IR Design and Emission Strategy
- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- **WI-091**: Grammar - Steps Block and Shell Keyword
- **WI-092**: AST and Parser Updates (must complete first)

## Notes

The indentation stripping logic should be robust but simple. Edge cases to consider:

1. **All whitespace content**: Return empty string or preserve?
2. **Leading/trailing blank lines**: Trim them
3. **Windows line endings**: Handle `\r\n` consistently
4. **Mixed tabs and spaces**: Treat each character as one unit (don't expand tabs)

The existing `guard_js` handling may provide patterns to follow for verbatim content processing.
