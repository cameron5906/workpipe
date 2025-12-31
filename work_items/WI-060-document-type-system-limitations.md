# Document Type System Limitations Clearly

**ID**: WI-060
**Status**: Completed
**Priority**: P1-High (USER ESCALATED)
**Milestone**: E (Tooling/Documentation)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Add clear documentation explaining the type system's design boundaries and limitations. Users need to understand that:
- Types in WorkPipe are compile-time only (no runtime type checking)
- User-defined custom types are not supported (only primitive types: string, number, boolean, path, json)
- Job output types serve a different purpose than agent task schema types

This work item addresses findings from the end-user acceptance review of the type system (WI-046, WI-056).

## Acceptance Criteria

- [x] "Types are compile-time only" callout added to language reference
- [x] "User-defined types not supported" section added to language reference
- [x] Job output types vs agent schema types comparison/explanation added
- [x] `path` type has clear description (what it represents, when to use it)
- [x] Links to ADR-0010 for design rationale

## Technical Context

The type system is intentionally limited by design (see ADR-0010). The language reference at `docs/language-reference.md` needs to clearly communicate these boundaries so users don't expect features that aren't supported.

Key documentation locations:
- `docs/language-reference.md` - Primary target for these additions
- `docs/adr/ADR-0010-job-outputs-design.md` - Design rationale to link to

## Dependencies

- None (documentation-only work item)

## Notes

- Originated from end-user acceptance review of custom type system
- Focus on clarity and preventing user confusion
- Consider adding a "Type System Design Philosophy" subsection
