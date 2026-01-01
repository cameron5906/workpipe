# WI-091: Grammar - Steps Block and Shell Keyword

**ID**: WI-091
**Status**: In Progress
**Priority**: P1-High
**Milestone**: Step Syntax Improvements (ADR-0013)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement grammar changes for the new step syntax as defined in ADR-0013 (ACCEPTED). This work item adds:

1. `steps { }` block syntax (removing array requirement)
2. `shell { }` keyword with brace-counting content capture
3. `uses() { }` block variant for action configuration
4. Backward compatibility with `run()` and `uses()` function syntax

### New Syntax Examples

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

### ADR-0013 Decisions

1. **Brace counting for nested `{ }`** - no escaping needed for shell content containing braces
2. **Keyword**: Use `shell` instead of overloading `run`
3. **Single-line support**: `shell { echo hello }` is valid
4. **Block format for `uses`**: Optional block syntax for action configuration

## Acceptance Criteria

### Grammar Extensions

- [ ] Add `StepsBlock` production: `kw<"steps"> "{" Step* "}"`
- [ ] Add `ShellStep` production: `kw<"shell"> ShellBlock`
- [ ] Add `ShellBlock` with brace-counting content capture
- [ ] Add `UsesBlockStep` production: `kw<"uses"> "(" String ")" UsesBlock?`
- [ ] Add `UsesBlock` production for `with:` configuration
- [ ] Reserve `shell` as keyword in grammar

### Brace Counting

- [ ] Implement brace-counting tokenizer for shell content
- [ ] Nested `{ }` pairs inside shell content are balanced and captured
- [ ] Single `}` that matches opening `shell {` terminates the block
- [ ] Test cases for various brace patterns in shell content

### Backward Compatibility

- [ ] Existing `steps: [ run("..."), uses("...") ]` syntax continues to work
- [ ] Both old array syntax and new block syntax can coexist
- [ ] Parser correctly distinguishes `steps:` array vs `steps { }` block

### Tests

- [ ] Grammar tests for `steps { }` block syntax
- [ ] Grammar tests for `shell { }` single-line
- [ ] Grammar tests for `shell { }` multi-line
- [ ] Grammar tests for `uses() { }` with block
- [ ] Grammar tests for mixed old/new syntax
- [ ] Grammar tests for brace-counting edge cases
- [ ] Error recovery tests for malformed blocks

## Technical Context

### Current Grammar (from packages/lang/src/workpipe.grammar)

```
Step {
  RunStep |
  UsesStep |
  AgentTaskStep |
  GuardJsStep
}

RunStep {
  kw<"run"> "(" String ")"
}

UsesStep {
  kw<"uses"> "(" String ")" ("," usesParams)?
}
```

### Proposed Grammar Additions

```
StepsProperty {
  kw<"steps"> ":" StepList |
  kw<"steps"> StepsBlock
}

StepsBlock {
  "{" Step* "}"
}

Step {
  RunStep |
  ShellStep |      // New
  UsesStep |
  UsesBlockStep |  // New
  AgentTaskStep |
  GuardJsStep
}

ShellStep {
  kw<"shell"> ShellBlock
}

ShellBlock {
  "{" shellContent "}"  // shellContent is brace-counted verbatim capture
}

UsesBlockStep {
  kw<"uses"> "(" String ")" UsesBlock?
}

UsesBlock {
  "{" UsesBlockProperties "}"
}

UsesBlockProperties {
  WithProperty?
}

WithProperty {
  kw<"with"> ":" ObjectLiteral
}
```

### Brace Counting Strategy

The `shellContent` token must:
1. Track brace depth starting at 1 (after opening `{`)
2. Increment depth on `{`, decrement on `}`
3. Terminate when depth reaches 0
4. Capture all content (including nested braces) verbatim

Reference implementation: Similar approach used in `guard_js` for JavaScript content capture (see ADR-0007).

### Lezer External Tokenizer

May require an external tokenizer for the brace-counting logic:

```typescript
// packages/lang/src/shell-content.ts
import { ExternalTokenizer } from "@lezer/lr";

export const shellContent = new ExternalTokenizer((input) => {
  let depth = 1;
  let start = input.pos;
  while (depth > 0 && input.next !== -1) {
    if (input.next === 123) { // {
      depth++;
    } else if (input.next === 125) { // }
      depth--;
      if (depth === 0) break;
    }
    input.advance();
  }
  if (input.pos > start) {
    input.acceptToken(ShellContent);
  }
});
```

### Related Files

- `packages/lang/src/workpipe.grammar` - Grammar definition
- `packages/lang/src/parser.ts` - Parser wrapper
- `packages/lang/src/__tests__/parser.test.ts` - Parser tests

### Related ADRs

- ADR-0003: Lezer Grammar Design and Expression Language
- ADR-0007: Cycle Syntax and Guard Block Design (precedent for verbatim blocks)
- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- None (this is the first work item in the ADR-0013 implementation)

## Notes

This work item focuses ONLY on grammar and parsing. AST representation is handled in WI-092, and code generation (including indentation stripping) is handled in WI-093.

The grammar must be designed to allow both old and new syntax to coexist. Users should be able to migrate incrementally.
