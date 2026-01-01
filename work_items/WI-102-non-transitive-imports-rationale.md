# Non-Transitive Imports Rationale Documentation

**ID**: WI-102
**Status**: Backlog
**Priority**: P1-High
**Milestone**: F (Import System)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## Description

The import system is non-transitive but the rationale for this design decision is not explained in user-facing documentation. Users may be confused about why they need to re-import types that are already imported by their dependencies.

This is a deliberate design decision (documented in ADR-0012) that prevents "spooky action at a distance" where changes to one file's imports affect downstream files. However, this rationale should be clearly communicated to users.

## Acceptance Criteria

- [ ] Add "Why Non-Transitive Imports?" section to `docs/language-reference.md` in the Imports section
- [ ] Explain the design rationale:
  - Explicit dependencies are easier to understand
  - Prevents cascading import changes
  - Each file is self-documenting about its dependencies
  - Matches patterns from Go, Rust, and other modern languages
- [ ] Provide example showing transitive vs non-transitive behavior
- [ ] Add reference to ADR-0012 for deeper technical discussion
- [ ] Consider adding a note in `docs/getting-started.md` import section

## Technical Context

- ADR-0012: Import System Design (`docs/adr/ADR-0012-import-system.md`)
- Implementation: `packages/compiler/src/compile.ts` - compileWithImports()
- Type registry merging: `packages/compiler/src/types/type-registry.ts`
- Non-transitive enforcement is explicit in the design

## Dependencies

- None

## Notes

Example to illustrate the behavior:

```workpipe
// types.workpipe
type BuildInfo {
  version: string
}

// workflows/build.workpipe
import { BuildInfo } from "./types.workpipe"
// Uses BuildInfo

// workflows/deploy.workpipe
// This file does NOT automatically have access to BuildInfo
// just because build.workpipe imported it.
// Must explicitly import:
import { BuildInfo } from "./types.workpipe"
```

The rationale section should be friendly and explain benefits rather than just stating the rule.
