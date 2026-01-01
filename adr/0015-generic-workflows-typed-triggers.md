# ADR-0015: Generic Workflows with Typed Triggers

**Date**: 2026-01-01
**Status**: Superseded
**Superseded By**: [ADR-0016: Typed Triggers Implementation Plan](0016-typed-triggers-implementation.md)
**Deciders**: Architecture Team

## Supersession Note

This ADR was a research document exploring five options for typed triggers. **Option B (Type Inference from `on:` Clause)** was selected by the user, explicitly without generics syntax. The full implementation plan is documented in [ADR-0016](0016-typed-triggers-implementation.md).

---

## Context

WorkPipe currently treats workflow triggers as untyped event names:

```workpipe
workflow my_workflow {
  on: pull_request

  job example {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ github.event.pull_request.title }}")
    ]
  }
}
```

In this model:
- The trigger is a bare identifier (`pull_request`)
- References to `github.event.*` are unchecked
- Property access like `github.event.pull_request.title` is not validated
- If the trigger changes from `pull_request` to `push`, invalid context references silently break at runtime

### The Problem

GitHub Actions provides richly typed event payloads that vary by trigger type:

| Trigger | Event Payload Type | Key Properties |
|---------|-------------------|----------------|
| `pull_request` | PullRequestEvent | `.pull_request.title`, `.pull_request.number`, `.action` |
| `push` | PushEvent | `.commits[]`, `.head_commit`, `.ref`, `.pusher` |
| `issues` | IssuesEvent | `.issue.title`, `.issue.number`, `.action` |
| `workflow_dispatch` | WorkflowDispatchEvent | `.inputs.*` (user-defined) |
| `schedule` | ScheduleEvent | Minimal payload (cron-triggered) |

Currently, WorkPipe cannot:
1. **Validate context access**: `github.event.pull_request.title` compiles even when the trigger is `push`
2. **Provide IDE support**: No autocomplete for event-specific properties
3. **Catch trigger changes**: Changing `on: pull_request` to `on: push` doesn't warn about now-invalid references
4. **Document contracts**: The event shape is implicit, not explicit

### Design Goals

1. **Trigger-aware type checking**: Validate `github.event.*` access based on the declared trigger
2. **IDE support**: Enable autocomplete for trigger-specific context properties
3. **Compile-time safety**: Catch invalid event access before workflow execution
4. **Multi-trigger workflows**: Handle workflows with multiple triggers gracefully
5. **Backward compatibility**: Existing `on: trigger` syntax must continue to work
6. **Incremental adoption**: Typed triggers are opt-in, not required

### Related Work

This ADR builds on:
- [ADR-0010: Type System for Task/Job Data Flow](0010-type-system-for-data-flow.md) - Primitive type annotations
- [ADR-0011: User-Defined Type Declarations](0011-user-defined-type-declarations.md) - Structural typing model
- [ADR-0003: Lezer Grammar Design](0003-lezer-grammar-design-and-expression-language.md) - Expression parsing

## Design Options

### Option A: Generic Workflow Syntax

**Proposed syntax**:
```workpipe
workflow<pull_request> my_pr_workflow {
  // context.github.event is typed as PullRequestEvent

  job review {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ github.event.pull_request.title }}")  // Valid
      // run("echo ${{ github.event.commits[0] }}")       // Error: property 'commits' does not exist
    ]
  }
}
```

**Multi-trigger variant**:
```workpipe
workflow<pull_request | push> my_workflow {
  // context.github.event is PullRequestEvent | PushEvent
  // Only shared properties are valid without guards

  job build {
    runs_on: ubuntu-latest
    if: github.event_name == "pull_request"
    steps: [
      // Within this job, can access PR-specific properties
      run("echo ${{ github.event.pull_request.title }}")
    ]
  }
}
```

**Characteristics**:
- Type parameter appears in angle brackets after `workflow` keyword
- Replaces the `on:` clause entirely
- Union types for multi-trigger workflows
- Familiar generic syntax from TypeScript/Rust

**Pros**:
- Explicit type annotation at workflow level
- Clean syntax for single-trigger workflows
- Type parameter is visually prominent
- Enables future extensions (custom trigger types, workflow-level generics)

**Cons**:
- Breaks existing `on:` syntax (migration required)
- Angle brackets add parsing complexity
- Multi-trigger union syntax is verbose
- `workflow<pull_request>` reads oddly (workflow parameterized by a trigger?)

### Option B: Typed `on` Clause with Type Inference

**Proposed syntax**:
```workpipe
workflow my_workflow {
  on: pull_request  // Existing syntax, compiler infers event type

  job review {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ github.event.pull_request.title }}")  // Valid - inferred from on: clause
    ]
  }
}
```

**Multi-trigger**:
```workpipe
workflow my_workflow {
  on: [pull_request, push]  // Union type inferred

  job build {
    runs_on: ubuntu-latest
    if: github.event_name == "pull_request"
    steps: [
      // PR-specific access requires conditional narrowing (future)
      run("echo ${{ github.event.pull_request.title }}")  // Warning: may fail on push
    ]
  }
}
```

**Characteristics**:
- No syntax change to `on:` clause
- Compiler infers event type from trigger name
- Built-in type definitions for all GitHub event types
- Validation happens during semantic analysis

**Pros**:
- Fully backward compatible (no syntax change)
- Zero migration effort for existing workflows
- Type checking is automatic
- Simpler grammar (no generics)

**Cons**:
- Less explicit than generic syntax
- Multi-trigger type narrowing is complex
- No way to override inferred type
- Trigger-to-type mapping must be maintained

### Option C: Explicit Context Typing Block

**Proposed syntax**:
```workpipe
workflow my_workflow {
  on: pull_request

  context: PullRequestEvent  // Explicit type assertion

  job review {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ context.event.pull_request.title }}")
    ]
  }
}
```

**Multi-trigger with discriminated union**:
```workpipe
workflow my_workflow {
  on: [pull_request, push]

  context: PullRequestEvent | PushEvent

  job build {
    runs_on: ubuntu-latest
    steps: [
      // Union type access
    ]
  }
}
```

**Characteristics**:
- Separate `context:` block declares the type
- `context` keyword replaces `github` in expressions
- Type can differ from `on:` (escape hatch)

**Pros**:
- Explicit type declaration
- Decoupled from trigger syntax
- Allows custom context types

**Cons**:
- Redundant with `on:` clause (must keep in sync)
- New `context` keyword changes expression syntax
- Verbose for simple cases
- Type-trigger mismatch is error-prone

### Option D: Type-Annotated Triggers

**Proposed syntax**:
```workpipe
workflow my_workflow {
  on: pull_request as PullRequestEvent

  job review {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ github.event.pull_request.title }}")
    ]
  }
}
```

**With auto-inference fallback**:
```workpipe
workflow my_workflow {
  on: pull_request  // Auto-infers PullRequestEvent
  // OR
  on: pull_request as MyCustomPREvent  // Override
}
```

**Characteristics**:
- Trigger and type on same line
- `as` keyword for explicit type annotation
- Auto-inference when type is omitted

**Pros**:
- Trigger and type are co-located
- Optional explicit typing
- Clear override syntax

**Cons**:
- Grammar complexity (`as` in trigger context)
- Custom types unlikely to be useful
- Verbose when auto-inference works

### Option E: Hybrid Approach (Recommended)

**Proposed approach**: Combine Option B (type inference from `on:`) with optional explicit typing.

**Phase 1: Implicit typing (recommended starting point)**
```workpipe
workflow my_workflow {
  on: pull_request  // Compiler infers PullRequestEvent

  job review {
    runs_on: ubuntu-latest
    steps: [
      run("echo ${{ github.event.pull_request.title }}")  // Validated
    ]
  }
}
```

**Phase 2: Explicit generic syntax (future extension)**
```workpipe
// For advanced use cases or custom event types
workflow<CustomEvent> my_workflow {
  on: repository_dispatch
  // ...
}
```

**Rationale for hybrid**:
- Phase 1 covers 95%+ of use cases with zero syntax change
- Phase 2 generic syntax reserved for future needs
- Both phases share the same type infrastructure
- Clean migration path from Phase 1 to Phase 2

## Recommended Approach: Option B with Future Option A Extension

**Primary decision**: Implement **Option B (Type Inference from `on:` Clause)** as the foundation.

**Rationale**:

1. **Zero migration cost**: All existing workflows work unchanged
2. **Immediate value**: Type checking activates without user action
3. **Simpler implementation**: No grammar changes for Phase 1
4. **Future extensibility**: Generic syntax can be added later if needed
5. **Aligns with WorkPipe philosophy**: Convention over configuration

### Implementation Details

#### 1. Built-in Trigger Type Definitions

The compiler will include built-in type definitions for all GitHub event types:

```typescript
// packages/compiler/src/builtins/github-events.ts

export const GITHUB_EVENT_TYPES = {
  pull_request: {
    kind: "object",
    properties: {
      action: { type: "string" },
      number: { type: "int" },
      pull_request: {
        kind: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          number: { type: "int" },
          state: { type: "string" },
          draft: { type: "bool" },
          head: {
            kind: "object",
            properties: {
              ref: { type: "string" },
              sha: { type: "string" },
              // ...
            }
          },
          base: {
            kind: "object",
            properties: {
              ref: { type: "string" },
              sha: { type: "string" },
              // ...
            }
          },
          user: {
            kind: "object",
            properties: {
              login: { type: "string" },
              id: { type: "int" },
              // ...
            }
          },
          labels: {
            kind: "array",
            element: {
              kind: "object",
              properties: {
                name: { type: "string" },
                color: { type: "string" }
              }
            }
          },
          // ... comprehensive properties
        }
      },
      repository: { /* ... */ },
      sender: { /* ... */ }
    }
  },

  push: {
    kind: "object",
    properties: {
      ref: { type: "string" },
      before: { type: "string" },
      after: { type: "string" },
      commits: {
        kind: "array",
        element: {
          kind: "object",
          properties: {
            id: { type: "string" },
            message: { type: "string" },
            author: { /* ... */ },
            // ...
          }
        }
      },
      head_commit: { /* ... */ },
      pusher: { /* ... */ },
      repository: { /* ... */ },
      sender: { /* ... */ }
    }
  },

  issues: {
    kind: "object",
    properties: {
      action: { type: "string" },
      issue: {
        kind: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          number: { type: "int" },
          state: { type: "string" },
          labels: { /* ... */ },
          assignees: { /* ... */ },
          // ...
        }
      },
      repository: { /* ... */ },
      sender: { /* ... */ }
    }
  },

  workflow_dispatch: {
    kind: "object",
    properties: {
      inputs: { kind: "any" },  // User-defined, see below
      ref: { type: "string" },
      repository: { /* ... */ },
      sender: { /* ... */ }
    }
  },

  schedule: {
    kind: "object",
    properties: {
      // Minimal payload for cron-triggered runs
    }
  },

  // ... all other GitHub event types
} as const;
```

**Source of truth**: These types are derived from the [GitHub Webhooks documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads).

**Maintenance strategy**:
- Built-in types are bundled with the compiler
- Major GitHub API changes require compiler updates
- Users can file issues when types are incomplete
- Consider auto-generation from GitHub's OpenAPI specs

#### 2. GitHub Context Type Hierarchy

The full `github` context object has both static and event-dependent properties:

```typescript
// packages/compiler/src/builtins/github-context.ts

interface GitHubContextType<E extends EventType> {
  // Static properties (always available)
  action: string;
  actor: string;
  actor_id: string;
  api_url: string;
  base_ref: string | null;  // Only for PR events
  event_name: string;
  graphql_url: string;
  head_ref: string | null;  // Only for PR events
  job: string;
  ref: string;
  ref_name: string;
  ref_protected: bool;
  ref_type: "branch" | "tag";
  repository: string;
  repository_id: string;
  repository_owner: string;
  repository_owner_id: string;
  repositoryUrl: string;
  retention_days: string;
  run_attempt: string;
  run_id: string;
  run_number: string;
  server_url: string;
  sha: string;
  token: string;
  triggering_actor: string;
  workflow: string;
  workflow_ref: string;
  workflow_sha: string;
  workspace: string;

  // Event-dependent property
  event: E;
}
```

**Key insight**: `github.event` is the polymorphic property. All other `github.*` properties are static.

#### 3. Expression Type Checking Integration

Extend the existing expression type checker (from WI-063) to handle context access:

```typescript
// packages/compiler/src/semantics/expression-typechecker.ts

function checkPropertyAccess(
  node: PropertyAccessNode,
  ctx: TypeCheckContext
): Type {
  const path = node.path;  // e.g., ["github", "event", "pull_request", "title"]

  if (path[0] === "github") {
    if (path[1] === "event") {
      // Get event type from workflow trigger
      const eventType = ctx.workflowEventType;  // Inferred from on: clause

      // Traverse the event type structure
      return traverseType(eventType, path.slice(2));
    } else {
      // Static github.* property
      return lookupGitHubProperty(path.slice(1));
    }
  }

  // ... existing logic for needs.*, inputs.*, etc.
}
```

**Diagnostic integration**:
```
error[WP2020]: Property 'commits' does not exist on type 'PullRequestEvent'
  --> ci.workpipe:10:25
   |
10 |       run("echo ${{ github.event.commits[0].message }}")
   |                     ^^^^^^^^^^^^^^^^^^^^ 'commits' is not available for pull_request events
   |
   = note: workflow trigger is 'pull_request' which provides 'PullRequestEvent'
   = hint: use 'github.event.pull_request.commits_url' to fetch commits via API
```

#### 4. Multi-Trigger Handling

When a workflow has multiple triggers, the event type is a union:

```workpipe
workflow my_workflow {
  on: [pull_request, push]

  job build {
    runs_on: ubuntu-latest
    steps: [
      // github.event is PullRequestEvent | PushEvent
      run("echo ${{ github.event.action }}")  // Error: 'action' not on PushEvent
    ]
  }
}
```

**Union type behavior**:
- Only properties common to ALL event types are accessible without guards
- Properties unique to one event type produce a warning (not error)
- Future: type narrowing with `if: github.event_name == "..."` guards

**Diagnostic for union access**:
```
warning[WP2021]: Property 'action' may not exist for all triggers
  --> ci.workpipe:8:25
   |
 8 |       run("echo ${{ github.event.action }}")
   |                     ^^^^^^^^^^^^^^^^^^^
   |
   = note: workflow triggers are [pull_request, push]
   = note: 'action' exists on: pull_request
   = note: 'action' does not exist on: push
   = hint: add a condition to check github.event_name before accessing
```

#### 5. Workflow Dispatch Input Typing

`workflow_dispatch` events have user-defined inputs. These should integrate with the existing inputs type system:

```workpipe
workflow my_workflow {
  on: workflow_dispatch

  inputs: {
    environment: string
    debug_mode: bool = false
  }

  job deploy {
    runs_on: ubuntu-latest
    steps: [
      // github.event.inputs.environment is typed
      run("echo ${{ github.event.inputs.environment }}")
    ]
  }
}
```

**Implementation**: When trigger includes `workflow_dispatch`, the `github.event.inputs` type is derived from the workflow's `inputs:` block.

#### 6. Grammar Changes (None for Phase 1)

Phase 1 requires **no grammar changes**. The `on:` clause syntax remains unchanged:

```lezer
// Existing grammar - unchanged
OnClause {
  kw<"on"> ":" TriggerSpec
}

TriggerSpec {
  EventName |
  "[" EventList "]"
}
```

The trigger name is resolved to a type during semantic analysis, not parsing.

#### 7. Future: Generic Workflow Syntax (Phase 2)

If explicit typing proves necessary, add generic syntax:

```lezer
// Phase 2 grammar addition
WorkflowDecl {
  kw<"workflow"> TypeParams? Identifier "{" WorkflowBody "}"
}

TypeParams {
  "<" TypeParamList ">"
}

TypeParamList {
  TypeParam ("|" TypeParam)*
}

TypeParam {
  identifier
}
```

**When to implement Phase 2**:
- Custom event types for enterprise GitHub
- `repository_dispatch` with typed payloads
- Shared workflow templates with type parameters
- Community demand for explicit typing

### Diagnostic Codes

New diagnostic codes for trigger type checking:

| Code | Severity | Message Template |
|------|----------|------------------|
| WP2020 | Error | Property '{prop}' does not exist on type '{event_type}' |
| WP2021 | Warning | Property '{prop}' may not exist for all triggers |
| WP2022 | Info | Event type '{type}' inferred from trigger '{trigger}' |
| WP2023 | Error | Unknown trigger '{trigger}' - cannot determine event type |
| WP2024 | Warning | Property '{prop}' only available with specific action values |

### VS Code Extension Updates

The VS Code extension will need updates:

1. **Autocomplete for `github.event.*`**:
   - Parse the `on:` clause to determine trigger(s)
   - Provide completion items for event-specific properties
   - Show type information in completion details

2. **Hover information**:
   - Show inferred event type when hovering over `github.event`
   - Show property type for nested access

3. **Go-to-definition** (stretch goal):
   - Navigate to built-in type definitions
   - Show type structure in peek window

## Alternatives Considered

### Alternative 1: Runtime Type Guards Only

**Approach**: No compile-time type checking. Users add runtime guards.

```workpipe
workflow my_workflow {
  on: push

  job example {
    if: github.event.commits != null
    steps: [
      run("echo ${{ github.event.commits[0].message }}")
    ]
  }
}
```

**Rejected because**:
- Errors still surface at runtime
- No IDE support for valid properties
- Boilerplate guards obscure intent
- WorkPipe's value proposition is compile-time safety

### Alternative 2: TypeScript-Style Type Assertions

**Approach**: Users assert types with `as` keyword.

```workpipe
job example {
  steps: [
    run("echo ${{ (github.event as PullRequestEvent).pull_request.title }}")
  ]
}
```

**Rejected because**:
- Verbose and clutters expressions
- Assertions bypass validation (defeat purpose)
- Not discoverable for new users
- Grammar impact for expressions

### Alternative 3: Separate Type Definition Files

**Approach**: Ship `.d.workpipe` files like TypeScript `.d.ts`.

```workpipe
// github-events.d.workpipe
type PullRequestEvent {
  pull_request: { ... }
}
```

**Rejected because**:
- Adds file management overhead
- Built-in types change rarely
- Users rarely need to customize event types
- Simpler to bundle with compiler

### Alternative 4: No Type Checking for Events

**Approach**: Continue treating `github.event.*` as unchecked.

**Rejected because**:
- User feedback explicitly requested event typing
- Common source of runtime errors
- IDE support impossible without types
- Misses significant compile-time value

## Consequences

### Positive

1. **Compile-time safety**: Invalid event property access caught before runtime
2. **IDE support**: Autocomplete and hover for `github.event.*` properties
3. **Self-documenting**: Event type is explicit from trigger
4. **Zero migration**: Existing workflows gain type checking automatically
5. **Familiar model**: Works like TypeScript inference
6. **Future extensibility**: Generic syntax can be added if needed

### Negative

1. **Built-in type maintenance**: GitHub API changes require compiler updates
2. **Incomplete coverage**: Custom/enterprise events may lack types
3. **Union complexity**: Multi-trigger workflows have less precise typing
4. **No type narrowing**: Conditional access requires future work
5. **Expression complexity**: Type inference adds semantic analysis work

### Neutral

1. **No grammar change for Phase 1**: Implementation is semantic-only
2. **Backward compatible**: All existing workflows compile unchanged
3. **Optional precision**: Users can ignore warnings if desired
4. **Incremental rollout**: Start with common events, expand coverage

## Implementation Roadmap

### Phase 1: Foundation (Recommended Starting Point)

**Objective**: Implement type inference for single-trigger workflows.

**Work Items**:
1. Define built-in event types for common triggers (push, pull_request, issues, workflow_dispatch, schedule)
2. Build trigger-to-type mapping
3. Extend expression type checker to handle `github.event.*`
4. Implement WP2020, WP2023 diagnostics
5. Add compiler tests for event property validation

**Estimated Scope**: 2-3 weeks

### Phase 2: Multi-Trigger Support

**Objective**: Handle union types for workflows with multiple triggers.

**Work Items**:
1. Implement union type construction from trigger list
2. Add intersection-based property access for unions
3. Implement WP2021 warning for union-unsafe access
4. Add tests for multi-trigger scenarios

**Estimated Scope**: 1-2 weeks

### Phase 3: Comprehensive Event Coverage

**Objective**: Add type definitions for all GitHub event types.

**Work Items**:
1. Define remaining event types (release, deployment, check_run, etc.)
2. Document type definitions
3. Consider auto-generation from GitHub OpenAPI specs

**Estimated Scope**: 1 week

### Phase 4: VS Code Integration

**Objective**: IDE support for event properties.

**Work Items**:
1. Autocomplete for `github.event.*` properties
2. Hover information showing types
3. Diagnostic display for event type errors

**Estimated Scope**: 1-2 weeks

### Phase 5 (Future): Generic Workflow Syntax

**Objective**: Add explicit type parameter syntax.

**Trigger for Phase 5**: Clear user demand for:
- Custom event types
- Workflow templates with type parameters
- Override of inferred types

**Work Items**:
1. Grammar extension for `workflow<T>`
2. Parser updates
3. Semantic analysis for explicit type parameters
4. Migration guide from inferred to explicit

**Estimated Scope**: 2-3 weeks (when needed)

### Phase 6 (Future): Type Narrowing

**Objective**: Narrow union types within conditional blocks.

```workpipe
workflow my_workflow {
  on: [pull_request, push]

  job build {
    if: github.event_name == "pull_request"
    // Inside this job, github.event is narrowed to PullRequestEvent
    steps: [
      run("echo ${{ github.event.pull_request.title }}")  // Valid!
    ]
  }
}
```

**Trigger for Phase 6**: User demand for precise multi-trigger handling

**Estimated Scope**: 2-3 weeks (when needed)

## References

- [GitHub Actions: Contexts](https://docs.github.com/en/actions/learn-github-actions/contexts) - The `github` context structure
- [GitHub Webhooks: Event Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - Complete event type reference
- [ADR-0010: Type System for Task/Job Data Flow](0010-type-system-for-data-flow.md) - Foundation type system
- [ADR-0011: User-Defined Type Declarations](0011-user-defined-type-declarations.md) - Structural typing model
- [ADR-0003: Lezer Grammar Design](0003-lezer-grammar-design-and-expression-language.md) - Expression language design
- [WI-063: Expression Type Checking](../work_items/WI-063-expression-type-checking.md) - Expression type checker implementation
- PROJECT.md Section 5: Language overview
