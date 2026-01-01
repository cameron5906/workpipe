# Fragment System - Importable Jobs/Step Sequences

**ID**: WI-106
**Status**: In Progress
**Priority**: P1-High
**Milestone**: H (Fragment System)
**Created**: 2026-01-01
**Updated**: 2026-01-01

## ADR Status

ADR-0014 (Fragment System Design) has been created and is **Proposed**. The ADR documents:
- Two fragment types: `job_fragment` and `steps_fragment`
- Parameter syntax with typed parameters and defaults
- Instantiation syntax (`job x = fragment {}` and `...fragment {}`)
- Import integration with existing system (ADR-0012)
- 8 implementation phases
- Diagnostic codes WP9001-WP9009
- Alternatives considered and rejected

**Note**: ADR should be marked as **Accepted** after tech lead review.

## Current Progress

### Phase 0: ADR Creation
- [x] Create ADR-0014 documenting fragment system design decisions (2026-01-01)

### Phase 1: Grammar and AST (In Progress)
- [ ] Grammar: Add `JobFragmentDecl` and `StepsFragmentDecl` productions
- [ ] Grammar: Add `ParamsBlock` and `ParamDecl` productions
- [ ] Grammar: Add `FragmentInstantiation` syntax (`job x = fragment {}`)
- [ ] Grammar: Add `StepsFragmentSpread` syntax (`...fragment {}`)
- [ ] Grammar: Reserve `job_fragment`, `steps_fragment`, `params` keywords
- [ ] AST: Add `JobFragmentNode` and `StepsFragmentNode` types
- [ ] AST: Add `ParamDeclarationNode` type
- [ ] AST: Add `JobFragmentInstantiationNode` type
- [ ] AST: Add `StepsFragmentSpreadNode` type
- [ ] AST: Add `ParamArgumentNode` type
- [ ] AST: Update `WorkPipeFileNode` with `jobFragments` and `stepsFragments` arrays
- [ ] Builder: Implement `buildJobFragment()` function
- [ ] Builder: Implement `buildStepsFragment()` function
- [ ] Builder: Implement `buildParamsBlock()` function
- [ ] Builder: Implement `buildFragmentInstantiation()` function
- [ ] Builder: Implement `buildStepsFragmentSpread()` function
- [ ] Tests: Grammar tests for fragment declarations
- [ ] Tests: Grammar tests for fragment instantiation
- [ ] Tests: AST builder tests for all new node types

## Description

Implement a fragment system that enables importable, reusable jobs and step sequences. This is a major feature enhancement that introduces `job_fragment` and `steps_fragment` constructs for composable workflow components.

### Key Concepts

- **job_fragment**: A complete reusable job definition that can be instantiated with parameters
- **steps_fragment**: A reusable step sequence that can be spread into any job's steps block

### Design Decisions (from Architect)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Naming | `fragment` | Neutral term that implies composability without overloading existing concepts |
| Fragment types | Two: `job_fragment` and `steps_fragment` | Jobs need full job semantics; step sequences need spread semantics |
| Import syntax | `import { name } from "path"` | Reuses existing import pattern from Milestone F |
| Parameterization | `params { }` block | Typed parameters with optional defaults |
| Job instantiation | `job name = fragment_name { params }` | Clear assignment syntax |
| Steps instantiation | `...fragment_name { params }` | Spread syntax (familiar from JS/TS) |
| Code generation | Inline expansion | Not composite actions; fragments expand at compile time |

## Proposed Syntax

### Job Fragment Definition

```workpipe
job_fragment deploy_to_env {
  params {
    environment: string
    registry: string = "ghcr.io"
  }

  runs_on: ubuntu-latest
  environment: ${{ params.environment }}

  steps {
    shell {
      echo "Deploying to ${{ params.environment }}"
      docker push ${{ params.registry }}/app:latest
    }
  }
}
```

### Steps Fragment Definition

```workpipe
steps_fragment checkout_and_setup {
  params {
    node_version: string = "20"
  }

  uses("actions/checkout@v4") {}
  uses("actions/setup-node@v4") {
    with: {
      node-version: ${{ params.node_version }}
    }
  }
  shell { npm ci }
}
```

### Fragment Usage

```workpipe
import { deploy_to_env, checkout_and_setup } from "./fragments.workpipe"

workflow ci {
  on: push

  // Instantiate job fragment
  job staging = deploy_to_env {
    environment: "staging"
  }

  job production = deploy_to_env {
    environment: "production"
    registry: "ecr.aws"
  }

  job build {
    runs_on: ubuntu-latest
    steps {
      // Spread steps fragment
      ...checkout_and_setup { node_version: "18" }
      shell { npm run build }
    }
  }
}
```

## Implementation Phases

### Phase 1: Core Fragment Support
- [ ] Extend grammar with `job_fragment` and `steps_fragment` productions
- [ ] Add `JobFragmentNode` and `StepsFragmentNode` to AST
- [ ] Implement `params { }` block parsing with typed parameters
- [ ] Add fragment registry for same-file resolution
- [ ] Implement job fragment instantiation (`job x = fragment {}`)
- [ ] Implement steps fragment spread (`...fragment {}`)
- [ ] Basic parameter substitution in codegen

### Phase 2: Import Integration
- [ ] Extend import system to resolve fragment symbols
- [ ] Cross-file fragment imports
- [ ] Fragment visibility and export semantics
- [ ] Circular dependency detection for fragments

### Phase 3: Advanced Features
- [ ] Default parameter values
- [ ] Typed parameter validation (WP diagnostics)
- [ ] Parameter type inference from usage
- [ ] Fragment composition (fragment using another fragment)
- [ ] Override semantics for job fragments (e.g., override runs_on)

### Phase 4: Polish
- [ ] Comprehensive diagnostics (undefined fragment, missing required param, etc.)
- [ ] VS Code extension support (hover, go-to-definition, completions)
- [ ] Documentation and examples
- [ ] Migration guide from raw YAML reusable workflows

## New Diagnostics (Proposed)

| Code | Severity | Description |
|------|----------|-------------|
| WP9001 | Error | Undefined fragment reference |
| WP9002 | Error | Missing required fragment parameter |
| WP9003 | Error | Unknown fragment parameter |
| WP9004 | Error | Parameter type mismatch |
| WP9005 | Warning | Duplicate fragment definition |
| WP9006 | Error | Circular fragment reference |

## Acceptance Criteria

- [ ] Grammar supports `job_fragment` and `steps_fragment` declarations
- [ ] Fragments can be defined and used within the same file
- [ ] Fragments can be imported from other files
- [ ] Parameters work with types and defaults
- [ ] Job fragments instantiate with `job x = fragment {}`
- [ ] Steps fragments spread with `...fragment {}`
- [ ] Code generation inlines fragment content (no composite actions)
- [ ] All new diagnostics implemented and documented
- [ ] VS Code extension provides hover/completions for fragments
- [ ] Documentation covers all fragment patterns
- [ ] Examples demonstrate fragment usage patterns

## Technical Context

**Requires**: ADR-0014 (Fragment System Design) - to be created before implementation

**Dependencies**:
- Import system (Milestone F) - complete
- Step syntax (Milestone G) - complete
- Type system (Milestone A++) - complete

**Related**:
- WI-105 (Examples Overhaul) should showcase fragments once implemented
- This feature provides the "composability story" that makes examples more impressive

## Dependencies

- ADR-0014 must be created and accepted before Phase 1 begins
- No blocking dependencies on other work items

## Notes

- This is a P1-High feature because WI-105 (Examples Overhaul) depends on having impressive features to showcase
- WI-105 priority adjusted: should wait for fragment system before proceeding
- Fragment system is the "composability story" that will make WorkPipe examples truly impressive
- Code generation uses inline expansion, NOT GitHub composite actions (keeps all logic visible in generated YAML)
- Spread syntax (`...fragment`) chosen for familiarity with JavaScript/TypeScript developers
