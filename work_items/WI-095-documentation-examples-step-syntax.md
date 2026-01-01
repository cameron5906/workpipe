# WI-095: Documentation and Examples for Step Syntax

**ID**: WI-095
**Status**: Completed
**Completed Date**: 2025-12-31
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

- [x] Add "Step Syntax" section with both block and array forms
- [x] Document `shell { }` block syntax
- [x] Document `uses() { }` block syntax (note: requires `{}` even without config)
- [x] Document indentation handling (stripped when generating YAML)
- [x] Show examples of nested braces in shell content
- [x] Explain when to use old vs new syntax

### Getting Started Guide (docs/getting-started.md)

- [x] Update "first workflow" example to use new syntax
- [x] Keep examples simple and approachable
- [x] Show progression from simple to complex

### Examples Directory

- [x] Update `examples/minimal/` to use new syntax
- [x] Update `examples/simple-job/` to use new syntax
- [x] Update `examples/ci-pipeline/` to use new syntax
- [x] Create comparison example showing old vs new syntax (in language-reference.md migration section)
- [x] Verify all examples compile after updates
- [x] Regenerate all `expected.yml` files

### Migration Guide

- [x] Create migration section in language-reference.md
- [x] Document that neither syntax is deprecated
- [x] Provide side-by-side examples
- [x] Explain backward compatibility guarantees
- [x] Document edge cases: `uses()` requires trailing `{}` in block syntax

### Quick Reference (docs/quick-reference.md)

- [x] Update to show block syntax as primary
- [x] Note that `uses()` requires `{}` block

### Examples README

- [x] Add Step Syntax section explaining both forms
- [x] Update feature reference table

### Tests

- [x] All example files compile without errors
- [x] Golden tests (expected.yml files) updated for new example output

## Technical Context

### Key Implementation Detail Discovered

In block syntax, `uses()` requires a trailing block `{}` even when there is no configuration. This is a grammar requirement:

```workpipe
// Works
uses("actions/checkout@v4") {}

// Does NOT work in block syntax
uses("actions/checkout@v4")  // Error: expected block
```

This is documented in all relevant places.

### Files Updated

**Documentation:**
- `docs/language-reference.md` - Complete rewrite of Steps section
- `docs/getting-started.md` - Updated first workflow and complete example
- `docs/quick-reference.md` - Updated all step syntax examples

**Examples:**
- `examples/minimal/minimal.workpipe` - Updated to block syntax
- `examples/minimal/expected.yml` - Regenerated
- `examples/minimal/README.md` - Updated documentation
- `examples/simple-job/simple-job.workpipe` - Updated to block syntax
- `examples/simple-job/expected.yml` - Regenerated
- `examples/simple-job/README.md` - Updated documentation
- `examples/ci-pipeline/ci-pipeline.workpipe` - Updated to block syntax
- `examples/ci-pipeline/expected.yml` - Regenerated
- `examples/ci-pipeline/README.md` - Updated documentation
- `examples/README.md` - Added Step Syntax section

### Related ADRs

- ADR-0013: Step Syntax Improvements (ACCEPTED)

## Dependencies

- **WI-091**: Grammar - Steps Block and Shell Keyword (Complete)
- **WI-092**: AST and Parser Updates (Complete)
- **WI-093**: Codegen - Indentation Stripping (Complete)
- **WI-094**: VS Code Extension Updates (Complete)

## Notes

### Style Decisions Made

1. New examples exclusively use new block syntax
2. Docs show block syntax as primary, array syntax as "also supported"
3. Old syntax is not marked as deprecated, just "alternative"
4. All migration guidance emphasizes gradual, optional adoption
