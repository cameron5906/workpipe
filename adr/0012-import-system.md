# ADR-0012: Import System for Cross-File References

**Date**: 2025-12-31
**Status**: Proposed
**Deciders**: Architecture Team

## Context

WorkPipe currently processes each `.workpipe` file in isolation. With ADR-0011 introducing user-defined types, users have expressed interest in sharing type definitions across multiple workflow files without duplication.

### Use Cases Identified

1. **Shared type definitions**: A monorepo with multiple workflows that all use the same data structures (e.g., `BuildInfo`, `DeployResult`, `TestSummary`)

2. **Shared job templates/patterns**: Reusable job definitions that can be parameterized and included across workflows (future consideration)

3. **Monorepo organization**: Multiple services with their own workflows, sharing common type contracts for inter-service communication

4. **Library of reusable components**: Teams publishing internal workflow component libraries

### Current Limitations

1. **No cross-file resolution**: The `compile()` function takes a single source string; the `TypeRegistry` is built from a single `WorkPipeFileNode`

2. **Type duplication**: Complex types like `ReviewResult` must be copy-pasted into each workflow file

3. **Drift risk**: Duplicated types can diverge, causing subtle incompatibilities

4. **No composition model**: Jobs cannot be defined once and reused; each workflow is self-contained

### Design Goals

1. **Simple mental model**: Users should understand imports intuitively
2. **Incremental adoption**: Files without imports continue to work unchanged
3. **Compile-time safety**: Import errors surface during compilation, not runtime
4. **Editor support**: VS Code extension must provide diagnostics for import issues
5. **Deterministic compilation**: Import resolution must be reproducible
6. **Avoid complexity creep**: Start simple, add features only when clearly needed

## Design Options

### Option A: Simple File Imports (Whole-File)

```workpipe
import "./types.workpipe"
import "../shared/common-types.workpipe"

workflow ci {
  on: push
  job build {
    outputs: { info: BuildInfo }  // BuildInfo from imported file
    // ...
  }
}
```

**Semantics**:
- Imports all types declared in the target file into the current scope
- Transitive imports: if `a.workpipe` imports `b.workpipe`, and `b.workpipe` imports `c.workpipe`, types from `c.workpipe` are NOT automatically visible in `a.workpipe` (explicit is better than implicit)
- Workflows from imported files are NOT imported (types only)
- Relative paths resolved from the importing file's directory
- Absolute paths (starting with `/` or drive letter) allowed but discouraged

**Pros**:
- Simplest syntax and mental model
- Familiar from CSS `@import`
- Easy to implement: merge type registries

**Cons**:
- No granularity: cannot import specific types
- Name collision resolution is implicit (last import wins? error?)
- All types from imported file pollute namespace

### Option B: Named Imports (Selective)

```workpipe
import { BuildInfo, DeployResult } from "./types.workpipe"
import { ReviewResult as CodeReview } from "../shared/review-types.workpipe"

workflow ci {
  on: push
  job build {
    outputs: { info: BuildInfo }
    // ...
  }
}
```

**Semantics**:
- Import specific types by name
- Optional aliasing with `as` keyword
- Only explicitly named types are visible
- Compile error if requested type does not exist in target file

**Pros**:
- Explicit about dependencies (self-documenting)
- No namespace pollution
- Aliasing prevents name collisions
- Familiar from JavaScript/TypeScript

**Cons**:
- More verbose syntax
- Grammar complexity increases
- Requires tracking which types were actually used (for unused import warnings)

### Option C: Module System with Qualified Access

```workpipe
import types from "./types.workpipe"
import shared from "../shared/common-types.workpipe"

workflow ci {
  on: push
  job build {
    outputs: { info: types.BuildInfo }
    // ...
  }
}
```

**Semantics**:
- Import file as a named module/namespace
- Access types via qualified names: `module.TypeName`
- No namespace pollution
- No aliasing needed (module name is the alias)

**Pros**:
- Zero name collisions by design
- Clear provenance of each type
- Matches mental model of "this file provides these types"

**Cons**:
- Qualified names are verbose in frequent usage
- Grammar must support `identifier.identifier` as type reference
- Less familiar syntax for web developers

### Option D: Hybrid (Named + Star Imports)

```workpipe
import { BuildInfo } from "./types.workpipe"         // Named
import * as shared from "../shared/types.workpipe"   // Namespace
import "./local-types.workpipe"                       // Whole-file

workflow ci {
  on: push
  job build {
    outputs: {
      info: BuildInfo,           // From named import
      deploy: shared.DeployInfo, // From namespace import
      local: LocalType           // From whole-file import
    }
  }
}
```

**Semantics**:
- Supports all three patterns
- Users choose appropriate style per import

**Pros**:
- Maximum flexibility
- Familiar to JavaScript developers

**Cons**:
- Complex grammar
- Multiple ways to do the same thing (decision fatigue)
- Harder to enforce consistency in codebases
- Increases implementation and testing burden

## Recommended Approach

**Recommendation: Start with Option B (Named Imports)**, with Option A (whole-file) as a future extension if demand emerges.

### Rationale

1. **Explicitness wins**: Named imports make dependencies obvious. When reading a workflow, you know exactly which types come from where.

2. **Collision prevention**: Aliasing (`as`) provides escape hatch for name conflicts without implicit rules.

3. **Familiar to target audience**: WorkPipe users are likely familiar with JavaScript/TypeScript import syntax.

4. **Incremental complexity**: We can add whole-file imports (`import "./file.workpipe"`) later as syntactic sugar that desugars to importing all exports.

5. **Analysis-friendly**: Named imports enable precise unused-import warnings and go-to-definition.

### Proposed Syntax

```workpipe
// Named imports (required)
import { BuildInfo, DeployResult } from "./types.workpipe"

// Aliased imports
import { BuildInfo as BI } from "./types.workpipe"

// Multiple imports from same file
import {
  BuildInfo,
  DeployResult,
  TestSummary
} from "./types.workpipe"

// Imports from different files
import { CommonType } from "../shared/common.workpipe"
import { ServiceType } from "../service-a/types.workpipe"
```

### Deferred Features (Potential Future Work)

- **Whole-file imports**: `import "./types.workpipe"` as sugar for "import all"
- **Namespace imports**: `import * as types from "./types.workpipe"`
- **Re-exports**: `export { BuildInfo } from "./internal.workpipe"`
- **Package imports**: `import { X } from "@company/shared-types"` (npm-style)
- **Job imports**: Importing reusable job definitions (requires job parameterization)
- **Conditional imports**: Platform-specific types (unlikely to be needed)

## Implementation Considerations

### 1. Compiler Pipeline Changes

The current pipeline assumes single-file compilation:

```
Source -> Parse -> AST -> Semantics -> Transform -> Emit
```

With imports, the pipeline becomes:

```
Source -> Parse -> AST
                     |
                     v
              [Import Resolution]
                     |
        +------------+------------+
        |            |            |
        v            v            v
   Parse Dep 1   Parse Dep 2   ... (parallel)
        |            |
        v            v
     Merge Type Registries
                |
                v
         Semantics -> Transform -> Emit
```

**Key changes**:

1. **Two-phase parsing**:
   - Phase 1: Parse imports only (quick scan)
   - Phase 2: Full parse of main file + dependencies

2. **Dependency graph construction**:
   - Build import graph before full compilation
   - Detect cycles during graph construction

3. **TypeRegistry merging**:
   - Each imported file produces a TypeRegistry
   - Main file's registry merges in imported types
   - Name collision detection during merge

4. **API change**:
   ```typescript
   // Current
   function compile(source: string): CompileResult<string>

   // With imports
   interface CompileOptions {
     source: string;
     filePath: string;  // Required for relative path resolution
     fileResolver: (path: string) => Promise<string>;  // Async file reading
   }
   function compile(options: CompileOptions): Promise<CompileResult<string>>
   ```

### 2. Path Resolution Strategy

**Relative paths** (recommended):
- Resolved from the directory containing the importing file
- `./types.workpipe` -> same directory
- `../shared/types.workpipe` -> parent directory's `shared` folder
- `../../common/types.workpipe` -> two levels up

**Absolute paths** (supported but discouraged):
- Unix: `/home/user/project/types.workpipe`
- Windows: `C:\Users\user\project\types.workpipe`
- Portable: Use relative paths in committed files

**Extension handling**:
- `.workpipe` extension is required (no implicit extension resolution)
- This avoids ambiguity and matches explicit design philosophy

**Path normalization**:
- `./foo/../bar/types.workpipe` normalizes to `./bar/types.workpipe`
- Prevents duplicate imports of same file via different paths

### 3. Circular Import Detection

Circular imports must be detected and rejected:

```workpipe
// a.workpipe
import { TypeB } from "./b.workpipe"
type TypeA { ref: TypeB }

// b.workpipe
import { TypeA } from "./a.workpipe"  // ERROR: Circular import
type TypeB { ref: TypeA }
```

**Detection algorithm**:
1. Build dependency graph during import resolution
2. Perform cycle detection (Tarjan's SCC or DFS with color marking)
3. Report cycle with participating files

**Error message**:
```
error[WP7001]: Circular import detected
  --> a.workpipe:1:1
   |
 1 | import { TypeB } from "./b.workpipe"
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = Import cycle: a.workpipe -> b.workpipe -> a.workpipe
```

**Why reject cycles entirely?**
- Mutual type references across files create resolution ambiguity
- Most cycle use cases can be solved by extracting shared types to a third file
- Simpler implementation without incremental/lazy resolution

### 4. VS Code Extension Impact

The VS Code extension (ADR-0009) will need updates:

**Diagnostics scope**:
- Currently: diagnostics per-file, no cross-file awareness
- With imports: diagnostics may reference other files
  - "Type 'BuildInfo' not found in './types.workpipe'"
  - "Circular import: a.workpipe -> b.workpipe -> a.workpipe"

**File watching**:
- Currently: recompile only the saved file
- With imports: recompile files that import the changed file
  - Build reverse dependency graph
  - Invalidate and recompile dependents

**Go-to-definition**:
- Currently: jump within same file
- With imports: jump to type definition in imported file
  - Requires tracking definition locations across files
  - LSP implementation becomes more valuable

**Hover information**:
- Show import source on hover over imported type
- "BuildInfo (from ./types.workpipe)"

### 5. What Gets Imported

**Imported (types only in initial implementation)**:
- `type` declarations

**NOT imported**:
- `workflow` declarations (workflows are top-level compilation units)
- Comments
- Formatting

**Future consideration: job imports**:
```workpipe
// templates/jobs.workpipe
job checkout_and_install {
  runs_on: ubuntu-latest
  steps: [
    uses("actions/checkout@v4"),
    run("npm ci")
  ]
}

// my-workflow.workpipe
import { checkout_and_install } from "./templates/jobs.workpipe"

workflow ci {
  on: push
  job build extends checkout_and_install {
    steps: [
      ...super.steps,  // Inherit base steps
      run("npm run build")
    ]
  }
}
```

This requires significant design work (inheritance model, parameterization) and is explicitly deferred.

### 6. CLI Impact

The `workpipe build` command needs updates:

**Current behavior**:
- Resolves all `.workpipe` files
- Compiles each independently
- Writes output to `.github/workflows/`

**With imports**:
- Resolve files as before
- Build import graph
- Compile in dependency order (or detect imported files are not directly compiled)
- Option: `--include-deps` flag to also compile imported files if they contain workflows

**Important distinction**:
- Files containing ONLY type declarations (no workflows) produce no YAML output
- Files with workflows produce YAML, using types from imported files

### 7. Grammar Changes

New productions needed:

```lezer
@top Workflow { ImportDecl* TypeDecl* WorkflowDecl* }

ImportDecl {
  kw<"import"> "{" ImportList "}" kw<"from"> ImportPath
}

ImportList {
  ImportItem ("," ImportItem)*
}

ImportItem {
  Identifier (kw<"as"> Identifier)?
}

ImportPath {
  String  // Quoted path like "./types.workpipe"
}
```

**Reserved keywords to add**:
- `import`
- `from`
- `as` (already used? check grammar)

### 8. Error Codes

New diagnostic codes for import-related errors:

| Code | Severity | Description |
|------|----------|-------------|
| WP7001 | Error | Circular import detected |
| WP7002 | Error | Import file not found |
| WP7003 | Error | Type not exported by imported file |
| WP7004 | Error | Duplicate import of same type |
| WP7005 | Warning | Unused import |
| WP7006 | Error | Invalid import path (absolute path on CI, etc.) |
| WP7007 | Error | Import path resolves outside project root |

## Open Questions

### Q1: Should types be explicitly exported?

**Option A: All types are implicitly exported**
```workpipe
type BuildInfo { ... }  // Automatically importable
```

**Option B: Explicit export required**
```workpipe
export type BuildInfo { ... }  // Must opt-in to export
type InternalHelper { ... }    // Not importable
```

**Recommendation**: Start with implicit export (Option A). It's simpler, and the use case for "internal types" in a DSL is unclear. Add explicit export if users demonstrate need for encapsulation.

### Q2: How to handle import path in CI environments?

CI environments may have different working directories than local development. Options:

1. **Relative paths only**: Require all imports be relative to the importing file
2. **Project root marker**: Use `workpipe.config.js` or marker file to establish root
3. **Path aliases**: Allow `"@types/common.workpipe"` to map to project paths

**Recommendation**: Start with relative paths only. Add root marker/aliases if users report path fragility.

### Q3: Should imported types be available to downstream imports?

```workpipe
// a.workpipe
import { BuildInfo } from "./types.workpipe"

// b.workpipe
import { SomeType } from "./a.workpipe"
// Is BuildInfo available here?
```

**Options**:
1. **No (non-transitive)**: Only types declared in the file are importable
2. **Yes (transitive)**: All types visible in the file are importable
3. **Explicit re-export**: `export { BuildInfo } from "./types.workpipe"` in a.workpipe makes it importable from b.workpipe

**Recommendation**: Option 1 (non-transitive) for simplicity. Users who want to re-export can duplicate the import in each consuming file, or we add explicit re-export syntax later.

### Q4: How does this interact with future job imports?

If we later add job imports, should the syntax be unified?

```workpipe
import { BuildInfo } from "./types.workpipe"           // Type
import { checkout_job } from "./jobs.workpipe"         // Job
import { BuildInfo, checkout_job } from "./mixed.workpipe"  // Both
```

**Recommendation**: Design the import syntax to be extensible. Using `{ ... } from "path"` allows importing any named export regardless of kind (type, job, etc.).

### Q5: What about "index" files for directories?

Should `import { X } from "./types/"` automatically resolve to `./types/index.workpipe`?

**Recommendation**: No. Explicit is better. Users should write `import { X } from "./types/index.workpipe"`. This avoids directory vs file ambiguity and keeps resolution simple.

## Consequences

### Positive

1. **Type reuse**: Define types once, use across multiple workflows
2. **Reduced drift**: Single source of truth for shared types
3. **Better organization**: Large projects can split type definitions logically
4. **Familiar syntax**: JavaScript developers will recognize the import pattern
5. **Compile-time safety**: Import errors caught before runtime

### Negative

1. **Increased complexity**: Compiler must handle multi-file resolution
2. **Build time impact**: More files to parse and validate
3. **VS Code extension complexity**: Cross-file diagnostics and navigation
4. **Testing burden**: Import resolution edge cases
5. **Mental model change**: Users must think about file organization

### Neutral

1. **Backward compatible**: Files without imports work identically to today
2. **Optional feature**: Teams can choose not to use imports
3. **No runtime impact**: Imports are compile-time only

## Estimated Implementation Scope

### Phase 1: Grammar and Parser
- Add `import` syntax to grammar
- Parse import declarations to AST
- Reserve `import`, `from`, `as` keywords

### Phase 2: Path Resolution
- Implement relative path resolution
- File reading abstraction for CLI and VS Code
- Path normalization

### Phase 3: Dependency Graph
- Build import dependency graph
- Cycle detection algorithm
- Topological sort for compilation order

### Phase 4: Type Registry Merging
- Cross-file type resolution
- Name collision detection
- Import validation (type exists in target)

### Phase 5: Diagnostics
- Implement WP7001-WP7007 error codes
- Cross-file error reporting
- Unused import warnings

### Phase 6: CLI Integration
- Update `workpipe build` for multi-file compilation
- Update `workpipe check` for import validation
- Add import-aware file resolution

### Phase 7: VS Code Extension
- Cross-file diagnostics
- File watching for dependents
- Go-to-definition for imported types (stretch)

### Phase 8: Documentation
- Import syntax documentation
- Best practices guide
- Migration examples

## References

- [ADR-0011: User-Defined Type Declarations](0011-user-defined-type-declarations.md) - Foundation for types being imported
- [ADR-0003: Lezer Grammar Design](0003-lezer-grammar-design-and-expression-language.md) - Grammar extension approach
- [ADR-0009: VS Code Extension Architecture](0009-vscode-extension-architecture.md) - Editor integration implications
- PROJECT.md Section 5: Language overview
- TypeScript Module Documentation - https://www.typescriptlang.org/docs/handbook/modules.html
- ECMAScript Modules - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
