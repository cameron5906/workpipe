# Built-in DSL Constructs for Commonly Used Steps

**ID**: WI-109
**Status**: In Progress
**Priority**: P2-Medium
**Milestone**: G (Step Syntax Improvements) / Future Enhancement
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Implementation Plan (Proof of Concept: checkout only)

Starting with `checkout {}` as proof of concept per work item guidance. This validates the pattern before expanding to other built-ins.

### Phase 2A: Grammar Changes
- [ ] Add `CheckoutStep` production to `packages/lang/src/workpipe.grammar`
- [ ] Add `checkout` keyword
- [ ] CheckoutStep accepts optional `with:` block for parameters (ref, fetch_depth, etc.)
- [ ] Grammar tests for valid checkout syntax
- [ ] Grammar tests for error recovery

### Phase 2B: AST Updates
- [ ] Add `CheckoutStepNode` interface to `packages/compiler/src/ast/types.ts`
- [ ] Update `StepNode` union to include `CheckoutStepNode`
- [ ] Update `packages/compiler/src/ast/builder.ts` to build CheckoutStepNode
- [ ] AST builder tests

### Phase 2C: Codegen
- [ ] Add `transformCheckoutStep()` to `packages/compiler/src/codegen/transform.ts`
- [ ] Map DSL properties to action inputs (fetch_depth -> fetch-depth, etc.)
- [ ] Default to `actions/checkout@v4`
- [ ] Codegen tests

### Phase 2D: Integration
- [ ] Create example in `examples/` demonstrating checkout syntax
- [ ] Verify existing tests still pass
- [ ] End-to-end compilation test

## Description

Users want built-in DSL constructs for commonly used GitHub Actions steps like `checkout` and `download-artifact` to avoid magic strings and improve developer experience.

Currently, users must write:
```workpipe
uses("actions/checkout@v4") {}
uses("actions/download-artifact@v4") { with: { name: "my-artifact" } }
```

This feature request proposes native DSL constructs that provide:
- First-class syntax without magic strings
- Better editor support (autocomplete, validation)
- Shorter, more readable code
- Compile-time validation of parameters

### Proposed Syntax Examples

**Checkout:**
```workpipe
checkout {}
checkout { with: { fetch_depth: 0 } }
checkout { with: { ref: "develop", fetch_depth: 0 } }
```

**Download Artifact:**
```workpipe
download_artifact { name: "my-artifact" }
download_artifact { name: "build-output", path: "dist/" }
```

**Potential Future Built-ins:**
- `upload_artifact { name: "...", path: "..." }`
- `setup_node { node_version: "18" }`
- `setup_python { python_version: "3.11" }`
- `cache { path: "...", key: "..." }`

## Acceptance Criteria

### Phase 1: Design & ADR
- [ ] Create ADR-0015 (or appropriate number) documenting the design
- [ ] Define which actions to include as built-ins (start minimal: checkout, download-artifact, upload-artifact)
- [ ] Define parameter mapping and validation rules for each built-in
- [ ] Define how version pinning works (default version, user override)
- [ ] Document interaction with existing `uses()` syntax (both remain valid)

### Phase 2: Grammar Changes
- [ ] Extend Lezer grammar with built-in step productions (CheckoutStep, DownloadArtifactStep, etc.)
- [ ] Add new keywords to grammar (`checkout`, `download_artifact`, `upload_artifact`)
- [ ] Grammar tests for each new construct
- [ ] Grammar tests for error recovery on malformed constructs

### Phase 3: AST Updates
- [ ] Add AST node types for each built-in step
- [ ] Update AST builder to construct built-in step nodes
- [ ] AST tests for built-in step parsing

### Phase 4: Codegen
- [ ] Transform built-in step AST nodes to appropriate `uses:` YAML output
- [ ] Map DSL parameter names to action input names
- [ ] Handle version pinning (default version, optional override)
- [ ] Codegen tests for each built-in step

### Phase 5: VS Code Extension
- [ ] Update TextMate grammar for syntax highlighting of new keywords
- [ ] Add hover documentation for built-in steps
- [ ] Add autocomplete for built-in step parameters

### Phase 6: Documentation & Examples
- [ ] Update docs/language-reference.md with Built-in Steps section
- [ ] Update docs/quick-reference.md with built-in step syntax
- [ ] Create example demonstrating built-in vs explicit `uses()` syntax
- [ ] Update existing examples to use built-in syntax where appropriate
- [ ] Update README.md if new syntax is a headline feature

### Phase 7: Validation
- [ ] QA pass on all built-in constructs
- [ ] End-user acceptance review

## Technical Context

### Grammar Design Considerations

The grammar will need new productions. Example approach:

```
BlockStep {
  ShellStep |
  UsesBlockStep |
  AgentTaskStep |
  GuardJsStep |
  StepsFragmentSpread |
  CheckoutStep |       // NEW
  DownloadArtifactStep | // NEW
  UploadArtifactStep   // NEW
}

CheckoutStep {
  kw<"checkout"> "{" CheckoutProperty* "}"
}

CheckoutProperty {
  WithProperty  // Reuse existing WithProperty
}

DownloadArtifactStep {
  kw<"download_artifact"> "{" ArtifactProperty* "}"
}

ArtifactProperty {
  NameProperty | PathProperty | MergeMultipleProperty
}
```

### Parameter Mapping

Built-in steps should map DSL names to action inputs:

| DSL Property | checkout@v4 Input | Type |
|--------------|-------------------|------|
| `ref` | `ref` | string |
| `fetch_depth` | `fetch-depth` | number |
| `submodules` | `submodules` | string |
| `token` | `token` | string |

| DSL Property | download-artifact@v4 Input | Type |
|--------------|---------------------------|------|
| `name` | `name` | string |
| `path` | `path` | string |
| `pattern` | `pattern` | string |
| `merge_multiple` | `merge-multiple` | bool |

### Version Pinning Strategy

Options to consider:
1. **Hardcoded default**: `checkout {}` always maps to `actions/checkout@v4`
2. **Explicit version property**: `checkout { version: "v4" }` with default
3. **Project-level config**: Default versions in a config file
4. **No default**: Require explicit version (safest but more verbose)

Recommended: Option 2 with sensible defaults matching current stable versions.

### Interaction with `uses()` Syntax

Both syntaxes remain valid:
- `uses("actions/checkout@v4") {}` - Explicit, works for any action
- `checkout {}` - Shorthand for common actions

This is additive, not a replacement. The `uses()` escape hatch remains essential for custom actions.

### Related Work

- **Generic Workflows Research Spike**: If ADR-0015 or similar explores "generic workflow" patterns, there may be overlap in how parameterized constructs are defined. Coordinate to ensure consistent design patterns.
- **Fragment System (ADR-0014)**: Could built-in steps be implemented as "built-in fragments"? Worth exploring.
- **WI-090 Step Syntax Research Spike**: Previous research on step syntax improvements may inform this design.

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Scope creep (too many built-ins) | Start minimal (3 actions), add more based on demand |
| Version drift | Clear update policy, diagnostic warnings for outdated defaults |
| Parameter name bikeshedding | Follow existing action input names where sensible |
| Overlap with generic workflows | Coordinate design, ensure consistent patterns |

## Dependencies

- No hard blockers
- Soft dependency: Coordinate with any generic workflows/ADR-0015 research if in flight

## Notes

- This is a **user feature request** based on feedback about avoiding magic strings
- Prioritized as P2-Medium because existing `uses()` syntax works, this is ergonomic improvement
- Consider starting with just `checkout {}` as proof of concept before expanding
- Documentation and examples update is part of acceptance criteria per CLAUDE.md rules
- This affects the DSL's public surface area, so QA and docs gates apply per CLAUDE.md
