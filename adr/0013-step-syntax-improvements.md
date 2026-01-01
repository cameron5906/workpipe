# ADR-0013: Step Syntax Improvements for Shell Commands

**Date**: 2025-12-31
**Status**: Proposed
**Deciders**: Project Team (pending user review)

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

**This ADR is in "Proposed" status pending user review.** The architect recommends **Option 1: Block-based step syntax** as the primary approach, with the current function syntax retained for backward compatibility.

The following sections analyze five options for improving step syntax, with detailed pros/cons and implementation considerations.

---

## Option 1: Block-Based Step Syntax (Recommended)

Introduce a block-based syntax for shell commands, similar to Terraform heredoc blocks or Ruby blocks:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run {
      pnpm install
      pnpm build
      pnpm test
    },
    uses("actions/checkout@v4")
  ]
}
```

The content inside `run { ... }` is captured verbatim as shell script content.

### Grammar Changes

```
Step {
  RunStep |
  RunBlockStep |  // New
  UsesStep |
  AgentTaskStep |
  GuardJsStep
}

RunBlockStep {
  kw<"run"> RunBlock
}

RunBlock {
  "{" runBlockContent "}"
}
```

The `runBlockContent` would be a special token that captures everything between `{` and `}` verbatim, similar to how `guard_js` handles JavaScript content.

### Pros

- **Clean and readable**: Shell commands appear naturally without quote noise
- **Familiar pattern**: Similar to Terraform, Ruby, and other infrastructure DSLs
- **Multi-line friendly**: Natural support for multiple commands
- **Single-line option**: `run { echo hello }` works for simple cases
- **Compatible with existing syntax**: Can coexist with `run("...")` for backward compatibility
- **Good error recovery**: Brace-delimited blocks work well with Lezer's `@detectDelim`

### Cons

- **Brace ambiguity**: Need to handle `}` within shell commands (e.g., `if { ... }` in bash)
- **Grammar complexity**: Requires a custom tokenizer mode for verbatim content capture
- **Indentation sensitivity**: Users may expect indentation to be stripped (like triple-quotes)
- **Token mode switching**: Lezer needs careful configuration for content capture

### Implementation Complexity

**Medium-High**. Requires:
1. Custom token handler for `runBlockContent`
2. Careful brace nesting logic (count `{`/`}` pairs inside content)
3. Decision on whitespace handling (preserve vs. strip leading indent)

### VS Code Highlighting

Achievable with TextMate patterns:
```json
{
  "name": "meta.step.run.block.workpipe",
  "begin": "\\brun\\s*\\{",
  "end": "\\}",
  "contentName": "source.shell.embedded.workpipe",
  "patterns": [{ "include": "source.shell" }]
}
```

Embedded shell highlighting via `source.shell` inclusion.

---

## Option 2: Indentation-Based Syntax

Use indentation to delimit shell content, similar to Python or YAML:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps:
    run:
      pnpm install
      pnpm build
      pnpm test
    uses: "actions/checkout@v4"
}
```

### Grammar Changes

This would require significant grammar restructuring:
- Remove `[` ... `]` array syntax for steps
- Implement significant-whitespace parsing
- Track indentation levels

### Pros

- **Very clean**: No delimiters at all for shell content
- **YAML-like**: Familiar to GitHub Actions users
- **Natural for multi-line**: Each line is implicitly part of the command

### Cons

- **Major grammar overhaul**: Lezer is not designed for significant-whitespace grammars
- **Error recovery degradation**: Indentation errors cascade unpredictably
- **Copy-paste hazards**: Tabs vs. spaces issues, pasted code may break
- **Breaks existing syntax**: Not backward compatible with current `steps: [...]`
- **Mixed content awkward**: Hard to mix with structured steps like `agent_task`
- **Editor tooling challenges**: Harder to implement reliable bracket matching

### Implementation Complexity

**Very High**. Would require:
1. Custom indentation-tracking tokenizer
2. Complete redesign of step list parsing
3. Breaking changes to existing files
4. Significant editor extension rework

### VS Code Highlighting

Challenging. TextMate grammars handle indentation poorly; would need heuristic patterns.

### Verdict

**Not recommended.** The implementation cost is prohibitive and conflicts with Lezer's design principles. ADR-0003 explicitly chose Lezer for its brace-delimited recovery, which indentation-based parsing would undermine.

---

## Option 3: Heredoc-Style Syntax

Use explicit delimiter markers, inspired by shell heredocs:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run <<EOF
      pnpm install
      pnpm build
      pnpm test
    EOF,
    uses("actions/checkout@v4")
  ]
}
```

Or with inline delimiters:

```workpipe
steps: [
  run <<SHELL
    pnpm install
  SHELL
]
```

### Grammar Changes

```
RunStep {
  kw<"run"> "(" String ")" |
  kw<"run"> "<<" Identifier heredocContent Identifier
}
```

### Pros

- **Unambiguous**: Explicit start/end markers eliminate parsing ambiguity
- **Familiar to shell users**: Mirrors bash/zsh heredoc syntax
- **No brace counting**: User-chosen delimiter avoids content conflicts
- **Flexible**: User can choose any delimiter that doesn't appear in content

### Cons

- **Verbose**: Requires typing the delimiter twice
- **Awkward with arrays**: Heredocs inside `[ ... ]` look unusual
- **Token complexity**: Need to track arbitrary delimiter strings
- **Less intuitive for non-shell users**: Heredoc syntax is not universal
- **Potential delimiter collisions**: Though rare, content could contain the delimiter

### Implementation Complexity

**High**. Requires:
1. Dynamic delimiter tracking in tokenizer
2. Context-sensitive end-marker detection
3. Careful interaction with step list comma separation

### VS Code Highlighting

Moderate difficulty. TextMate can match heredoc patterns but needs careful regex:
```json
{
  "begin": "\\brun\\s*<<(\\w+)",
  "end": "^(\\1)$",
  "contentName": "source.shell.embedded.workpipe"
}
```

---

## Option 4: Shell Block Keyword

Introduce a dedicated `shell` keyword for block-style shell content:

```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    shell {
      pnpm install
      pnpm build
      pnpm test
    },
    uses("actions/checkout@v4")
  ]
}
```

This is similar to Option 1 but uses `shell` instead of overloading `run`.

### Grammar Changes

```
Step {
  RunStep |
  ShellStep |  // New keyword
  UsesStep |
  AgentTaskStep |
  GuardJsStep
}

ShellStep {
  kw<"shell"> "{" shellContent "}"
}
```

### Pros

- **Clear semantics**: `shell` explicitly signals "this is shell code"
- **No overloading**: `run()` keeps its current meaning; `shell {}` is new
- **Future extensibility**: Could add `powershell {}`, `python {}` variants
- **Familiar concept**: Many DSLs use language-specific block keywords

### Cons

- **New keyword**: Adds to reserved word list (though `shell` is unlikely to conflict)
- **Redundancy**: Now two ways to write shell commands (`run()` and `shell {}`)
- **Migration path unclear**: Should users prefer `shell {}` over `run()`?
- **Same brace-counting challenge**: Still needs verbatim content capture

### Implementation Complexity

**Medium-High**. Same as Option 1, plus keyword reservation.

### VS Code Highlighting

Same approach as Option 1, with `shell` keyword instead of `run`.

---

## Option 5: Improve Current Syntax (Minimal Change)

Keep the current `run("...")` syntax but improve ergonomics through:

1. **Better triple-quote handling**: Auto-dedent triple-quoted content
2. **Raw string variant**: `run(r"...")` for no-escape strings
3. **Enhanced VS Code support**: Better syntax highlighting inside strings
4. **Documentation**: Better examples and IDE snippets

```workpipe
// Existing: works today
run("""
  pnpm install
  pnpm build
""")

// Potential: raw strings (no escapes)
run(r"echo 'hello \"world\"'")
```

### Grammar Changes

Minimal:
```
String {
  string | tripleString | rawString  // Add rawString
}

// In tokens:
rawString { 'r"' (![\\\"\n] | "\\" _)* '"' }
```

### Pros

- **Minimal disruption**: No new syntax patterns to learn
- **Backward compatible**: All existing files continue to work
- **Low implementation risk**: Small grammar changes
- **Focus on tooling**: Investment in VS Code experience pays dividends

### Cons

- **Doesn't address core friction**: Still requires `run("...")` wrapper
- **Quotation overhead remains**: Every command needs function call syntax
- **Raw strings are niche**: Helps with escaping but not verbosity
- **Missed opportunity**: Other DSLs have shown cleaner patterns

### Implementation Complexity

**Low**. Mostly tooling and documentation work.

### VS Code Highlighting

Incremental improvement. Could add:
- Shell syntax highlighting inside `run("...")` strings
- Snippet expansion for common patterns
- Auto-indentation for triple-quoted blocks

---

## Recommendation

**Option 1: Block-based step syntax** is recommended as the primary improvement, with the following rationale:

1. **Best ergonomics/complexity ratio**: Achieves clean syntax without major grammar upheaval
2. **Backward compatible**: Existing `run("...")` continues to work; migration is optional
3. **Aligns with design philosophy**: WorkPipe aims to reduce boilerplate over raw YAML
4. **Lezer-compatible**: Brace-delimited blocks work well with Lezer's error recovery
5. **Editor-friendly**: TextMate can provide embedded shell highlighting

### Proposed Migration Path

1. **Phase 1**: Implement `run { ... }` block syntax alongside existing `run("...")`
2. **Phase 2**: Add deprecation warning to `run("""...""")` multi-line form (encourage block syntax)
3. **Phase 3 (optional)**: Consider `run("...")` deprecation for single commands (keep for backward compat)

### Open Questions for User Decision

1. **Brace nesting strategy**: How should `}` inside shell content be handled?
   - **Option A**: Count brace pairs (requires balanced braces in shell content)
   - **Option B**: Escape `\}` when literal `}` is needed
   - **Option C**: Allow escape hatch to triple-quote syntax for edge cases

2. **Indentation handling**: Should leading whitespace be stripped?
   - **Option A**: Preserve exactly (like triple-quotes today)
   - **Option B**: Strip common leading indent (more intuitive)
   - **Option C**: User-configurable (adds complexity)

3. **Single-line preference**: Is `run { echo hello }` acceptable?
   - If yes, both forms work
   - If no, require multi-line for block syntax

4. **Keyword choice**: `run { }` vs `shell { }`?
   - `run` reuses existing keyword, less to learn
   - `shell` is more explicit about content type

5. **`uses()` block form**: Should `uses` also get a block variant?
   ```workpipe
   uses "actions/checkout@v4" {
     with: {
       ref: main
     }
   }
   ```
   This is orthogonal but worth considering for consistency.

## Alternatives Considered

See Options 2-5 above for detailed analysis of:
- Indentation-based syntax (rejected: incompatible with Lezer)
- Heredoc-style syntax (viable but verbose)
- Shell block keyword (viable, adds keyword)
- Improving current syntax (viable but doesn't address core friction)

## Consequences

### If Option 1 is adopted:

**Positive**:
- Significant reduction in syntactic noise for shell-heavy workflows
- Better developer experience for writing and reading shell commands
- Alignment with modern infrastructure DSL conventions (Terraform, Pulumi)
- Opens path for future block-based constructs

**Negative**:
- Grammar complexity increases (verbatim content tokenization)
- Two ways to write shell commands (mild learning curve)
- Brace handling may surprise users with complex shell scripts
- VS Code extension needs update for embedded shell highlighting

**Neutral**:
- Existing files continue to work unchanged
- Documentation will need examples of both styles
- Style guide decision: when to use which form

### If no change is made (Option 5):

**Positive**:
- No implementation effort
- No learning curve for new syntax
- Focus resources elsewhere

**Negative**:
- Continued friction for shell-heavy workflows
- WorkPipe feels more verbose than alternatives
- Missed opportunity to differentiate from raw YAML

## References

- [ADR-0003: Lezer Grammar Design and Expression Language](0003-lezer-grammar-design-and-expression-language.md) - Establishes Lezer parser and keyword reservation strategy
- [ADR-0007: Cycle Syntax and Guard Block Design](0007-cycle-syntax-and-guard-block-design.md) - Precedent for `guard_js` verbatim block handling
- `packages/lang/src/workpipe.grammar` - Current grammar definition
- `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json` - TextMate grammar for highlighting
- [Terraform Heredoc Strings](https://developer.hashicorp.com/terraform/language/expressions/strings#heredoc-strings) - Prior art
- [Lezer Grammar Reference](https://lezer.codemirror.net/docs/ref/#lr.grammar) - Parser generator documentation
