# WI-095: Documentation and Examples for Step Syntax

**ID**: WI-095
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: Step Syntax Improvements (ADR-0013)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Update all documentation and examples to reflect the new step syntax from ADR-0013 (ACCEPTED). This includes:

1. **Update language-reference.md** with new syntax documentation
2. **Update all examples** to use new syntax (or show both forms)
3. **Create migration guide** from old to new syntax
4. **Update getting-started.md** with modern examples

### New Syntax

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

### Language Reference (docs/language-reference.md)

- [ ] Add "Step Syntax" section with both block and array forms
- [ ] Document `shell { }` block syntax
- [ ] Document `uses() { }` block syntax
- [ ] Document indentation handling (stripped when generating YAML)
- [ ] Show examples of nested braces in shell content
- [ ] Explain when to use old vs new syntax

### Getting Started Guide (docs/getting-started.md)

- [ ] Update "first workflow" example to use new syntax
- [ ] Keep examples simple and approachable
- [ ] Show progression from simple to complex

### Examples Directory

- [ ] Update `examples/minimal/` to use new syntax
- [ ] Update `examples/simple-job/` to use new syntax
- [ ] Update `examples/ci-pipeline/` to use new syntax
- [ ] Create comparison example showing old vs new syntax
- [ ] Verify all examples compile after updates
- [ ] Regenerate all `expected.yml` files

### Migration Guide

- [ ] Create `docs/migration-step-syntax.md` or section in existing docs
- [ ] Document which syntax is deprecated (if any)
- [ ] Provide side-by-side examples
- [ ] Explain backward compatibility guarantees
- [ ] Document any edge cases or limitations

### Changelog/Release Notes

- [ ] Add entry to CHANGELOG.md (if exists)
- [ ] Document in release notes for version with new syntax

### Tests

- [ ] All example files compile without errors
- [ ] Golden tests updated for new example output
- [ ] No documentation links broken

## Technical Context

### Before/After Examples

**Old Syntax (still supported):**
```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run("pnpm install"),
    run("""
      pnpm build
      pnpm test
    """),
    uses("actions/checkout@v4", {
      with: { ref: "main" }
    })
  ]
}
```

**New Syntax:**
```workpipe
job build {
  runs_on: ubuntu-latest
  steps {
    shell { pnpm install }
    shell {
      pnpm build
      pnpm test
    }
    uses("actions/checkout@v4") {
      with: { ref: "main" }
    }
  }
}
```

### Documentation Structure

The language-reference.md Steps section should cover:

1. **Overview**: What steps are, how they map to GitHub Actions
2. **Step Types**: shell, uses, agent_task, guard_js
3. **Block Syntax**: The new `steps { }` format
4. **Array Syntax**: The original `steps: [ ]` format
5. **Shell Blocks**: Writing shell commands without quotes
6. **Uses Blocks**: Configuring actions with block syntax
7. **Best Practices**: When to use which form

### Migration Considerations

The migration guide should address:

1. **Both syntaxes work**: No forced migration
2. **Mix and match**: Can use array in some jobs, block in others
3. **Gradual adoption**: Update files incrementally
4. **Automated migration**: Could provide a codemod (future enhancement)

### Example Files to Update

Priority order for example updates:
1. `examples/minimal/` - Simplest, first impression
2. `examples/simple-job/` - Basic patterns
3. `examples/ci-pipeline/` - Common real-world use
4. `examples/job-outputs/` - Shows data flow
5. Other examples as time permits

### Related Files

- `docs/language-reference.md` - Main syntax documentation
- `docs/getting-started.md` - New user guide
- `docs/quick-reference.md` - Cheat sheet
- `examples/*/` - All example directories
- `examples/README.md` - Examples index

### Related ADRs

- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- **WI-091**: Grammar - Steps Block and Shell Keyword
- **WI-092**: AST and Parser Updates
- **WI-093**: Codegen - Indentation Stripping
- **WI-094**: VS Code Extension Updates (can run in parallel)

Note: Documentation should be updated after compiler changes are complete to ensure examples actually work.

## Notes

### Documentation Steward Gate

Per CLAUDE.md, this work item triggers the documentation-steward gate because:
- It changes WorkPipe's user-facing behavior (new syntax)
- It changes how users write workflows (new keywords)
- Existing examples may become misleading if not updated

The documentation-steward must verify:
1. All docs accurately describe new syntax
2. All examples compile and produce correct YAML
3. Migration path is clear and tested

### Style Decisions Needed

1. Should new examples exclusively use new syntax?
2. Should docs show both forms everywhere, or recommend one?
3. Should old syntax be marked as "legacy" or just "alternative"?

Recommendation: Show new syntax as primary, mention old syntax as "also supported" for backward compatibility.
