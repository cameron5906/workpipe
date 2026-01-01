# ADR-0016: Typed Triggers Implementation Plan

**Date**: 2026-01-01
**Status**: Accepted
**Deciders**: Architecture Team, User Approval
**Supersedes**: N/A
**References**: [ADR-0015](0015-generic-workflows-typed-triggers.md) (research)

## Context

ADR-0015 researched five options for adding trigger-aware type checking to WorkPipe. The user has approved **Option B: Type Inference from `on:` Clause** with an explicit requirement: **no generics syntax**.

This means:
- The `workflow` keyword stays as-is (no `workflow<push>` syntax)
- The compiler infers the event type from the `on:` clause
- `github.event.*` expressions receive compile-time validation
- VS Code provides autocomplete and hover support for event properties

This ADR provides the **complete implementation plan** for Option B.

### Why Option B

Option B was selected because:

1. **Zero syntax change**: Existing workflows compile unchanged
2. **Zero migration cost**: Type checking activates automatically
3. **No grammar modifications**: Implementation is purely semantic
4. **Aligns with WorkPipe philosophy**: Convention over configuration
5. **Simpler than generics**: No angle brackets, no type parameters

The user explicitly rejected the generic syntax (`workflow<push>`) as unnecessary complexity for the 95%+ use case of single-trigger workflows.

## Decision

Implement trigger-aware type checking through five phases:

1. **Phase 1**: Built-in event type definitions
2. **Phase 2**: Type inference from `on:` clause
3. **Phase 3**: Expression type checker integration for `github.event.*`
4. **Phase 4**: VS Code autocomplete and hover support
5. **Phase 5**: Multi-trigger union type handling

Each phase is independently deliverable and testable.

---

## Phase 1: Built-in Event Type Definitions

### Objective

Define TypeScript representations of GitHub event payloads that the compiler can use for property validation.

### Deliverables

1. New file: `packages/compiler/src/builtins/github-events.ts`
2. Event type definitions for common triggers
3. Shared context type definitions
4. Type lookup utilities

### Technical Design

#### Event Type Schema

Event types are represented as a nested structure matching GitHub's webhook payloads:

```typescript
// packages/compiler/src/builtins/github-events.ts

export interface EventPropertyType {
  readonly kind: "primitive" | "object" | "array" | "any";
}

export interface PrimitivePropertyType extends EventPropertyType {
  readonly kind: "primitive";
  readonly type: "string" | "int" | "bool";
}

export interface ObjectPropertyType extends EventPropertyType {
  readonly kind: "object";
  readonly properties: ReadonlyMap<string, EventPropertyType>;
}

export interface ArrayPropertyType extends EventPropertyType {
  readonly kind: "array";
  readonly element: EventPropertyType;
}

export interface AnyPropertyType extends EventPropertyType {
  readonly kind: "any"; // For workflow_dispatch.inputs before schema integration
}

export type EventType = ObjectPropertyType;
```

#### Initial Event Coverage (Phase 1)

Start with the five most common triggers:

| Trigger | Priority | Rationale |
|---------|----------|-----------|
| `push` | P0 | Most common trigger |
| `pull_request` | P0 | Most common trigger |
| `workflow_dispatch` | P0 | Manual triggering |
| `schedule` | P1 | Cron jobs |
| `issues` | P1 | Issue automation |

Additional events added in Phase 3 as comprehensive coverage.

#### Event Type Definitions

```typescript
// packages/compiler/src/builtins/github-events.ts

const STRING: PrimitivePropertyType = { kind: "primitive", type: "string" };
const INT: PrimitivePropertyType = { kind: "primitive", type: "int" };
const BOOL: PrimitivePropertyType = { kind: "primitive", type: "bool" };
const ANY: AnyPropertyType = { kind: "any" };

function obj(props: Record<string, EventPropertyType>): ObjectPropertyType {
  return { kind: "object", properties: new Map(Object.entries(props)) };
}

function arr(element: EventPropertyType): ArrayPropertyType {
  return { kind: "array", element };
}

// Shared sub-types used across events
const USER_TYPE = obj({
  login: STRING,
  id: INT,
  avatar_url: STRING,
  url: STRING,
  html_url: STRING,
  type: STRING,
});

const REPOSITORY_TYPE = obj({
  id: INT,
  name: STRING,
  full_name: STRING,
  private: BOOL,
  owner: USER_TYPE,
  html_url: STRING,
  description: STRING,
  fork: BOOL,
  default_branch: STRING,
});

const COMMIT_TYPE = obj({
  id: STRING,
  message: STRING,
  timestamp: STRING,
  author: obj({ name: STRING, email: STRING }),
  committer: obj({ name: STRING, email: STRING }),
  url: STRING,
  distinct: BOOL,
  added: arr(STRING),
  removed: arr(STRING),
  modified: arr(STRING),
});

const LABEL_TYPE = obj({
  id: INT,
  name: STRING,
  color: STRING,
  description: STRING,
  default: BOOL,
});

// Event definitions
export const GITHUB_EVENT_TYPES: ReadonlyMap<string, EventType> = new Map([
  ["push", obj({
    ref: STRING,
    before: STRING,
    after: STRING,
    repository: REPOSITORY_TYPE,
    pusher: obj({ name: STRING, email: STRING }),
    sender: USER_TYPE,
    created: BOOL,
    deleted: BOOL,
    forced: BOOL,
    compare: STRING,
    commits: arr(COMMIT_TYPE),
    head_commit: COMMIT_TYPE,
  })],

  ["pull_request", obj({
    action: STRING,
    number: INT,
    pull_request: obj({
      id: INT,
      number: INT,
      state: STRING,
      locked: BOOL,
      title: STRING,
      body: STRING,
      draft: BOOL,
      merged: BOOL,
      mergeable: BOOL,
      mergeable_state: STRING,
      user: USER_TYPE,
      labels: arr(LABEL_TYPE),
      head: obj({
        ref: STRING,
        sha: STRING,
        repo: REPOSITORY_TYPE,
        user: USER_TYPE,
      }),
      base: obj({
        ref: STRING,
        sha: STRING,
        repo: REPOSITORY_TYPE,
        user: USER_TYPE,
      }),
      html_url: STRING,
      diff_url: STRING,
      commits: INT,
      additions: INT,
      deletions: INT,
      changed_files: INT,
    }),
    repository: REPOSITORY_TYPE,
    sender: USER_TYPE,
  })],

  ["workflow_dispatch", obj({
    inputs: ANY, // Typed from workflow inputs block in Phase 2
    ref: STRING,
    repository: REPOSITORY_TYPE,
    sender: USER_TYPE,
  })],

  ["schedule", obj({
    schedule: STRING,
    repository: REPOSITORY_TYPE,
    sender: USER_TYPE,
  })],

  ["issues", obj({
    action: STRING,
    issue: obj({
      id: INT,
      number: INT,
      title: STRING,
      body: STRING,
      state: STRING,
      locked: BOOL,
      user: USER_TYPE,
      labels: arr(LABEL_TYPE),
      assignees: arr(USER_TYPE),
      comments: INT,
      created_at: STRING,
      updated_at: STRING,
      closed_at: STRING,
      html_url: STRING,
    }),
    repository: REPOSITORY_TYPE,
    sender: USER_TYPE,
  })],
]);

export function getEventType(triggerName: string): EventType | undefined {
  return GITHUB_EVENT_TYPES.get(triggerName);
}
```

#### GitHub Context Static Properties

The `github` context has static properties available regardless of trigger:

```typescript
// packages/compiler/src/builtins/github-context.ts

export const GITHUB_CONTEXT_STATIC_PROPERTIES: ReadonlyMap<string, EventPropertyType> = new Map([
  ["action", STRING],
  ["actor", STRING],
  ["actor_id", STRING],
  ["api_url", STRING],
  ["base_ref", STRING], // Only for PR/push events, but always "available"
  ["event_name", STRING],
  ["graphql_url", STRING],
  ["head_ref", STRING], // Only for PR/push events
  ["job", STRING],
  ["ref", STRING],
  ["ref_name", STRING],
  ["ref_protected", BOOL],
  ["ref_type", STRING],
  ["repository", STRING],
  ["repository_id", STRING],
  ["repository_owner", STRING],
  ["repository_owner_id", STRING],
  ["repositoryUrl", STRING],
  ["retention_days", STRING],
  ["run_attempt", STRING],
  ["run_id", STRING],
  ["run_number", STRING],
  ["server_url", STRING],
  ["sha", STRING],
  ["token", STRING],
  ["triggering_actor", STRING],
  ["workflow", STRING],
  ["workflow_ref", STRING],
  ["workflow_sha", STRING],
  ["workspace", STRING],
  // "event" is handled specially - its type depends on trigger
]);

export function getStaticContextProperty(name: string): EventPropertyType | undefined {
  return GITHUB_CONTEXT_STATIC_PROPERTIES.get(name);
}
```

### File Locations

| File | Purpose |
|------|---------|
| `packages/compiler/src/builtins/github-events.ts` | Event type definitions |
| `packages/compiler/src/builtins/github-context.ts` | Static context properties |
| `packages/compiler/src/builtins/index.ts` | Public exports |

### Test Strategy

```typescript
// packages/compiler/src/__tests__/github-events.test.ts

describe("GitHub event types", () => {
  it("provides push event type", () => {
    const pushType = getEventType("push");
    expect(pushType).toBeDefined();
    expect(pushType?.properties.get("ref")).toEqual({ kind: "primitive", type: "string" });
    expect(pushType?.properties.get("commits")).toBeDefined();
  });

  it("provides pull_request event type with nested properties", () => {
    const prType = getEventType("pull_request");
    expect(prType).toBeDefined();
    const pr = prType?.properties.get("pull_request") as ObjectPropertyType;
    expect(pr.properties.get("title")).toEqual({ kind: "primitive", type: "string" });
    expect(pr.properties.get("number")).toEqual({ kind: "primitive", type: "int" });
  });

  it("returns undefined for unknown trigger", () => {
    expect(getEventType("unknown_event")).toBeUndefined();
  });
});
```

---

## Phase 2: Type Inference from `on:` Clause

### Objective

Extract the trigger type from the workflow's `on:` clause during semantic analysis and make it available to the expression type checker.

### Deliverables

1. Extend `WorkflowNode` AST with inferred event type
2. Build trigger-to-event-type resolution during semantic analysis
3. Store resolved event type in analysis context

### Technical Design

#### AST Extension

The `WorkflowNode` is extended to store the inferred event type:

```typescript
// packages/compiler/src/ast/types.ts (modification)

export interface WorkflowNode {
  readonly kind: "workflow";
  readonly name: string;
  readonly triggers: readonly string[];
  readonly jobs: readonly AnyJobNode[];
  readonly cycles: readonly CycleNode[];
  readonly inputs: readonly InputDeclaration[];
  readonly span: Span;
  // NEW: Inferred from on: clause
  readonly inferredEventType?: EventType | UnionEventType;
}

// For multi-trigger workflows
export interface UnionEventType {
  readonly kind: "union";
  readonly members: readonly { trigger: string; type: EventType }[];
}
```

#### Semantic Analysis Extension

During semantic analysis, resolve trigger names to event types:

```typescript
// packages/compiler/src/semantics/trigger-resolver.ts

import { getEventType, type EventType } from "../builtins/github-events.js";
import type { Diagnostic } from "../diagnostic/index.js";
import { semanticError } from "../diagnostic/index.js";

export interface TriggerResolutionResult {
  readonly eventType: EventType | UnionEventType | null;
  readonly diagnostics: Diagnostic[];
}

export function resolveTriggerTypes(
  triggers: readonly string[],
  triggerSpan: Span
): TriggerResolutionResult {
  const diagnostics: Diagnostic[] = [];
  const resolvedMembers: { trigger: string; type: EventType }[] = [];

  for (const trigger of triggers) {
    const eventType = getEventType(trigger);

    if (!eventType) {
      diagnostics.push(
        semanticError(
          "WP2023",
          `Unknown trigger '${trigger}' - cannot determine event type`,
          triggerSpan,
          `Known triggers: push, pull_request, workflow_dispatch, schedule, issues, ...`
        )
      );
      continue;
    }

    resolvedMembers.push({ trigger, type: eventType });
  }

  if (resolvedMembers.length === 0) {
    return { eventType: null, diagnostics };
  }

  if (resolvedMembers.length === 1) {
    return { eventType: resolvedMembers[0].type, diagnostics };
  }

  return {
    eventType: { kind: "union", members: resolvedMembers },
    diagnostics,
  };
}
```

#### TypeContext Extension

Extend `TypeContext` to include the workflow's inferred event type:

```typescript
// packages/compiler/src/semantics/expression-types.ts (modification)

export interface TypeContext {
  readonly jobOutputs: Map<string, Map<string, OutputDeclaration>>;
  readonly typeRegistry?: TypeRegistry;
  // NEW: Event type inferred from on: clause
  readonly workflowEventType?: EventType | UnionEventType;
}
```

### File Locations

| File | Change Type | Purpose |
|------|-------------|---------|
| `packages/compiler/src/ast/types.ts` | Modify | Add `inferredEventType` to `WorkflowNode` |
| `packages/compiler/src/semantics/trigger-resolver.ts` | New | Trigger-to-type resolution |
| `packages/compiler/src/semantics/expression-types.ts` | Modify | Extend `TypeContext` |
| `packages/compiler/src/ast/builder.ts` | Modify | Populate `inferredEventType` during AST construction |

### Test Strategy

```typescript
// packages/compiler/src/__tests__/trigger-resolver.test.ts

describe("Trigger resolution", () => {
  it("resolves single trigger to event type", () => {
    const result = resolveTriggerTypes(["push"], mockSpan);
    expect(result.eventType).toBeDefined();
    expect(result.eventType?.kind).not.toBe("union");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("resolves multiple triggers to union type", () => {
    const result = resolveTriggerTypes(["push", "pull_request"], mockSpan);
    expect(result.eventType?.kind).toBe("union");
    expect((result.eventType as UnionEventType).members).toHaveLength(2);
  });

  it("emits WP2023 for unknown trigger", () => {
    const result = resolveTriggerTypes(["unknown_event"], mockSpan);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("WP2023");
  });
});
```

---

## Phase 3: Expression Type Checker Integration

### Objective

Extend the expression type checker to validate `github.event.*` property access against the inferred event type.

### Deliverables

1. Property traversal for `github.event.*` expressions
2. New diagnostics (WP2020, WP2022)
3. Integration with existing expression validation pipeline

### Technical Design

#### Property Access Validation

Extend the existing `checkPropertyAccess` function to handle `github.event`:

```typescript
// packages/compiler/src/semantics/expression-types.ts (modification)

export function checkPropertyAccess(
  path: readonly string[],
  span: Span,
  context: TypeContext
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Handle github.event.* access
  if (path[0] === "github" && path[1] === "event" && path.length > 2) {
    diagnostics.push(...checkGitHubEventAccess(path.slice(2), span, context));
    return diagnostics;
  }

  // Handle github.* static property access
  if (path[0] === "github" && path.length >= 2) {
    const staticProp = getStaticContextProperty(path[1]);
    if (!staticProp && path[1] !== "event") {
      diagnostics.push(
        semanticError(
          "WP2020",
          `Property '${path[1]}' does not exist on github context`,
          span,
          `Available properties: ${Array.from(GITHUB_CONTEXT_STATIC_PROPERTIES.keys()).join(", ")}, event`
        )
      );
    }
    return diagnostics;
  }

  // Existing needs.*.outputs.* handling...
  if (path.length >= 4 && path[0] === "needs" && path[2] === "outputs") {
    // ... existing logic
  }

  return diagnostics;
}

function checkGitHubEventAccess(
  propertyPath: readonly string[],
  span: Span,
  context: TypeContext
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!context.workflowEventType) {
    // No event type available - skip validation
    return diagnostics;
  }

  const eventType = context.workflowEventType;

  if (eventType.kind === "union") {
    return checkUnionEventAccess(propertyPath, span, eventType);
  }

  // Single event type - validate property path
  return validateEventPropertyPath(propertyPath, span, eventType, null);
}

function validateEventPropertyPath(
  propertyPath: readonly string[],
  span: Span,
  eventType: EventType,
  triggerName: string | null
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let currentType: EventPropertyType = eventType;

  for (let i = 0; i < propertyPath.length; i++) {
    const propName = propertyPath[i];

    if (currentType.kind !== "object") {
      diagnostics.push(
        semanticError(
          "WP2020",
          `Cannot access property '${propName}' on non-object type`,
          span,
          triggerName
            ? `The value at this path is not an object for trigger '${triggerName}'`
            : `The value at this path is not an object`
        )
      );
      return diagnostics;
    }

    const property = currentType.properties.get(propName);

    if (!property) {
      const available = Array.from(currentType.properties.keys());
      const typeName = triggerName ? `'${triggerName}' event` : "event";
      diagnostics.push(
        semanticError(
          "WP2020",
          `Property '${propName}' does not exist on type ${typeName}`,
          span,
          `Available properties: ${available.join(", ")}`
        )
      );
      return diagnostics;
    }

    // Handle array indexing
    if (currentType.kind === "array" && !isNaN(Number(propName))) {
      currentType = currentType.element;
    } else {
      currentType = property;
    }
  }

  return diagnostics;
}
```

### Diagnostic Codes

| Code | Severity | Message Template | Trigger |
|------|----------|------------------|---------|
| WP2020 | Error | Property '{prop}' does not exist on type '{event_type}' | Invalid property access |
| WP2021 | Warning | Property '{prop}' may not exist for all triggers | Union type access (Phase 5) |
| WP2022 | Info | Event type '{type}' inferred from trigger '{trigger}' | Optional diagnostic |
| WP2023 | Error | Unknown trigger '{trigger}' - cannot determine event type | Unknown trigger |
| WP2024 | Warning | Property '{prop}' only available with specific action values | Action-dependent property (future) |

#### Diagnostic Examples

**WP2020 - Invalid property access:**
```
error[WP2020]: Property 'commits' does not exist on type 'pull_request' event
  --> ci.workpipe:10:25
   |
10 |       run("echo ${{ github.event.commits[0].message }}")
   |                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = hint: Available properties: action, number, pull_request, repository, sender
   = note: workflow trigger is 'pull_request'
```

**WP2023 - Unknown trigger:**
```
error[WP2023]: Unknown trigger 'my_custom_event' - cannot determine event type
  --> ci.workpipe:3:7
   |
 3 |   on: my_custom_event
   |       ^^^^^^^^^^^^^^^^
   |
   = hint: Known triggers: push, pull_request, workflow_dispatch, schedule, issues, ...
```

### File Locations

| File | Change Type | Purpose |
|------|-------------|---------|
| `packages/compiler/src/semantics/expression-types.ts` | Modify | Add `checkGitHubEventAccess` |
| `packages/compiler/src/semantics/expression-type-validation.ts` | Modify | Pass event type to context |
| `packages/compiler/src/diagnostic/codes.ts` | Modify | Add WP2020-WP2024 codes |

### Test Strategy

```typescript
// packages/compiler/src/__tests__/github-event-type-checking.test.ts

describe("GitHub event type checking", () => {
  describe("push events", () => {
    it("allows valid push event properties", () => {
      const source = `
        workflow ci {
          on: push
          job build {
            runs_on: ubuntu-latest
            steps: [run("echo \${{ github.event.ref }}")]
          }
        }
      `;
      const result = compile(source);
      expect(result.diagnostics.filter(d => d.code === "WP2020")).toHaveLength(0);
    });

    it("rejects pull_request properties on push event", () => {
      const source = `
        workflow ci {
          on: push
          job build {
            runs_on: ubuntu-latest
            steps: [run("echo \${{ github.event.pull_request.title }}")]
          }
        }
      `;
      const result = compile(source);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "WP2020" })
      );
    });
  });

  describe("pull_request events", () => {
    it("allows valid nested property access", () => {
      const source = `
        workflow ci {
          on: pull_request
          job review {
            runs_on: ubuntu-latest
            steps: [run("echo \${{ github.event.pull_request.head.sha }}")]
          }
        }
      `;
      const result = compile(source);
      expect(result.diagnostics.filter(d => d.code === "WP2020")).toHaveLength(0);
    });

    it("rejects invalid nested property", () => {
      const source = `
        workflow ci {
          on: pull_request
          job review {
            runs_on: ubuntu-latest
            steps: [run("echo \${{ github.event.pull_request.nonexistent }}")]
          }
        }
      `;
      const result = compile(source);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "WP2020",
          message: expect.stringContaining("nonexistent"),
        })
      );
    });
  });
});
```

---

## Phase 4: VS Code Autocomplete and Hover Support

### Objective

Provide IDE support for `github.event.*` expressions, including autocomplete suggestions and hover type information.

### Deliverables

1. Completion provider for `github.event.*`
2. Hover provider showing property types
3. Integration with existing VS Code extension

### Technical Design

#### Completion Provider

```typescript
// packages/vscode-extension/src/completion.ts

import * as vscode from "vscode";
import { GITHUB_EVENT_TYPES, getEventType } from "@workpipe/compiler/builtins";

export class GitHubEventCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] | undefined {
    const lineText = document.lineAt(position).text;
    const beforeCursor = lineText.substring(0, position.character);

    // Check if we're inside ${{ ... }}
    const exprMatch = beforeCursor.match(/\$\{\{\s*([^}]*)$/);
    if (!exprMatch) return undefined;

    const exprContent = exprMatch[1];

    // Handle github.event.* completion
    if (exprContent.match(/github\.event\.$/)) {
      const trigger = this.detectTrigger(document);
      if (!trigger) return undefined;

      const eventType = getEventType(trigger);
      if (!eventType) return undefined;

      return this.createCompletionsFromType(eventType);
    }

    // Handle nested property completion (github.event.pull_request.)
    const nestedMatch = exprContent.match(/github\.event\.(.+)\.$/);
    if (nestedMatch) {
      const path = nestedMatch[1].split(".");
      const trigger = this.detectTrigger(document);
      if (!trigger) return undefined;

      const propType = this.resolvePropertyPath(trigger, path);
      if (!propType || propType.kind !== "object") return undefined;

      return this.createCompletionsFromType(propType);
    }

    return undefined;
  }

  private detectTrigger(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const match = text.match(/on:\s*(\w+)/);
    return match?.[1];
  }

  private resolvePropertyPath(
    trigger: string,
    path: string[]
  ): EventPropertyType | undefined {
    let current: EventPropertyType | undefined = getEventType(trigger);

    for (const prop of path) {
      if (!current || current.kind !== "object") return undefined;
      current = current.properties.get(prop);
    }

    return current;
  }

  private createCompletionsFromType(
    type: ObjectPropertyType
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const [name, propType] of type.properties) {
      const item = new vscode.CompletionItem(
        name,
        propType.kind === "object"
          ? vscode.CompletionItemKind.Module
          : vscode.CompletionItemKind.Property
      );

      item.detail = this.formatTypeDetail(propType);
      item.documentation = new vscode.MarkdownString(
        `GitHub event property \`${name}\``
      );

      items.push(item);
    }

    return items;
  }

  private formatTypeDetail(type: EventPropertyType): string {
    switch (type.kind) {
      case "primitive":
        return type.type;
      case "object":
        return "object";
      case "array":
        return `${this.formatTypeDetail(type.element)}[]`;
      case "any":
        return "any";
    }
  }
}
```

#### Hover Provider

```typescript
// packages/vscode-extension/src/hover.ts

import * as vscode from "vscode";
import { getEventType, type EventPropertyType } from "@workpipe/compiler/builtins";

export class GitHubEventHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /github\.event(\.\w+)*/);
    if (!range) return undefined;

    const word = document.getText(range);
    if (!word.startsWith("github.event")) return undefined;

    const path = word.split(".").slice(2); // Remove "github", "event"
    const trigger = this.detectTrigger(document);
    if (!trigger) return undefined;

    const eventType = getEventType(trigger);
    if (!eventType) return undefined;

    // Resolve the full path
    let current: EventPropertyType = eventType;
    let resolvedPath = `github.event`;

    for (const prop of path) {
      if (current.kind !== "object") break;
      const next = current.properties.get(prop);
      if (!next) break;
      current = next;
      resolvedPath += `.${prop}`;
    }

    const typeString = this.formatType(current);
    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(`${resolvedPath}: ${typeString}`, "typescript");
    markdown.appendMarkdown(`\n\n*From trigger \`${trigger}\`*`);

    return new vscode.Hover(markdown);
  }

  private detectTrigger(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const match = text.match(/on:\s*(\w+)/);
    return match?.[1];
  }

  private formatType(type: EventPropertyType): string {
    switch (type.kind) {
      case "primitive":
        return type.type;
      case "object":
        return "{ ... }";
      case "array":
        return `${this.formatType(type.element)}[]`;
      case "any":
        return "any";
    }
  }
}
```

#### Extension Registration

```typescript
// packages/vscode-extension/src/extension.ts (modification)

import { GitHubEventCompletionProvider } from "./completion.js";
import { GitHubEventHoverProvider } from "./hover.js";

export function activate(context: vscode.ExtensionContext) {
  // Existing activation...

  // Register completion provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "workpipe", scheme: "file" },
      new GitHubEventCompletionProvider(),
      "." // Trigger on dot
    )
  );

  // Register hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "workpipe", scheme: "file" },
      new GitHubEventHoverProvider()
    )
  );
}
```

### File Locations

| File | Change Type | Purpose |
|------|-------------|---------|
| `packages/vscode-extension/src/completion.ts` | New | Completion provider |
| `packages/vscode-extension/src/hover.ts` | New | Hover provider |
| `packages/vscode-extension/src/extension.ts` | Modify | Register providers |

### Test Strategy

Manual testing checklist:

1. **Autocomplete after `github.event.`**
   - [ ] Shows properties for push event when `on: push`
   - [ ] Shows properties for pull_request event when `on: pull_request`
   - [ ] Shows nested properties (e.g., `github.event.pull_request.head.`)

2. **Hover information**
   - [ ] Shows type on hover over `github.event`
   - [ ] Shows nested type on hover over `github.event.pull_request.title`
   - [ ] Shows trigger source in hover

3. **Multi-trigger handling**
   - [ ] Shows union of properties when `on: [push, pull_request]`

---

## Phase 5: Multi-Trigger Union Type Handling

### Objective

Handle workflows with multiple triggers by treating `github.event` as a union type and warning when accessing trigger-specific properties.

### Deliverables

1. Union type construction from multiple triggers
2. Common property intersection for safe access
3. WP2021 warning for trigger-specific property access

### Technical Design

#### Union Type Access Validation

```typescript
// packages/compiler/src/semantics/expression-types.ts (addition)

function checkUnionEventAccess(
  propertyPath: readonly string[],
  span: Span,
  unionType: UnionEventType
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const propName = propertyPath[0];

  // Check which members have this property
  const membersWithProperty: string[] = [];
  const membersWithoutProperty: string[] = [];

  for (const member of unionType.members) {
    if (member.type.properties.has(propName)) {
      membersWithProperty.push(member.trigger);
    } else {
      membersWithoutProperty.push(member.trigger);
    }
  }

  if (membersWithProperty.length === 0) {
    // Property doesn't exist on any trigger
    diagnostics.push(
      semanticError(
        "WP2020",
        `Property '${propName}' does not exist on any of the configured triggers`,
        span,
        `Triggers: ${unionType.members.map(m => m.trigger).join(", ")}`
      )
    );
    return diagnostics;
  }

  if (membersWithoutProperty.length > 0) {
    // Property exists on some but not all triggers
    diagnostics.push(
      warning(
        "WP2021",
        `Property '${propName}' may not exist for all triggers`,
        span,
        `Exists on: ${membersWithProperty.join(", ")}\n` +
        `Missing on: ${membersWithoutProperty.join(", ")}\n` +
        `Consider adding a condition: if: github.event_name == "${membersWithProperty[0]}"`
      )
    );
  }

  // Validate deeper path against members that have the property
  if (propertyPath.length > 1) {
    for (const member of unionType.members) {
      if (member.type.properties.has(propName)) {
        const innerDiags = validateEventPropertyPath(
          propertyPath,
          span,
          member.type,
          member.trigger
        );
        // Only add first inner diagnostic to avoid noise
        if (innerDiags.length > 0) {
          diagnostics.push(innerDiags[0]);
          break;
        }
      }
    }
  }

  return diagnostics;
}
```

#### Common Property Computation

For autocomplete, compute the intersection of properties across all union members:

```typescript
// packages/compiler/src/builtins/github-events.ts (addition)

export function getCommonEventProperties(
  triggers: readonly string[]
): ReadonlyMap<string, EventPropertyType> {
  if (triggers.length === 0) {
    return new Map();
  }

  const eventTypes = triggers
    .map(t => getEventType(t))
    .filter((t): t is EventType => t !== undefined);

  if (eventTypes.length === 0) {
    return new Map();
  }

  // Start with first event's properties
  const common = new Map(eventTypes[0].properties);

  // Intersect with each subsequent event
  for (let i = 1; i < eventTypes.length; i++) {
    const eventProps = eventTypes[i].properties;
    for (const key of common.keys()) {
      if (!eventProps.has(key)) {
        common.delete(key);
      }
    }
  }

  return common;
}
```

### Diagnostic Example

**WP2021 - Union type access warning:**
```
warning[WP2021]: Property 'action' may not exist for all triggers
  --> ci.workpipe:8:25
   |
 8 |       run("echo ${{ github.event.action }}")
   |                     ^^^^^^^^^^^^^^^^^^^^^
   |
   = note: workflow triggers are [pull_request, push]
   = note: 'action' exists on: pull_request
   = note: 'action' does not exist on: push
   = hint: add a condition: if: github.event_name == "pull_request"
```

### File Locations

| File | Change Type | Purpose |
|------|-------------|---------|
| `packages/compiler/src/semantics/expression-types.ts` | Modify | Add union type handling |
| `packages/compiler/src/builtins/github-events.ts` | Modify | Add `getCommonEventProperties` |
| `packages/vscode-extension/src/completion.ts` | Modify | Handle multi-trigger completion |

### Test Strategy

```typescript
// packages/compiler/src/__tests__/multi-trigger-types.test.ts

describe("Multi-trigger type checking", () => {
  it("warns on trigger-specific property access", () => {
    const source = `
      workflow ci {
        on: [push, pull_request]
        job build {
          runs_on: ubuntu-latest
          steps: [run("echo \${{ github.event.action }}")]
        }
      }
    `;
    const result = compile(source);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "WP2021",
        severity: "warning",
      })
    );
  });

  it("allows common properties without warning", () => {
    const source = `
      workflow ci {
        on: [push, pull_request]
        job build {
          runs_on: ubuntu-latest
          steps: [run("echo \${{ github.event.repository.name }}")]
        }
      }
    `;
    const result = compile(source);
    expect(result.diagnostics.filter(d => d.code === "WP2021")).toHaveLength(0);
  });

  it("errors when property missing from all triggers", () => {
    const source = `
      workflow ci {
        on: [push, pull_request]
        job build {
          runs_on: ubuntu-latest
          steps: [run("echo \${{ github.event.nonexistent }}")]
        }
      }
    `;
    const result = compile(source);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "WP2020" })
    );
  });
});
```

---

## Migration Strategy

**Migration cost: Zero.**

This feature is fully additive:

1. No syntax changes required
2. No configuration changes required
3. Existing workflows gain type checking automatically
4. All new diagnostics are either:
   - Errors for provably invalid access (WP2020, WP2023)
   - Warnings for potentially unsafe access (WP2021, WP2024)

Teams can:
- Ignore warnings initially (`--ignore-warnings WP2021`)
- Fix errors as they appear
- Enable stricter checking as confidence grows

---

## Implementation Roadmap

| Phase | Estimated Duration | Dependencies |
|-------|-------------------|--------------|
| Phase 1: Event Types | 1 week | None |
| Phase 2: Type Inference | 0.5 weeks | Phase 1 |
| Phase 3: Type Checking | 1 week | Phase 2 |
| Phase 4: VS Code | 1 week | Phase 3 |
| Phase 5: Union Types | 0.5 weeks | Phase 3 |

**Total estimated duration**: 4 weeks

Phases 4 and 5 can be developed in parallel after Phase 3 completes.

---

## Future Extensions

The following are explicitly **out of scope** for this ADR but may be considered in future work:

### Type Narrowing with Guards

```workpipe
workflow ci {
  on: [push, pull_request]

  job pr_only {
    if: github.event_name == "pull_request"
    // Inside this job, github.event is narrowed to PullRequestEvent
    steps: [
      run("echo ${{ github.event.pull_request.title }}")  // Valid!
    ]
  }
}
```

### workflow_dispatch Input Integration

When a workflow has `inputs:` declared, the `github.event.inputs.*` type could be derived from those declarations rather than `any`.

### Generic Workflow Syntax (Rejected for Now)

The user explicitly rejected `workflow<push>` syntax. If future demand materializes, a new ADR would be required.

---

## Alternatives Considered

See [ADR-0015](0015-generic-workflows-typed-triggers.md) for the full research and alternatives analysis. The key rejected alternatives were:

1. **Generic workflow syntax** (`workflow<push>`) - Rejected by user as unnecessary complexity
2. **Explicit context typing block** - Redundant with `on:` clause
3. **Type-annotated triggers** (`on: push as PushEvent`) - Custom types unlikely to be useful
4. **No type checking** - Misses significant compile-time value

---

## Consequences

### Positive

1. **Compile-time safety**: Invalid `github.event.*` access caught before runtime
2. **IDE support**: Autocomplete and hover for event properties
3. **Self-documenting**: Event type is explicit from trigger
4. **Zero migration**: Existing workflows gain type checking automatically
5. **Familiar model**: Works like TypeScript inference

### Negative

1. **Built-in type maintenance**: GitHub API changes require compiler updates
2. **Incomplete coverage**: Custom/enterprise events may lack types
3. **Union complexity**: Multi-trigger workflows have less precise typing
4. **No type narrowing**: Conditional access requires future work

### Neutral

1. **No grammar change**: Implementation is purely semantic
2. **Backward compatible**: All existing workflows compile unchanged
3. **Optional precision**: Users can ignore warnings if desired

---

## References

- [ADR-0015: Generic Workflows with Typed Triggers](0015-generic-workflows-typed-triggers.md) - Research ADR (superseded by this implementation plan)
- [ADR-0010: Type System for Task/Job Data Flow](0010-type-system-for-data-flow.md) - Foundation type system
- [ADR-0003: Lezer Grammar Design](0003-lezer-grammar-design-and-expression-language.md) - Expression language design
- [GitHub Actions: Contexts](https://docs.github.com/en/actions/learn-github-actions/contexts) - The `github` context structure
- [GitHub Webhooks: Event Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - Complete event type reference
