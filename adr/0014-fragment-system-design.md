# ADR-0014: Fragment System Design for Reusable Workflow Components

**Date**: 2026-01-01
**Status**: Proposed
**Deciders**: Architecture Team

## Context

As WorkPipe workflows grow in complexity, users encounter significant duplication. Common patterns emerge across multiple workflows:

1. **Checkout and setup sequences**: Nearly every CI workflow begins with checkout, toolchain setup, and dependency installation
2. **Deployment jobs**: Production, staging, and preview deployments share 90% of their structure, differing only in environment parameters
3. **Notification patterns**: Slack/email notifications with consistent formatting appear across workflows
4. **Build matrix patterns**: Similar build configurations across multiple repositories

Currently, WorkPipe offers no mechanism for defining reusable components. Users must:
- Copy-paste job definitions across files
- Manually synchronize changes when patterns evolve
- Accept drift between "identical" jobs over time

### Existing Ecosystem Solutions

**GitHub Composite Actions**:
- Require separate repository or `.github/actions/` directory
- Generate separate YAML files that are referenced at runtime
- Cannot inline expand at compile time
- Add runtime resolution complexity

**YAML Anchors**:
- Limited to single-file reuse
- No parameterization
- Merge semantics are confusing

**Template repositories**:
- One-time copy, no ongoing synchronization
- No parameterization

### Design Goals

1. **Compile-time expansion**: Fragments inline-expand during compilation, producing self-contained YAML
2. **Parameterization**: Fragments accept typed parameters with defaults
3. **Two distinct fragment types**: Jobs and step sequences have different semantics and usage patterns
4. **Import integration**: Leverage the existing import system (ADR-0012) for cross-file fragments
5. **Familiar syntax**: Build on existing WorkPipe conventions and JavaScript/TypeScript patterns
6. **Clear instantiation semantics**: Unambiguous distinction between definition and usage

## Decision

### 1. Two Fragment Types: `job_fragment` and `steps_fragment`

**Decision**: Implement two distinct fragment constructs, each optimized for its use case.

**Rationale**: Jobs and step sequences have fundamentally different semantics:
- A job is a complete unit with `runs_on`, dependencies, outputs, and a step list
- A step sequence is a partial unit that spreads into an existing job's step list

Attempting to unify these into a single construct would require complex conditional logic and produce confusing instantiation semantics.

#### `job_fragment`: Complete Reusable Jobs

A `job_fragment` defines a complete, parameterized job template:

```workpipe
job_fragment deploy_to_env {
  params {
    environment: string
    registry: string = "ghcr.io"
    notify_on_failure: bool = true
  }

  runs_on: ubuntu-latest
  environment: params.environment

  steps {
    uses("actions/checkout@v4") {}
    shell {
      echo "Deploying to ${{ params.environment }}"
      docker pull ${{ params.registry }}/app:${{ github.sha }}
      docker tag ${{ params.registry }}/app:${{ github.sha }} app:latest
    }
    uses("some/deploy-action@v1") {
      with: { target: params.environment }
    }
  }
}
```

**Key characteristics**:
- Declares a complete job structure (runs_on, steps, outputs, environment, etc.)
- Parameters accessed via `params.name` within the fragment body
- Instantiated as a named job in workflows

#### `steps_fragment`: Reusable Step Sequences

A `steps_fragment` defines a parameterized sequence of steps:

```workpipe
steps_fragment checkout_and_setup {
  params {
    node_version: string = "20"
    install_command: string = "npm ci"
  }

  uses("actions/checkout@v4") {}
  uses("actions/setup-node@v4") {
    with: { node-version: params.node_version }
  }
  shell { ${{ params.install_command }} }
}
```

**Key characteristics**:
- Contains only step definitions (no `runs_on`, no job-level properties)
- Parameters accessed via `params.name` within step bodies
- Instantiated using spread syntax inside a job's `steps` block

### 2. Parameter Syntax

**Decision**: Use a dedicated `params` block with typed parameters and optional defaults.

```workpipe
params {
  required_param: string              // Required, no default
  optional_param: int = 42            // Optional with default
  enum_param: "dev" | "staging" | "prod" = "dev"  // Union type with default
  complex_param: { host: string, port: int }      // Object type
}
```

**Parameter types**: Reuse the existing type system (ADR-0010, ADR-0011):
- Primitives: `string`, `int`, `float`, `bool`
- Unions: `"a" | "b" | "c"`
- Objects: `{ field: type }`
- Arrays: `[type]`
- User-defined types: `BuildConfig` (from ADR-0011)

**Default value rules**:
- Parameters without defaults are required
- Parameters with defaults are optional
- Default values must match the declared type

### 3. Fragment Instantiation Syntax

#### Job Fragment Instantiation

**Decision**: Use assignment syntax with the fragment name and parameter object.

```workpipe
workflow ci {
  on: push

  job staging = deploy_to_env {
    environment: "staging"
    registry: "ghcr.io/myorg"
  }

  job production = deploy_to_env {
    environment: "production"
    registry: "ghcr.io/myorg"
    notify_on_failure: false
  }
}
```

**Semantics**:
- `job <name> = <fragment_name> { <params> }` creates a job named `<name>` by instantiating the fragment
- Required parameters must be provided
- Optional parameters use defaults if not specified
- The resulting job has all properties from the fragment, with parameters substituted

#### Steps Fragment Instantiation

**Decision**: Use spread syntax (`...`) to inline step sequences.

```workpipe
workflow ci {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      ...checkout_and_setup { node_version: "18" }
      shell { npm run build }
      shell { npm test }
    }
  }

  job lint {
    runs_on: ubuntu-latest
    steps {
      ...checkout_and_setup {}  // Use all defaults
      shell { npm run lint }
    }
  }
}
```

**Semantics**:
- `...fragment_name { params }` expands the fragment's steps at that position
- Steps before and after the spread are preserved
- Multiple spreads can appear in a single steps block
- Empty braces `{}` required even when using all defaults (explicit invocation)

**Rationale for spread syntax**:
- Visually indicates "expansion" or "spreading" of multiple items
- Familiar from JavaScript spread operator
- Clearly distinguishes from regular step syntax
- Self-documenting: the `...` signals "more steps will appear here"

### 4. Import Integration

**Decision**: Fragments are importable using the existing import syntax (ADR-0012).

```workpipe
// fragments.workpipe
job_fragment deploy_to_env { ... }
steps_fragment checkout_and_setup { ... }

// ci.workpipe
import { deploy_to_env, checkout_and_setup } from "./fragments.workpipe"

workflow ci {
  on: push
  job staging = deploy_to_env { environment: "staging" }
  job build {
    runs_on: ubuntu-latest
    steps {
      ...checkout_and_setup {}
      shell { npm run build }
    }
  }
}
```

**Import resolution**:
- Fragments are resolved alongside types using the existing import system
- Fragment names must not collide with type names in the same file
- Same path resolution rules apply (relative paths, `.workpipe` extension required)

### 5. Code Generation Strategy: Inline Expansion

**Decision**: Fragments are fully expanded at compile time, producing self-contained YAML.

**Rationale**:
- Self-contained output: no runtime dependencies on external files
- Transparency: `workpipe build` produces exactly what GitHub Actions will execute
- Debugging: users can inspect generated YAML to understand what will run
- No composite action complexity: no need to manage separate action.yml files

**Expansion process**:
1. Resolve fragment reference
2. Validate provided parameters against fragment signature
3. Substitute parameter references in fragment body
4. Inline the expanded content at the instantiation site
5. Generate standard YAML output

**Example expansion**:
```workpipe
// Input
job staging = deploy_to_env { environment: "staging" }

// Expanded (conceptually, before YAML generation)
job staging {
  runs_on: ubuntu-latest
  environment: "staging"
  steps {
    uses("actions/checkout@v4") {}
    shell { echo "Deploying to staging" ... }
    uses("some/deploy-action@v1") { with: { target: "staging" } }
  }
}
```

### 6. Grammar Extensions

**Decision**: Add grammar productions for fragment definitions and instantiations.

```lezer
@top WorkPipeFile { (ImportDecl | TypeDecl | FragmentDecl | WorkflowDecl)* }

FragmentDecl {
  JobFragmentDecl | StepsFragmentDecl
}

JobFragmentDecl {
  kw<"job_fragment"> Identifier "{" ParamsBlock? JobBody "}"
}

StepsFragmentDecl {
  kw<"steps_fragment"> Identifier "{" ParamsBlock? StepList "}"
}

ParamsBlock {
  kw<"params"> "{" ParamDecl* "}"
}

ParamDecl {
  Identifier ":" SchemaType ("=" Expression)?
}

// In job context
JobDecl {
  kw<"job"> Identifier ("=" FragmentInstantiation | JobBody)
}

FragmentInstantiation {
  Identifier "{" ParamAssignment* "}"
}

ParamAssignment {
  Identifier ":" Expression
}

// In steps context
Step {
  ... |
  StepsFragmentSpread
}

StepsFragmentSpread {
  "..." Identifier "{" ParamAssignment* "}"
}
```

**Reserved keywords to add**:
- `job_fragment`
- `steps_fragment`
- `params`

### 7. AST Extensions

**Decision**: Add AST nodes for fragment definitions and instantiations.

```typescript
// Fragment definitions
interface JobFragmentNode {
  kind: "job_fragment";
  name: string;
  params: ParamDeclarationNode[];
  body: JobBodyNode;
  span: Span;
}

interface StepsFragmentNode {
  kind: "steps_fragment";
  name: string;
  params: ParamDeclarationNode[];
  steps: StepNode[];
  span: Span;
}

interface ParamDeclarationNode {
  kind: "param_declaration";
  name: string;
  type: SchemaTypeNode;
  defaultValue?: ExpressionNode;
  span: Span;
}

// Fragment instantiations
interface JobFragmentInstantiationNode {
  kind: "job_fragment_instantiation";
  jobName: string;
  fragmentName: string;
  arguments: ParamArgumentNode[];
  span: Span;
}

interface StepsFragmentSpreadNode {
  kind: "steps_fragment_spread";
  fragmentName: string;
  arguments: ParamArgumentNode[];
  span: Span;
}

interface ParamArgumentNode {
  kind: "param_argument";
  name: string;
  value: ExpressionNode;
  span: Span;
}

// Updated file node
interface WorkPipeFileNode {
  kind: "file";
  imports: ImportDeclarationNode[];
  types: TypeDeclarationNode[];
  jobFragments: JobFragmentNode[];
  stepsFragments: StepsFragmentNode[];
  workflows: WorkflowNode[];
  span: Span;
}
```

### 8. Fragment Registry

**Decision**: Implement a `FragmentRegistry` for fragment resolution.

```typescript
interface FragmentRegistry {
  // Registration
  registerJobFragment(fragment: JobFragmentNode): Diagnostic | null;
  registerStepsFragment(fragment: StepsFragmentNode): Diagnostic | null;

  // Resolution
  resolveJobFragment(name: string): JobFragmentNode | undefined;
  resolveStepsFragment(name: string): StepsFragmentNode | undefined;

  // Queries
  hasJobFragment(name: string): boolean;
  hasStepsFragment(name: string): boolean;
  allJobFragments(): readonly JobFragmentNode[];
  allStepsFragments(): readonly StepsFragmentNode[];
}
```

**Integration with TypeRegistry**:
- FragmentRegistry is separate from TypeRegistry
- Both are populated during the same semantic analysis phase
- Name collision between fragments and types produces diagnostic
- Imported fragments are registered with source tracking

### 9. Diagnostic Codes

**Decision**: Introduce fragment-specific diagnostic codes in the WP9xxx range.

| Code | Severity | Message Template |
|------|----------|------------------|
| WP9001 | Error | Undefined job fragment '{name}' |
| WP9002 | Error | Undefined steps fragment '{name}' |
| WP9003 | Error | Missing required parameter '{param}' for fragment '{fragment}' |
| WP9004 | Error | Unknown parameter '{param}' for fragment '{fragment}' |
| WP9005 | Error | Parameter type mismatch: expected '{expected}', got '{actual}' |
| WP9006 | Error | Duplicate fragment declaration '{name}' |
| WP9007 | Warning | Fragment '{name}' is declared but never used |
| WP9008 | Error | Cannot use job fragment '{name}' in steps context (use steps_fragment) |
| WP9009 | Error | Cannot use steps fragment '{name}' as job (use job_fragment) |

### 10. Parameter Reference Resolution

**Decision**: Parameter references use `params.name` syntax within fragment bodies.

```workpipe
job_fragment example {
  params {
    target: string
    count: int = 5
  }

  runs_on: ubuntu-latest
  steps {
    shell { echo "Deploying to ${{ params.target }}" }
    shell { for i in $(seq 1 ${{ params.count }}); do echo $i; done }
  }
}
```

**Resolution rules**:
1. `params.name` references are valid only within fragment bodies
2. References outside fragments produce diagnostic: "params is not defined in this context"
3. References to undefined parameters produce WP9004
4. Parameter references in expressions are type-checked against declared types

## Alternatives Considered

### Alternative 1: GitHub Composite Actions

Use the built-in GitHub composite action mechanism.

```yaml
# .github/actions/deploy/action.yml
name: Deploy
inputs:
  environment:
    required: true
runs:
  using: composite
  steps:
    - run: echo "Deploying to ${{ inputs.environment }}"
      shell: bash
```

**Rejected because**:
- Requires separate action.yml files outside the workflow definition
- Adds runtime resolution complexity
- Generated YAML is not self-contained (references external files)
- WorkPipe's value proposition is "single source of truth" that compiles to simple YAML
- Composite actions have limitations (no job-level reuse, only steps)

### Alternative 2: Single `fragment` Construct

Use a unified `fragment` keyword for both jobs and steps.

```workpipe
fragment deploy { ... }     // Is this a job or steps?
```

**Rejected because**:
- Ambiguous semantics: is a fragment a job or step sequence?
- Different instantiation syntax needed anyway (assignment vs spread)
- Type errors would be confusing ("cannot use job as steps")
- Explicit `job_fragment` and `steps_fragment` are self-documenting

### Alternative 3: Template Syntax (Mustache-Style)

Use template substitution with `{{ }}` placeholders.

```workpipe
template deploy_job {
  job {{name}} {
    runs_on: ubuntu-latest
    environment: {{env}}
  }
}
```

**Rejected because**:
- Stringly-typed: no type checking for parameters
- Textual substitution is error-prone
- Doesn't integrate with WorkPipe's type system
- No parameter defaults or validation

### Alternative 4: Inheritance/Extension Model

Use class-like inheritance for jobs.

```workpipe
job base_deploy {
  runs_on: ubuntu-latest
  steps { ... }
}

job staging extends base_deploy {
  environment: "staging"
}
```

**Rejected because**:
- Complex inheritance semantics (what overrides what?)
- No clear parameterization story
- Jobs aren't classes - they're instantiated configurations
- Fragment + instantiation is more explicit about what happens

### Alternative 5: Macro System

Implement a general-purpose macro system.

```workpipe
macro deploy($env) {
  job deploy_$env {
    environment: $env
  }
}

deploy("staging")
deploy("production")
```

**Rejected because**:
- Macros are notoriously hard to debug
- Textual expansion makes error messages confusing
- Type safety is difficult to maintain
- Too general - fragments are sufficient for the use case

### Alternative 6: YAML Include Directive

Add a YAML-level include mechanism.

**Rejected because**:
- Operates at wrong abstraction level (YAML, not WorkPipe)
- No parameterization
- Doesn't leverage WorkPipe's type system
- Would require users to understand YAML structure

## Consequences

### Positive

1. **Reduced duplication**: Define patterns once, use everywhere
2. **Consistent updates**: Change a fragment, all usages update on recompile
3. **Type-safe parameterization**: Parameters are validated at compile time
4. **Self-contained output**: Generated YAML has no external dependencies
5. **Familiar syntax**: Builds on existing WorkPipe conventions
6. **Clear semantics**: Two fragment types match two distinct use cases
7. **Import integration**: Fragments work with existing cross-file system
8. **IDE support**: Fragment definitions enable hover, go-to-definition

### Negative

1. **Grammar complexity**: Two new constructs with associated syntax
2. **Learning curve**: Users must understand when to use which fragment type
3. **Compile time**: Fragment expansion adds processing overhead
4. **Generated YAML size**: Inline expansion may produce larger files than composite actions
5. **Debug correlation**: Mapping YAML errors back to fragment source requires span tracking

### Neutral

1. **No runtime impact**: All expansion happens at compile time
2. **Backward compatible**: Existing workflows continue to work unchanged
3. **Optional adoption**: Teams can choose not to use fragments
4. **VS Code extension updates required**: Syntax highlighting, diagnostics, navigation

## Implementation Guidance

### Phase 1: Grammar and AST (Foundation)

**Objective**: Add fragment syntax to the Lezer grammar and parse to AST nodes.

**Key files to modify**:
- `packages/lang/src/workpipe.grammar` - Add grammar productions
- `packages/compiler/src/ast/types.ts` - Add fragment AST node types
- `packages/compiler/src/ast/builder.ts` - Add AST construction for fragments

**Deliverables**:
- Parse `job_fragment` and `steps_fragment` declarations
- Parse `params` block with typed parameters and defaults
- Parse fragment instantiation syntax
- Parse steps spread syntax
- Comprehensive parser tests

**Test cases**:
- Basic job fragment with no params
- Job fragment with required and optional params
- Steps fragment with various param types
- Fragment instantiation with all/some/no params
- Spread syntax in steps block
- Parse errors for malformed fragments

### Phase 2: Same-File Fragment Resolution

**Objective**: Resolve and validate fragments defined in the same file.

**Key files to modify**:
- `packages/compiler/src/semantics/fragment-registry.ts` (NEW)
- `packages/compiler/src/semantics/analyzer.ts` - Wire in fragment registration

**Deliverables**:
- `FragmentRegistry` implementation
- Registration of fragments during semantic analysis
- Resolution of fragment references
- WP9001, WP9002, WP9006 diagnostics

**Test cases**:
- Resolve job fragment by name
- Resolve steps fragment by name
- Error on undefined fragment reference
- Error on duplicate fragment names
- Error on wrong fragment type usage

### Phase 3: Parameter Validation

**Objective**: Validate parameter types, defaults, and arguments.

**Key files to modify**:
- `packages/compiler/src/semantics/param-validation.ts` (NEW)
- `packages/compiler/src/semantics/analyzer.ts` - Add param checking

**Deliverables**:
- Required parameter validation (WP9003)
- Unknown parameter detection (WP9004)
- Type compatibility checking (WP9005)
- Default value type validation

**Test cases**:
- Missing required parameter
- Unknown parameter provided
- Type mismatch in argument
- Default value type mismatch
- Complex type parameters

### Phase 4: Fragment Expansion

**Objective**: Expand fragment instantiations during code generation.

**Key files to modify**:
- `packages/compiler/src/codegen/fragment-expander.ts` (NEW)
- `packages/compiler/src/codegen/transform.ts` - Integrate expansion

**Deliverables**:
- Job fragment expansion to job AST
- Steps fragment expansion to step list
- Parameter substitution in expressions
- Nested `params.name` resolution

**Test cases**:
- Basic job expansion with literal params
- Steps spread expansion
- Parameter substitution in shell blocks
- Parameter substitution in `uses()` with blocks
- Multiple spreads in one steps block

### Phase 5: Cross-File Fragment Imports

**Objective**: Enable importing fragments from other files.

**Key files to modify**:
- `packages/compiler/src/imports/resolver.ts` - Extend for fragments
- `packages/compiler/src/imports/type-merger.ts` - Rename to entity-merger.ts

**Deliverables**:
- Import resolution for fragments
- Fragment registry merging
- Cross-file WP9001/WP9002 diagnostics
- Import collision detection

**Test cases**:
- Import job fragment from another file
- Import steps fragment from another file
- Import both types and fragments from same file
- Name collision between imported fragment and local definition
- Circular import detection (existing)

### Phase 6: Advanced Parameter Features

**Objective**: Support complex parameter scenarios.

**Deliverables**:
- Object and array parameter types
- Union type parameters with validation
- User-defined type parameters (from ADR-0011)
- Expression parameters (computed values)

**Test cases**:
- Object parameter with defaults
- Array parameter
- Union parameter with invalid value
- User-defined type parameter

### Phase 7: Diagnostics Polish

**Objective**: Production-quality error messages and suggestions.

**Deliverables**:
- All WP9xxx diagnostics with clear messages
- Suggestions for typos in fragment names
- Suggestions for missing required params
- Span-precise error locations

**Test cases**:
- Typo suggestions for fragment names
- Parameter suggestions for typos
- Clear error for wrong fragment type

### Phase 8: VS Code Extension

**Objective**: IDE support for fragments.

**Key files to modify**:
- `packages/vscode-extension/syntaxes/workpipe.tmLanguage.json` - Highlighting
- `packages/vscode-extension/src/diagnostics.ts` - Fragment diagnostics

**Deliverables**:
- Syntax highlighting for fragment definitions
- Syntax highlighting for instantiation
- Diagnostics display for fragment errors
- Go-to-definition for fragment names (stretch)
- Hover information showing fragment signature (stretch)

## References

- [ADR-0011: User-Defined Type Declarations](0011-user-defined-type-declarations.md) - Type system for parameters
- [ADR-0012: Import System](0012-import-system.md) - Cross-file import mechanism
- [ADR-0013: Step Syntax Improvements](0013-step-syntax-improvements.md) - Shell block syntax used in fragments
- [ADR-0003: Lezer Grammar Design](0003-lezer-grammar-design-and-expression-language.md) - Grammar extension approach
- [ADR-0010: Type System for Data Flow](0010-type-system-for-data-flow.md) - Primitive types for parameters
- PROJECT.md Section 5: Language overview
