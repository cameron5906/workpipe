# Establish Testing Infrastructure and Conventions

**ID**: WI-003
**Status**: Completed
**Priority**: P1-High
**Milestone**: A (Vertical slice)
**Phase**: 0 (Repo + contracts)
**Created**: 2025-12-30
**Updated**: 2025-12-30
**Completed**: 2025-12-30

## Description

Set up the testing infrastructure that will be used throughout the project. This includes the test runner, assertion libraries, and conventions for organizing tests. Good testing infrastructure early prevents technical debt accumulation.

## Acceptance Criteria

- [x] Test runner configured (recommend Vitest for speed and ESM support)
- [x] Test scripts added to root and package-level `package.json`
- [x] Test directory structure established:
  - `packages/*/src/__tests__/` for unit tests
  - `packages/*/src/__tests__/fixtures/` for test fixtures
  - `examples/` doubles as integration test fixtures
- [x] Coverage reporting configured (target: 80%+ for compiler core)
- [x] Example unit test written for each package (placeholder)
- [x] Golden test helper utilities created for YAML output comparison
- [x] CI workflow stub for running tests (will be enhanced later)
- [x] Test naming conventions documented:
  - `*.test.ts` for unit tests
  - `*.integration.test.ts` for integration tests
- [x] Snapshot testing approach decided (for AST and YAML output)

## Technical Context

From CLAUDE.md Section 12 (Testing strategy):
```
- Golden tests: WorkPipe input -> exact YAML output (stable ordering)
- Negative tests: malformed specs, type errors, cycle config errors
- Integration tests: run generated workflows in sandbox repo
- Property tests (later): random small graphs to validate lowering
```

### Golden Test Framework Design

Golden tests are critical for compiler stability. The framework should:

1. Read `.workpipe` input from `examples/<name>/<name>.workpipe`
2. Read expected output from `examples/<name>/expected.yml`
3. Compile the input and compare against expected
4. Support `--update-snapshots` flag for regenerating expected output

```typescript
// Conceptual API for golden tests
import { runGoldenTest } from '../test-utils';

describe('basic workflow', () => {
  it('compiles simple job', async () => {
    await runGoldenTest('simple-job');
  });
});
```

### Negative Test Organization

Negative tests should be organized by error code:
- `packages/compiler/src/__tests__/errors/WP1xxx-parse-errors.test.ts`
- `packages/compiler/src/__tests__/errors/WP2xxx-semantic-errors.test.ts`

## Dependencies

- WI-001: Initialize monorepo structure (must have package scaffolding)

## Notes

- Vitest is recommended over Jest for:
  - Native ESM support
  - Faster execution
  - Better TypeScript integration
- Consider using `fast-check` for property-based testing (Phase 8+)
- The golden test framework is foundational - invest time in good ergonomics
- Include test utilities in a shared `packages/test-utils/` package if needed
- Mock GitHub API responses for cycle dispatch testing (Phase 8)
