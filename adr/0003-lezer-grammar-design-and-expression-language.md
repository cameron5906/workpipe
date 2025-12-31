# ADR-0003: Lezer Grammar Design and Expression Language

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WI-004 requires creating the Lezer grammar for the WorkPipe DSL. This grammar is the foundation for all compiler development and will define:

- The concrete syntax tree (CST) node types consumed by the AST builder
- Token definitions used for syntax highlighting in editor tooling
- Error recovery behavior for incomplete/invalid input
- The boundary between what the parser handles vs. what is deferred to semantic analysis

The grammar must support all constructs described in PROJECT.md Section 5, including:
- Workflow/job/step structure
- Trigger configurations
- Typed inputs, outputs, and artifacts
- Guard blocks with embedded JavaScript
- Agent tasks with Claude Code configuration
- Matrix definitions
- Cycle blocks with termination conditions
- Expression language for conditions (`if:`, `when`, `until`)

Key tensions to resolve:
1. **Grammar complexity vs. semantic phase complexity**: How much structure should the grammar enforce vs. defer to type checking?
2. **Expression language depth**: Should conditions like `github.ref == "refs/heads/main"` be parsed as structured AST or opaque strings?
3. **Embedded languages**: How to handle JavaScript in `guard_js` blocks and template interpolation in strings?
4. **Error recovery**: How to maintain useful CST output when input is incomplete?

PROJECT.md Section 11.3 provides guidance: "Keep grammar relatively small; push complexity into semantic phase. Use explicit keywords to avoid ambiguous parse states."

## Decision

### 1. Structured Expression AST for Conditions

**Decision**: Parse condition expressions (`if:`, `when`, `until`) as structured expression AST nodes, not opaque strings.

The grammar will include a subset of expression syntax:
- Member access: `github.ref`, `needs.build.outputs.status`
- Binary operators: `==`, `!=`, `&&`, `||`, `<`, `>`, `<=`, `>=`
- Unary operators: `!`
- Literals: strings, numbers, booleans
- Function calls: `contains()`, `startsWith()`, `endsWith()`, `format()`, `join()`
- Array literals: `[a, b, c]`
- Parenthesized expressions: `(a && b)`

**Rationale**:
- Enables IDE features: go-to-definition for `github.ref`, hover for `needs.build.outputs`
- Enables type checking: validate that referenced outputs exist and have correct types
- Enables better error messages: "job 'build' has no output 'status'" vs. "invalid expression"
- Aligns with "typed parameter passing" goal from PROJECT.md

**Not included** (deferred to GitHub Actions runtime):
- Complex GitHub Actions expression functions (`hashFiles`, `toJSON`, `fromJSON`)
- Context object internals beyond common paths (`github.*`, `env.*`, `secrets.*`, `needs.*`, `inputs.*`, `matrix.*`)

Unknown function calls and deep property paths will parse successfully but may produce semantic warnings.

### 2. Reserved Keywords

**Decision**: Reserve all language keywords explicitly rather than using context-sensitive parsing.

**Reserved keyword list** (alphabetical):

| Keyword | Usage |
|---------|-------|
| `after` | Job ordering: `job foo after bar` |
| `agent_job` | Agent job block |
| `agent_task` | Agent task within agent_job |
| `axes` | Matrix axis definition |
| `consumes` | Artifact consumption |
| `cycle` | Cycle block for iterative execution |
| `emit` | Artifact emission statement |
| `emits` | Artifact declaration |
| `env` | Environment variable block |
| `false` | Boolean literal |
| `if` | Conditional execution |
| `inputs` | Workflow inputs block |
| `job` | Job block |
| `matrix` | Matrix modifier on job |
| `max_iters` | Cycle iteration limit |
| `mcp` | MCP configuration block |
| `model` | Agent model selection |
| `needs` | Job dependency |
| `on` | Trigger specification |
| `output_artifact` | Agent output artifact |
| `output_schema` | Agent output schema |
| `outputs` | Job outputs block |
| `prompt` | Agent prompt |
| `raw_yaml` | Escape hatch block |
| `run` | Run step (shell command) |
| `runs_on` | Runner specification |
| `step` | Named step |
| `steps` | Steps list |
| `system_prompt` | Agent system prompt |
| `tools` | Agent tools configuration |
| `triggers` | Triggers block |
| `true` | Boolean literal |
| `until` | Cycle termination condition |
| `uses` | Uses step (action reference) |
| `when` | Conditional job execution |
| `workflow` | Top-level workflow block |

**Rationale**:
- PROJECT.md Section 11.3: "Use explicit keywords to avoid ambiguous parse states"
- Explicit reservation prevents future breakage if new keywords are added
- Enables clear error messages: "expected identifier, found keyword 'job'"
- Simplifies grammar rules (no need for contextual keyword detection)

**Note**: Identifiers matching reserved keywords are a parse error. Users must choose different names.

### 3. String Block and Interpolation Handling

**Decision**: The grammar will recognize three string forms and identify interpolation boundaries, but defer interpolation validation to the semantic phase.

**String forms**:

1. **Double-quoted strings**: `"simple string"`
   - Standard escape sequences: `\"`, `\\`, `\n`, `\t`
   - No interpolation

2. **Triple-quoted strings**: `"""multi-line content"""`
   - Preserves whitespace and newlines
   - No escape processing (raw content)
   - Used for scripts, prompts, embedded code

3. **Template strings**: `template("...")`  or `template("""...""")`
   - Contains interpolations: `{{expression}}`
   - Grammar tokenizes `{{` and `}}` as delimiters
   - Content between delimiters parsed as Expression
   - Content outside delimiters is literal text

**Interpolation grammar sketch**:
```
TemplateString {
  "template" "(" (DoubleString | TripleString) ")"
}

// Within template string content, the lexer emits:
// - TemplateLiteralPart (text between interpolations)
// - InterpolationStart "{{"
// - Expression (the interpolated expression)
// - InterpolationEnd "}}"
```

**Rationale**:
- Triple-quoted strings preserve formatting for multi-line scripts/prompts (PROJECT.md Section 11.3)
- Separating `template()` from plain strings makes interpolation opt-in and explicit
- Parsing interpolation boundaries enables IDE features (syntax highlighting, go-to-definition inside `{{}}`)
- Deferring interpolation expression validation to semantic phase keeps grammar simpler

### 4. Guard JavaScript Blocks: Opaque Treatment

**Decision**: Treat `guard_js """..."""` content as an opaque string. Do not attempt to parse JavaScript.

**Grammar representation**:
```
GuardStep {
  "step" String "guard_js" TripleString
}
```

The triple-quoted string content is captured verbatim and passed to the AST as a `GuardJsBlock` node containing raw JavaScript source.

**Rationale**:
- JavaScript is a complex language; embedding a JS parser adds significant complexity
- Guard scripts are executed at runtime by Node.js, not by the WorkPipe compiler
- The compiler's responsibility is to correctly delimit the block and emit it into the generated YAML
- Semantic phase may perform basic validation (e.g., checking for `return` statement) via string inspection
- Future enhancement: optional integration with a JS linter for guard blocks

**Constraints on guard blocks**:
- Must use triple-quoted strings (single-line guards are error-prone)
- Content is emitted as-is into generated workflow YAML
- Runtime errors in guard JS surface at GitHub Actions execution time

### 5. Error Recovery Strategy

**Decision**: Implement comprehensive error recovery using Lezer's built-in mechanisms to maintain CST integrity for partial/invalid input.

**Recovery mechanisms**:

1. **Delimiter detection** (`@detectDelim`):
   - Enable for `{`/`}`, `[`/`]`, `(`/`)`
   - Allows parser to recover from mismatched delimiters

2. **Skip rules** for flexible whitespace:
   - Whitespace and comments skippable between any tokens
   - Line comments: `// ...`
   - Block comments: `/* ... */`

3. **Error nodes**:
   - Lezer automatically inserts `ERROR` nodes for unrecognized input
   - Grammar should avoid overly greedy rules that consume error tokens

4. **Synchronization points**:
   - `workflow`, `job`, `step` keywords serve as synchronization points
   - After an error, parser can recover at the next keyword

5. **Partial block handling**:
   - Unclosed blocks produce partial CST with available children
   - Enables IDE features even during typing

**Test requirements**:
- Grammar tests must include error recovery cases
- Verify that incomplete input produces useful partial CST
- Verify that diagnostics include source spans for error nodes

**Rationale**:
- PROJECT.md Section 11.3: "Strong error recovery for editor tooling"
- IDE integration requires parsing incomplete files during typing
- Better developer experience when errors are localized rather than cascading

### 6. Implementation Strategy: Incremental Expansion

**Decision**: Implement the grammar incrementally, starting with the minimal subset needed for existing fixtures, then expanding to cover full PROJECT.md syntax.

**Phase 1 (WI-004 scope)**: Parse existing fixtures
- `workflow` block with identifier
- `on:` trigger (single event, event list)
- `job` block with `runs_on`, `needs`, `if`, `steps`
- `steps:` list with `run()` and `uses()` calls
- Basic expressions for `if:` conditions
- Comments and whitespace

**Phase 2**: Triggers and inputs
- `triggers {}` block with `on` statements
- `workflow_dispatch` inputs
- Event type filters

**Phase 3**: Outputs and artifacts
- `outputs {}` block
- `emits` / `emit` / `consumes` declarations
- `env {}` blocks

**Phase 4**: Guards and agent tasks
- `guard_js` blocks
- `agent_job` and `agent_task` blocks
- MCP and tools configuration

**Phase 5**: Matrix and cycles
- `matrix` modifier on jobs
- `axes {}` block
- `cycle {}` block with `until` and `max_iters` (see [ADR-0007](0007-cycle-syntax-and-guard-block-design.md) for cycle design)

**Rationale**:
- Enables early validation with real fixtures
- Reduces risk of large grammar refactors
- Allows parallel work on AST builder for Phase 1 constructs
- Keywords are reserved upfront (all phases) to prevent breaking changes

### 7. File Extension Handling

**Decision**: File extension (`.workpipe` vs `.wp`) is a CLI concern, not a grammar concern.

The grammar and parser operate on source text, not files. The CLI (`@workpipe/cli`) handles:
- File discovery based on extension
- Extension validation
- Glob pattern matching

**Rationale**:
- Separation of concerns: grammar defines syntax, CLI defines file conventions
- Parser can be used programmatically on any text input
- Future flexibility: additional extensions can be added without grammar changes

## Alternatives Considered

### Alternative 1: Opaque String Expressions

**Approach**: Parse `if:` conditions as opaque strings, validate at runtime.

```
IfClause { "if" ":" String }
```

**Pros**:
- Simpler grammar
- Full GitHub Actions expression compatibility

**Cons**:
- No IDE support for expressions (no go-to-definition, no type hints)
- Errors only surface at GitHub Actions runtime
- Cannot validate output/artifact references at compile time

**Decision**: Rejected. The typed parameter passing goal requires compile-time validation of expressions.

### Alternative 2: Context-Sensitive Keywords

**Approach**: Allow keywords as identifiers in non-keyword positions.

```workpipe
job job {  // "job" as both keyword and identifier
  runs_on: ubuntu-latest
}
```

**Pros**:
- More flexible naming
- Familiar from languages like C# (contextual keywords)

**Cons**:
- Grammar complexity increases significantly
- Parser must track context to disambiguate
- Error messages become confusing
- Future keyword additions may break existing specs

**Decision**: Rejected. Explicit keywords align with PROJECT.md guidance and simplify the grammar.

### Alternative 3: Full JavaScript Parsing for Guards

**Approach**: Embed a JavaScript parser for `guard_js` blocks.

**Pros**:
- Syntax highlighting inside guard blocks
- Compile-time validation of guard JavaScript
- Go-to-definition for variables

**Cons**:
- Massive complexity increase (JS grammar is large)
- Version compatibility concerns (ES5? ES2022?)
- Maintenance burden for JS parser updates
- Diminishing returns: guards are typically small scripts

**Decision**: Rejected. Opaque treatment provides adequate functionality with minimal complexity.

### Alternative 4: Unified String Syntax with Mode Switching

**Approach**: Use a single string syntax with prefixes for modes.

```workpipe
prompt = r"raw string"
prompt = t"template {{var}}"
prompt = """multi-line"""
```

**Pros**:
- Familiar prefix syntax (like Python)
- Consistent string delimiter

**Cons**:
- Less explicit than `template()` function
- `r`, `t` prefixes may conflict with identifiers
- Triple-quote already implies "raw" in most languages

**Decision**: Rejected. Explicit `template()` wrapper is clearer and avoids prefix ambiguity.

## Consequences

### Positive

1. **IDE-ready from day one**: Structured expression AST enables go-to-definition, hover, and completion for references like `needs.build.outputs.status`

2. **Compile-time safety**: Type checker can validate that referenced jobs, outputs, and artifacts exist before workflow runs

3. **Clear error messages**: Reserved keywords and structured parsing enable precise error spans and suggestions

4. **Editor resilience**: Error recovery ensures partial CST is available during typing, enabling real-time diagnostics

5. **Incremental delivery**: Phased implementation allows early validation with fixtures while grammar expands

6. **Future-proof keywords**: Reserving all keywords upfront prevents breaking changes as syntax expands

### Negative

1. **Expression language subset**: Not all GitHub Actions expression functions are supported; users may need `raw_yaml` escape hatch for advanced expressions

2. **Identifier restrictions**: Reserved keywords cannot be used as identifiers, which may occasionally conflict with desired naming

3. **No guard JS validation**: JavaScript errors in guard blocks only surface at runtime

4. **Grammar maintenance**: Structured expressions require grammar updates if new operators/functions are needed

### Neutral

1. **Template string explicitness**: Requiring `template()` wrapper is more verbose but prevents accidental interpolation

2. **Phased implementation**: Some constructs (cycles, matrices) will parse as stubs initially

## References

- PROJECT.md Section 5: Language overview (syntax + semantics)
- PROJECT.md Section 11.3: Lezer grammar strategy
- [Lezer Grammar Guide](https://lezer.codemirror.net/docs/guide/)
- [Lezer Reference: Grammar Notation](https://lezer.codemirror.net/docs/ref/#lr.grammar)
- ADR-0001: Monorepo structure establishing `@workpipe/lang` package
- ADR-0007: Cycle syntax and guard block design (Phase 5 implementation)
- `examples/minimal/minimal.workpipe`: Minimal fixture for Phase 1
- `examples/simple-job/simple-job.workpipe`: Multi-job fixture for Phase 1
