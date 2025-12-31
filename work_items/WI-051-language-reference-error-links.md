# WI-051: Add Error Code Links to Language Reference

**ID**: WI-051
**Status**: Completed
**Priority**: P3-Low
**Milestone**: E (Tooling)
**Phase**: 9 (Tooling polish)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

The language reference documentation (`docs/language-reference.md`) documents required properties for various constructs but does not indicate what error codes appear when these properties are omitted. Adding error code references would help users understand validation behavior.

**Source:** End-user acceptance review of WI-045

## Example

Current documentation might say:
> **runs_on** (required): The runner environment for the job.

Enhanced documentation would say:
> **runs_on** (required): The runner environment for the job. Omitting this produces [WP7001](errors.md#wp7001).

## Acceptance Criteria

- [x] Update `docs/language-reference.md` to link error codes for required fields
- [x] Add error code references for:
  - `runs_on` in job (WP7001)
  - `runs_on` in agent_job (WP7002)
  - Termination condition in cycle (WP6001)
  - `max_iters` recommendation in cycle with `until` (WP6005)
- [x] Ensure links point to `docs/errors.md` (requires WI-049 to be complete first)
- [x] Review for consistency in documentation style

## Technical Context

The language reference is in `docs/language-reference.md`. Error code documentation will be created in WI-049.

## Dependencies

- **WI-049: Create Error Code Documentation** - must be complete first to have link targets

## Notes

- This improves discoverability of error codes
- Should be done after WI-049 creates the errors.md file
- Consider using a consistent format for all required field annotations
