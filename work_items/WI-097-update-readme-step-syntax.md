# Update README.md Examples to New Step Syntax (ADR-0013)

**ID**: WI-097
**Status**: In Progress
**Priority**: P1-High
**Milestone**: G (Step Syntax Improvements)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

The main README.md still uses old array-style syntax for steps (`steps: [ run(...), uses(...) ]`) throughout all examples. Per ADR-0013 (accepted), steps should use block syntax with `steps { ... }` and `shell { ... }` keywords.

This is documentation drift discovered after WI-095 and WI-096 completed the syntax improvements in examples/ and language docs. The README.md was not updated as part of that work.

## Examples to Update

**Old syntax (appears in multiple places in README.md):**
```workpipe
steps: [
  uses("actions/checkout@v4"),
  uses("docker/setup-buildx-action@v3"),
  run("docker build -t myorg/api:${{ github.sha }} ./services/api"),
  run("echo image_tag=myorg/api:${{ github.sha }} >> $GITHUB_OUTPUT")
]
```

**New syntax (what it should be):**
```workpipe
steps {
  uses("actions/checkout@v4") {}
  uses("docker/setup-buildx-action@v3") {}
  shell {
    docker build -t myorg/api:${{ github.sha }} ./services/api
    echo image_tag=myorg/api:${{ github.sha }} >> $GITHUB_OUTPUT
  }
}
```

## Acceptance Criteria

- [ ] All code blocks in README.md showing step syntax use block syntax
- [ ] Old array syntax removed entirely
- [ ] Examples compile successfully with new syntax
- [ ] README structure and flow unchanged (only code blocks updated)
- [ ] No other README content modified
- [ ] Verified no other documentation files have this issue (language-reference.md should already be correct from WI-095)

## Technical Context

- **ADR-0013**: Step Syntax Improvements - ACCEPTED
- **WI-095**: Documentation and Examples for Step Syntax (completed)
- **WI-096**: Update Remaining Examples to New Step Syntax (completed)
- **Grammar**: `packages/lang/src/workpipe.grammar` already supports block syntax
- **Docs**: `docs/language-reference.md` already updated in WI-095

## Dependencies

- None (documentation-only change)

## Notes

This is purely a documentation update. The compiler and all examples already support the new syntax. The README.md is customer-facing and shows outdated patterns, which undermines confidence in the language design.

Related issue: identified during documentation review of WI-095/WI-096 completion.
