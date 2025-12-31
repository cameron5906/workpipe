# ADR-0012: Import System for Cross-File References

**Date**: 2025-12-31
**Status**: Accepted
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

## Final Decisions on Open Questions

### Q1: Explicit exports? DECISION: Implicit (All types exportable)

**Decision**: All types are implicitly exported.

```workpipe
type BuildInfo { ... }  // Automatically importable
```

**Rationale**:
- WorkPipe is a DSL, not a general-purpose language; encapsulation needs are minimal
- Simpler mental model: "define a type, use it anywhere"
- Reduces syntax complexity (no `export` keyword needed)
- If users demonstrate need for encapsulation, we can add explicit `export` later without breaking existing code (all types would default to exported)

### Q2: CI path handling? DECISION: Relative paths only

**Decision**: Require all imports to use relative paths resolved from the importing file's directory.

```workpipe
import { BuildInfo } from "./types.workpipe"           // Same directory
import { CommonType } from "../shared/types.workpipe"  // Parent directory
```

**Rationale**:
- Relative paths work identically in local dev and CI environments
- No need for additional configuration files or path mapping
- Portable across different project structures
- Simpler implementation (no need to find project root)
- If users report path fragility in deep directory structures, we can add path aliases as a future extension

**Constraints**:
- Paths must start with `./` or `../`
- Absolute paths are rejected with error WP7006
- Paths resolving outside project root are rejected with error WP7007 (detected via path normalization)

### Q3: Transitive imports? DECISION: Non-transitive

**Decision**: Only types declared in a file are importable from that file. Imported types are not re-exported.

```workpipe
// types.workpipe
type BuildInfo { version: string }

// a.workpipe
import { BuildInfo } from "./types.workpipe"
type ExtendedInfo { build: BuildInfo, extra: string }

// b.workpipe
import { ExtendedInfo } from "./a.workpipe"
import { BuildInfo } from "./types.workpipe"  // Must import directly
// BuildInfo is NOT available via a.workpipe
```

**Rationale**:
- Explicit dependencies are self-documenting
- Avoids "diamond dependency" confusion
- Each file's imports clearly show all its external dependencies
- If users want to aggregate types, they can create a "barrel" file that imports and re-defines types (or we add explicit re-export syntax later)

### Q4: Future job imports? DECISION: Design for extensibility

**Decision**: The `{ name } from "path"` syntax is designed to import any named entity, not just types. Future job imports will use the same syntax.

```workpipe
import { BuildInfo } from "./types.workpipe"           // Type import
import { checkout_job } from "./jobs.workpipe"         // Future: Job import
import { BuildInfo, checkout_job } from "./mixed.workpipe"  // Future: Both
```

**Rationale**:
- Consistent syntax reduces cognitive load
- Grammar already supports this (identifier list from path)
- Resolution layer determines entity kind based on what's declared in the target file
- No syntax changes needed when we add job imports

**Implementation note**: The initial implementation only resolves type names. Attempting to import a job name will produce error WP7003 ("Type not found"). When job imports are implemented, the resolver will be extended to handle both kinds.

### Q5: Index files? DECISION: No (explicit paths required)

**Decision**: Directory imports are not supported. Users must specify the full file path including filename.

```workpipe
// NOT supported
import { X } from "./types/"

// Required
import { X } from "./types/index.workpipe"
```

**Rationale**:
- Avoids ambiguity between directory and file
- Explicit paths are self-documenting
- Simpler implementation (no directory detection or implicit file resolution)
- Easier to grep/search for import sources
- Matches WorkPipe's "explicit is better" design philosophy

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

## Implementation Guidance

This section provides detailed guidance for implementing each phase, including key files to modify, critical design decisions, and integration points.

### Phase 1: Grammar and Parser

**Objective**: Add import syntax to the Lezer grammar and parse to AST nodes.

**Key Files to Modify**:
- `packages/lang/src/workpipe.grammar` - Add grammar productions
- `packages/compiler/src/ast/types.ts` - Add `ImportDeclarationNode` type
- `packages/compiler/src/ast/builder.ts` - Add AST construction for imports

**Grammar Changes**:
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
  String
}
```

**AST Node Design**:
```typescript
interface ImportDeclarationNode {
  kind: "import_declaration";
  items: ImportItemNode[];
  path: string;
  span: Span;
}

interface ImportItemNode {
  name: string;
  alias?: string;
  span: Span;
}

interface WorkPipeFileNode {
  imports: ImportDeclarationNode[];  // NEW
  types: TypeDeclarationNode[];
  workflows: WorkflowNode[];
}
```

**Critical Decisions**:
- Imports MUST appear before type declarations in grammar (enforced by production order)
- The `as` keyword must be added to reserved keywords
- Import path is captured as raw string; validation happens in later phases

**Test Cases**:
- Basic import: `import { BuildInfo } from "./types.workpipe"`
- Aliased import: `import { BuildInfo as BI } from "./types.workpipe"`
- Multiple imports: `import { A, B, C } from "./types.workpipe"`
- Multi-line imports with commas
- Parse errors for malformed imports

---

### Phase 2: Path Resolution

**Objective**: Resolve import paths relative to the importing file and read file contents.

**Key Files to Modify**:
- `packages/compiler/src/imports/resolver.ts` (NEW)
- `packages/compiler/src/index.ts` - Update `compile()` signature

**New API Design**:
```typescript
// packages/compiler/src/imports/resolver.ts
export interface FileResolver {
  read(absolutePath: string): Promise<string>;
  exists(absolutePath: string): Promise<boolean>;
}

export interface ResolveResult {
  absolutePath: string;
  normalizedPath: string;  // For deduplication
}

export function resolveImportPath(
  importPath: string,
  importingFilePath: string,
  projectRoot?: string
): ResolveResult | { error: Diagnostic };
```

**Compiler API Change**:
```typescript
// Before
export function compile(source: string): CompileResult<string>

// After
export interface CompileOptions {
  source: string;
  filePath: string;  // Absolute path to source file
  fileResolver: FileResolver;
  projectRoot?: string;  // For escape detection
}

export function compile(options: CompileOptions): Promise<CompileResult<string>>

// Backward compatibility wrapper
export function compileSource(source: string): CompileResult<string>
```

**Path Validation Rules**:
1. Must start with `./` or `../`
2. Must end with `.workpipe`
3. Normalized path must not escape project root (if provided)
4. Path normalization: resolve `..` and `.` segments

**Critical Decisions**:
- File resolution is async (Promise-based) to support both Node.js fs and VS Code workspace APIs
- Path normalization uses POSIX-style forward slashes internally
- Windows backslashes are converted on input

**Integration Points**:
- CLI: Uses Node.js `fs.readFile`
- VS Code: Uses `vscode.workspace.fs.readFile`
- Tests: Uses in-memory file map

---

### Phase 3: Dependency Graph

**Objective**: Build import graph, detect cycles, determine compilation order.

**Key Files to Modify**:
- `packages/compiler/src/imports/graph.ts` (NEW)
- `packages/compiler/src/imports/cycle-detection.ts` (NEW)

**Graph Structure**:
```typescript
interface ImportGraph {
  nodes: Map<string, ImportGraphNode>;  // normalizedPath -> node
  addFile(path: string, imports: string[]): void;
  hasCycle(): boolean;
  getCycle(): string[] | null;  // Participating files
  topologicalSort(): string[];  // Compilation order
}

interface ImportGraphNode {
  path: string;
  imports: string[];  // Paths this file imports
  importedBy: string[];  // Paths that import this file
}
```

**Cycle Detection Algorithm**:
- Use Tarjan's SCC algorithm or iterative DFS with color marking
- If any SCC has size > 1, there's a cycle
- Report the cycle path for error message

**Error Message Format**:
```
error[WP7001]: Circular import detected
  --> a.workpipe:1:1
   |
 1 | import { TypeB } from "./b.workpipe"
   | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = Import cycle: a.workpipe -> b.workpipe -> a.workpipe
```

**Critical Decisions**:
- Cycle detection runs BEFORE any file is fully compiled
- Use a two-phase approach: scan imports, then full compile
- Cache parsed files to avoid re-parsing shared dependencies

---

### Phase 4: Type Registry Merging

**Objective**: Merge types from imported files into the main file's type registry.

**Key Files to Modify**:
- `packages/compiler/src/semantics/type-registry.ts` - Add merge capability
- `packages/compiler/src/imports/type-merger.ts` (NEW)

**Registry Changes**:
```typescript
interface TypeRegistry {
  // Existing
  register(type: TypeDeclarationNode): Diagnostic | null;
  resolve(name: string): TypeDeclarationNode | undefined;
  has(name: string): boolean;

  // NEW
  registerImported(
    type: TypeDeclarationNode,
    alias: string | undefined,
    importSpan: Span
  ): Diagnostic | null;

  getImportSource(typeName: string): string | undefined;
}
```

**Merge Process**:
1. Parse imported file
2. Build type registry for imported file (types declared in that file only)
3. For each import item, look up type in imported file's registry
4. If found, register in main file's registry with alias (if any)
5. Track import source for diagnostics and go-to-definition

**Name Collision Handling**:
- Local types always win over imported types with same name
- Two imported types with same name (no alias): error WP7004
- Aliasing prevents collisions

**Critical Decisions**:
- Only types DECLARED in the target file are importable (non-transitive)
- Imported type spans point to the import statement, not the original declaration
- Type compatibility uses structural typing (same as before)

---

### Phase 5: Diagnostics

**Objective**: Implement all import-related error codes with helpful messages.

**Key Files to Modify**:
- `packages/compiler/src/diagnostic/codes.ts` - Add WP7xxx codes
- `packages/compiler/src/imports/diagnostics.ts` (NEW)

**Error Code Implementations**:

| Code | Implementation Location | Message Template |
|------|------------------------|------------------|
| WP7001 | cycle-detection.ts | "Circular import detected" + cycle path |
| WP7002 | resolver.ts | "Import file not found: '{path}'" |
| WP7003 | type-merger.ts | "Type '{name}' not found in '{path}'" |
| WP7004 | type-merger.ts | "Duplicate import of type '{name}'" |
| WP7005 | unused-imports.ts | "Unused import: '{name}'" (warning) |
| WP7006 | resolver.ts | "Absolute import paths are not allowed" |
| WP7007 | resolver.ts | "Import path escapes project root" |

**Unused Import Detection**:
- Track which imported types are actually referenced
- Report as warning (does not block compilation)
- Implementation in separate phase after type checking

**Critical Decisions**:
- Span should point to the specific import item, not the whole statement
- Include hint suggesting similar type names for WP7003
- WP7005 is a warning, not an error

---

### Phase 6: CLI Integration

**Objective**: Update CLI commands to handle multi-file compilation with imports.

**Key Files to Modify**:
- `packages/cli/src/commands/build.ts`
- `packages/cli/src/commands/check.ts`
- `packages/cli/src/file-resolver.ts` (NEW)

**Build Command Changes**:
```typescript
// Current: compile each file independently
for (const file of files) {
  const source = await fs.readFile(file);
  const result = compile(source);
}

// New: build dependency graph, compile in order
const graph = await buildImportGraph(files, fileResolver);
if (graph.hasCycle()) {
  // Report cycle error
}

const order = graph.topologicalSort();
const compiledFiles = new Map<string, TypeRegistry>();

for (const file of order) {
  const result = await compile({
    source: await fs.readFile(file),
    filePath: file,
    fileResolver,
    compiledDependencies: compiledFiles
  });
  compiledFiles.set(file, result.registry);
}
```

**File Discovery Changes**:
- Still discover all `.workpipe` files
- But also discover files referenced by imports (may be outside glob pattern)
- "Type-only" files (no workflows) produce no YAML output

**Critical Decisions**:
- Files are compiled in dependency order (leaves first)
- Each file's type registry is cached for dependent files
- Imported files don't need to be in the glob pattern

---

### Phase 7: VS Code Extension

**Objective**: Update extension for cross-file diagnostics and navigation.

**Key Files to Modify**:
- `packages/vscode-extension/src/diagnostics.ts`
- `packages/vscode-extension/src/extension.ts`
- `packages/vscode-extension/src/file-watcher.ts` (NEW)

**Diagnostic Changes**:
- Diagnostics may reference other files (import errors)
- Need to invalidate diagnostics for files that import a changed file

**File Watching Strategy**:
```typescript
// Build reverse dependency map
const dependents = new Map<string, Set<string>>();

// On file save
async function onFileSave(changedFile: string) {
  // Recompile changed file
  await compileAndShowDiagnostics(changedFile);

  // Recompile all files that import this file
  for (const dependent of dependents.get(changedFile) ?? []) {
    await compileAndShowDiagnostics(dependent);
  }
}
```

**Future: Go-to-Definition for Imported Types**:
- Track original declaration location in TypeRegistry
- Return location in target file for imported types
- Requires LSP implementation (Phase 2 of extension)

**Critical Decisions**:
- File watching uses debouncing to avoid excessive recompilation
- Reverse dependency map is rebuilt on workspace open and file create/delete
- Diagnostics from imported files appear in the importing file's problems list

---

### Phase 8: Documentation

**Objective**: Document import syntax and best practices.

**Deliverables**:
1. **Syntax Reference**: Add to existing language documentation
2. **Best Practices Guide**: Organization patterns for large projects
3. **Migration Guide**: How to extract shared types from existing files
4. **Example Project**: Multi-file workflow repository

**Documentation Outline**:
```markdown
# Imports

## Basic Syntax
import { TypeName } from "./path.workpipe"

## Aliasing
import { TypeName as Alias } from "./path.workpipe"

## Multiple Imports
import { TypeA, TypeB, TypeC } from "./path.workpipe"

## Path Resolution
- Paths are relative to the importing file
- Must start with ./ or ../
- Must include .workpipe extension

## Best Practices
- Keep type-only files in a `types/` directory
- Use meaningful file names (e.g., `build-types.workpipe`)
- Avoid deep nesting (prefer flat structure)
- One "domain" per type file
```

---

## Estimated Implementation Scope (Summary)

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
