# ADR-0013: Step Syntax Improvements for Shell Commands

**Date**: 2025-12-31
**Status**: Accepted
**Deciders**: Project Team

## Context

Users find it cumbersome to write shell code in string syntax within job steps, even with triple-quoted strings. The current syntax requires:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run("pnpm install"),
    run("""
      echo "Building..."
      pnpm build
      pnpm test
    """)
  ]
}
```

This approach has several pain points:

1. **Quotation overhead**: Every shell command must be wrapped in `run("...")` or `run("""...""")`
2. **Escaping complexity**: Embedded quotes in shell commands require escaping or switching to triple-quotes
3. **Visual noise**: The `run("` and `")` delimiters obscure the actual shell content
4. **Multi-line friction**: Triple-quoted strings work but feel heavyweight for simple multi-command sequences
5. **Muscle memory clash**: Developers expect to write shell commands directly, not as string arguments

The current grammar (see `packages/lang/src/workpipe.grammar`) defines steps as:

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
```

This decision explores syntax alternatives that reduce friction while maintaining:
- Backward compatibility with existing `run()`, `uses()` syntax
- Compatibility with the Lezer parser architecture (ADR-0003)
- Clear distinction between shell commands and action steps
- Good error recovery for editor tooling
- Reasonable VS Code syntax highlighting support

## Decision

We adopt **block-based step syntax** using the `shell` keyword for shell commands, with the following approved design choices:

### Final Syntax

```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell {
      pnpm install
      pnpm build
      pnpm test
    }

    shell { echo "Single line works too" }

    uses("actions/checkout@v4") {
      with: { ref: "main" }
    }
  }
}
```

### Approved Design Choices

1. **Keyword: `shell` (not `run`)**
   - The `shell` keyword explicitly signals that the block contains shell code
   - This is clearer than overloading `run` with two different syntaxes
   - Opens the path for future variants like `powershell {}`, `python {}` if needed
   - The existing `run("...")` function syntax remains available for backward compatibility

2. **Brace Nesting: Count braces in compiler**
   - The compiler counts `{` and `}` characters to determine block boundaries
   - Nested braces in shell code are handled transparently (no escaping needed)
   - Example: `shell { if [ -f file ]; then { echo "found"; } fi }` works correctly
   - The tokenizer tracks brace depth and only closes the block when depth returns to zero

3. **Indentation: Strip common prefix**
   - Leading whitespace common to all lines is automatically stripped when writing to YAML
   - This matches user expectations and produces clean workflow output
   - Example:
     ```workpipe
     shell {
       pnpm install
       pnpm build
     }
     ```
     Generates `run: |` with properly dedented content

4. **Single-line syntax: Supported**
   - `shell { echo hello }` is valid for simple one-command steps
   - Both single-line and multi-line forms use the same parsing logic

5. **`uses()` block extension: Supported**
   - The `uses()` step also gains a block form for cleaner configuration:
     ```workpipe
     uses("actions/checkout@v4") {
       with: { ref: "main" }
     }
     ```
   - This provides consistency across step types

### Grammar Changes

```
Step {
  RunStep |
  ShellBlockStep |  // New
  UsesStep |
  UsesBlockStep |   // New
  AgentTaskStep |
  GuardJsStep
}

ShellBlockStep {
  kw<"shell"> ShellBlock
}

ShellBlock {
  "{" shellBlockContent "}"
}

UsesBlockStep {
  kw<"uses"> "(" String ")" UsesConfigBlock
}

UsesConfigBlock {
  "{" ObjectContent "}"
}
```

The `shellBlockContent` is a special token that captures everything between `{` and `}` verbatim, using brace-counting to handle nested braces.

### Implementation Notes: Brace Counting Algorithm

The tokenizer implements brace counting as follows:

```
1. When `shell` keyword is followed by `{`:
   - Initialize braceDepth = 1
   - Begin capturing content

2. For each subsequent character:
   - If `{`: braceDepth++
   - If `}`: braceDepth--
   - If braceDepth == 0: end capture, emit shellBlockContent token
   - Otherwise: append to content buffer

3. Edge cases:
   - Braces inside strings/comments in shell code are still counted
     (this is acceptable; balanced braces in shell are standard practice)
   - Unbalanced braces will cause a parse error with clear diagnostic
```

This approach is similar to how `guard_js` handles JavaScript content blocks (see ADR-0007).

### Indentation Stripping Algorithm

When compiling to YAML:

```
1. Split shellBlockContent into lines
2. Filter out empty lines for indent calculation
3. Find minimum leading whitespace across non-empty lines
4. Strip that common prefix from all lines
5. Emit as YAML literal block scalar (|)
```

### Backward Compatibility

- **`run("...")` syntax**: Remains fully supported and unchanged
- **`uses("action")` function syntax**: Remains fully supported
- **Migration**: Optional; existing files continue to work
- **Deprecation path**:
  - Phase 1: Both syntaxes coexist (current decision)
  - Phase 2 (future): Consider soft deprecation warnings for `run("""...""")` multi-line form
  - Phase 3 (future): Evaluate full deprecation based on adoption

### VS Code Highlighting

TextMate patterns for embedded shell highlighting:

```json
{
  "name": "meta.step.shell.block.workpipe",
  "begin": "\\bshell\\s*\\{",
  "end": "\\}",
  "contentName": "source.shell.embedded.workpipe",
  "patterns": [{ "include": "source.shell" }]
}
```

## Alternatives Considered

### Option 2: Indentation-Based Syntax

```workpipe
steps:
  run:
    pnpm install
    pnpm build
```

**Rejected** because:
- Lezer is not designed for significant-whitespace grammars
- Error recovery degrades significantly
- Copy-paste hazards (tabs vs spaces)
- Conflicts with ADR-0003's choice of Lezer for brace-delimited recovery

### Option 3: Heredoc-Style Syntax

```workpipe
run <<EOF
  pnpm install
EOF
```

**Not selected** because:
- More verbose (delimiter typed twice)
- Awkward inside array syntax
- Less familiar to non-shell users
- Dynamic delimiter tracking adds tokenizer complexity

### Option 4: `run` Block Overloading

Using `run { }` instead of `shell { }`.

**Not selected** because:
- `shell` is more explicit about content type
- Avoids confusion between `run("...")` and `run { }`
- Opens path for future `powershell {}`, `python {}` variants
- Clear semantic distinction aids documentation and learning

### Option 5: Improve Current Syntax Only

Add raw strings, better triple-quote handling, enhanced VS Code support.

**Not selected as primary approach** because:
- Doesn't address core friction of quotation overhead
- Still requires `run("...")` wrapper for every command
- Missed opportunity for cleaner syntax that other DSLs provide

## Consequences

### Positive

- Significant reduction in syntactic noise for shell-heavy workflows
- Better developer experience for writing and reading shell commands
- Alignment with modern infrastructure DSL conventions (Terraform, Pulumi)
- Opens path for future block-based constructs
- Clean handling of nested braces without escaping
- Automatic indentation handling produces clean YAML output

### Negative

- Grammar complexity increases (verbatim content tokenization with brace counting)
- Two ways to write shell commands (learning curve, style guide needed)
- Brace counting may produce confusing errors for severely unbalanced shell scripts
- VS Code extension needs update for embedded shell highlighting

### Neutral

- Existing files continue to work unchanged
- Documentation will need examples of both styles
- Style guide recommendation: prefer `shell {}` for new code, `run("...")` acceptable for single simple commands

## References

- [ADR-0003: Lezer Grammar Design and Expression Language](0003-lezer-grammar-design-and-expression-language.md) - Establishes Lezer parser and keyword reservation strategy
- [ADR-0007: Cycle Syntax and Guard Block Design](0007-cycle-syntax-and-guard-block-design.md) - Precedent for `guard_js` verbatim block handling
- `packages/lang/src/workpipe.grammar` - Current grammar definition
- `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json` - TextMate grammar for highlighting
- [Terraform Heredoc Strings](https://developer.hashicorp.com/terraform/language/expressions/strings#heredoc-strings) - Prior art
- [Lezer Grammar Reference](https://lezer.codemirror.net/docs/ref/#lr.grammar) - Parser generator documentation
