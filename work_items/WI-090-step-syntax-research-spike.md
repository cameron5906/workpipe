# WI-090: Step Syntax Improvement Research Spike

**ID**: WI-090
**Status**: Completed
**Priority**: P1-High
**Milestone**: G (Step Syntax Improvements)
**Created**: 2025-12-31
**Updated**: 2025-12-31
**Completed**: 2025-12-31

## Description

Users report that while WorkPipe's overall syntax is easy to use, writing job steps with shell code in string syntax is cumbersome - even with triple-quoted strings.

**Current syntax example:**
```workpipe
job build {
  runs_on: "ubuntu-latest"
  steps: [
    run("pnpm install"),
    run("""
      echo "Building..."
      pnpm build
      pnpm test
    """)
  ]
}
```

User feedback: "We control the syntax and have ultimate power" - the user wants us to explore improvements.

This is a **research spike** to investigate potential syntax improvements. **Work MUST pause after ADR creation** for team review and user acceptance before any implementation begins.

## Research Questions

1. **What makes the current syntax cumbersome?**
   - String escaping requirements
   - Triple-quote awkwardness for multi-line commands
   - Verbosity of `run("...")` wrapper
   - Array syntax `[...]` adding noise

2. **What alternatives exist in comparable DSLs?**
   - Terraform HCL heredocs (`<<EOF ... EOF`)
   - Bazel/Starlark shell syntax
   - Just/Makefile approach
   - Nix expression language
   - Pulumi/CDK patterns

3. **What are the constraints we must respect?**
   - Lezer parser capabilities
   - Backward compatibility with existing .workpipe files
   - Error recovery quality
   - VS Code extension implications
   - Expression interpolation (`${{ ... }}`) requirements

## Syntax Candidates to Evaluate

### Candidate A: Block-based steps (no array)
```workpipe
job build {
  runs_on: ubuntu-latest

  step install {
    run: pnpm install
  }

  step build {
    run: |
      echo "Building..."
      pnpm build
      pnpm test
  }
}
```

### Candidate B: Heredoc-style
```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run(<<SH
      pnpm install
    SH),
    run(<<SH
      echo "Building..."
      pnpm build
      pnpm test
    SH)
  ]
}
```

### Candidate C: Implicit shell block
```workpipe
job build {
  runs_on: ubuntu-latest

  shell {
    pnpm install
  }

  shell {
    echo "Building..."
    pnpm build
    pnpm test
  }
}
```

### Candidate D: YAML-style multi-line (pipe operator)
```workpipe
job build {
  runs_on: ubuntu-latest
  steps: [
    run |
      pnpm install
    ,
    run |
      echo "Building..."
      pnpm build
      pnpm test
  ]
}
```

### Candidate E: Semicolon-separated steps without array
```workpipe
job build {
  runs_on: ubuntu-latest

  run("pnpm install");
  run("pnpm build");
  run("pnpm test");
}
```

### Candidate F: Named step blocks
```workpipe
job build {
  runs_on: ubuntu-latest

  step "Install dependencies" {
    pnpm install
  }

  step "Build and test" {
    echo "Building..."
    pnpm build
    pnpm test
  }
}
```

## Acceptance Criteria

- [x] Survey of comparable DSL step/command syntax (minimum 5 examples)
- [x] Evaluation matrix scoring each candidate on:
  - Readability
  - Lezer parseability
  - Backward compatibility
  - Error recovery quality
  - Expression interpolation support
  - Migration complexity
- [x] Draft ADR (ADR-0013) documenting:
  - Current syntax pain points
  - Alternatives considered
  - Recommended approach
  - Migration strategy (if breaking)
  - Decision: ~~Proposed~~ **Accepted** status
- [x] **DECISION POINT**: ADR reviewed and accepted
  - ADR reviewed by team
  - User accepted the proposed direction
  - PM created follow-up implementation work items (WI-091 through WI-095)

## Technical Context

### Current Grammar (from ADR-0003 and packages/lang/src/workpipe.grammar)

The current step syntax uses:
- `StepList` as an array `[ Step, ... ]`
- `RunStep` wrapping a string: `run("...")`
- Triple-quoted strings `"""..."""` supported but only in `guard_js` blocks currently

### Lezer Considerations

- Lezer excels at context-free grammars
- Indentation-sensitive syntax is challenging (possible but complex)
- Need strong error recovery for editor tooling
- Token precedence matters for heredocs vs string literals

### Backward Compatibility

Any change must either:
1. Be purely additive (current syntax continues to work)
2. Provide automated migration tooling
3. Have a deprecation period with clear warnings

### Related ADRs

- ADR-0003: Lezer Grammar Design and Expression Language
- ADR-0007: Cycle Syntax and Guard Block Design (triple-quoted strings)

### Related PROJECT.md Sections

- Section 5: Language Overview (syntax patterns)
- Section 11: Compiler Architecture (grammar strategy)

## Dependencies

None - this is a research spike.

## Output Artifacts

1. Research document with DSL survey
2. Evaluation matrix (can be table in ADR)
3. Draft ADR-0013: Step Syntax Design

## Notes

**This was a DECISION POINT work item.**

The output was ADR-0013, which has been **Accepted**. Implementation work items have been created:

- **WI-091**: Grammar - Steps Block and Shell Keyword
- **WI-092**: AST and Parser Updates
- **WI-093**: Codegen - Indentation Stripping
- **WI-094**: VS Code Extension Updates
- **WI-095**: Documentation and Examples

---

## Final Decision Summary

ADR-0013 was accepted with the following key decisions:

1. **Keyword**: Use `shell` instead of overloading `run`
2. **Brace handling**: Count braces in compiler (no escaping needed)
3. **Indentation**: Strip common prefix when outputting to YAML
4. **Single-line**: `shell { echo hello }` is supported
5. **Uses block**: `uses("action") { with: { ... } }` is also supported
6. **Backward compatibility**: `run("...")` and `uses("...")` remain valid

---

## User Feedback (Verbatim)

> Users report that while WorkPipe's overall syntax is easy to use, writing job steps with shell code in string syntax is cumbersome - even with triple quotes.
>
> "we control the syntax and have ultimate power"
