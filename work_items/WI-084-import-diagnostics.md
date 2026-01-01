# WI-084: Import System - Diagnostics

**ID**: WI-084
**Status**: Completed
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Implement all import-related diagnostic codes (WP7001-WP7007). This is Phase 5 of the import system implementation (ADR-0012).

## Acceptance Criteria

- [x] WP7001: Circular import detected (Error)
- [x] WP7002: Import file not found (Error)
- [x] WP7003: Type not exported by imported file (Error)
- [x] WP7004: Duplicate import of same type (Error)
- [x] WP7005: Unused import (Warning)
- [x] WP7006: Invalid import path (absolute path warning) (Error)
- [x] WP7007: Import path resolves outside project root (Error)
- [x] All diagnostics have helpful hints
- [x] Diagnostics include file path context for cross-file errors
- [x] Update `docs/errors.md` with WP7xxx section
- [x] Tests for each diagnostic code
- [x] Levenshtein suggestions for WP7003 (type name typos)

## Technical Context

**Diagnostic codes** (from ADR-0012):

| Code | Severity | Description |
|------|----------|-------------|
| WP7001 | Error | Circular import detected |
| WP7002 | Error | Import file not found |
| WP7003 | Error | Type not exported by imported file |
| WP7004 | Error | Duplicate import of same type |
| WP7005 | Warning | Unused import |
| WP7006 | Error | Invalid import path (absolute path on CI, etc.) |
| WP7007 | Error | Import path resolves outside project root |

**Example error messages**:

```
error[WP7001]: Circular import detected
  --> a.workpipe:1:1
   |
 1 | import { TypeB } from "./b.workpipe"
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = Import cycle: a.workpipe -> b.workpipe -> a.workpipe
   = hint: Extract shared types to a third file that both can import

error[WP7003]: Type 'BuildInof' not found in './types.workpipe'
  --> main.workpipe:1:10
   |
 1 | import { BuildInof } from "./types.workpipe"
   |          ^^^^^^^^^
   |
   = hint: Did you mean 'BuildInfo'?
   = Available types: BuildInfo, DeployResult, TestSummary
```

**Files to modify**:
- `packages/compiler/src/diagnostics/diagnostic-codes.ts` (add WP7xxx)
- `packages/compiler/src/imports/validation.ts` (new)
- `docs/errors.md`

## Dependencies

- WI-080: Import System - Grammar and Parser
- WI-081: Import System - Path Resolution
- WI-082: Import System - Dependency Graph
- WI-083: Import System - Type Registry Merging

## Notes

- WP7005 (unused import) requires tracking which imported types are actually used
- Consider making WP7005 configurable (some teams may not want unused import warnings)
- Error messages should be actionable with clear remediation steps
