# Document `json` Type Usage Pattern

**ID**: WI-062
**Status**: Completed
**Priority**: P2-Medium
**Milestone**: E (Tooling/Documentation)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Add documentation and/or an example showing how to effectively use the `json` typed output between jobs. The `json` type is powerful but its usage patterns aren't immediately obvious:
- How to serialize data to JSON in a shell step
- How to consume JSON output in a downstream job
- Limitations and caveats (size limits, expression access patterns)

## Acceptance Criteria

- [x] Example shows setting a `json` output (JSON serialization in shell)
- [x] Example shows consuming a `json` output (parsing/access patterns)
- [x] Caveats documented:
  - Size limits (GitHub Actions output size constraints)
  - Expression access patterns (fromJSON, property access)
  - When to use json vs artifacts

## Technical Context

The `json` type is one of the five primitive types (string, number, boolean, path, json). Unlike the others, its usage requires understanding of:
- JSON serialization in the producing step
- GitHub Actions expression syntax for consumption
- The `fromJSON()` function in expressions

Example pattern:
```workpipe
job producer {
  runs_on: ubuntu-latest
  outputs: {
    data: json
  }
  step build {
    run: """
      echo "data={\"key\":\"value\"}" >> $GITHUB_OUTPUT
    """
  }
}

job consumer {
  runs_on: ubuntu-latest
  needs: [producer]
  step use_data {
    run: """
      echo "Key is: ${{ fromJSON(needs.producer.outputs.data).key }}"
    """
  }
}
```

## Dependencies

- None (documentation-only work item)

## Notes

- Originated from end-user acceptance review of custom type system
- Could be added to `examples/job-outputs/` or a new `examples/json-outputs/`
- Consider mentioning artifacts as alternative for large data

## Completion Summary (2025-12-31)

Documentation steward completed comprehensive review:
- Example and documentation merged into `examples/job-outputs/`
- Triple-quoted string syntax documented for `guard_js` usage

### Follow-Up Issues Identified

**Issue 1: Triple-quoted strings documentation clarification**
- Triple-quoted strings work in `guard_js` blocks
- BUT: NOT supported in `run()` shell steps - only work in guard_js specifically
- Docs were misleading about general applicability
- **Action**: Update language-reference.md to clarify scope

**Issue 2: Example files using unsupported syntax**
- `examples/multi-environment-deploy/` - contains syntax not yet supported
- `examples/enterprise-e2e-pipeline/` - contains syntax not yet supported
- These were created in WI-057 and flagged for doc steward review
- **Action**: Either fix example syntax to match supported feature set or mark as "aspirational"
