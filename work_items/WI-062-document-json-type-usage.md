# Document `json` Type Usage Pattern

**ID**: WI-062
**Status**: Backlog
**Priority**: P2-Medium
**Milestone**: E (Tooling/Documentation)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Add documentation and/or an example showing how to effectively use the `json` typed output between jobs. The `json` type is powerful but its usage patterns aren't immediately obvious:
- How to serialize data to JSON in a shell step
- How to consume JSON output in a downstream job
- Limitations and caveats (size limits, expression access patterns)

## Acceptance Criteria

- [ ] Example shows setting a `json` output (JSON serialization in shell)
- [ ] Example shows consuming a `json` output (parsing/access patterns)
- [ ] Caveats documented:
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
