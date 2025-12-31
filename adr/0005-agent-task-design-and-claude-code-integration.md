# ADR-0005: Agent Task Design and Claude Code Integration

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WI-026 introduces first-class support for agentic tasks in WorkPipe - the project's core differentiator enabling Claude Code integration within GitHub Actions workflows. This ADR documents the design decisions for the `agent_job` and `agent_task` language constructs, their compilation to GitHub Actions YAML, and integration with the Claude Code Action.

### Background

PROJECT.md Section 9 defines agent tasks as a standardized way to invoke Claude Code with:
- MCP configuration (`--mcp-config`, `--strict-mcp-config`)
- Tool permissions (`--allowedTools`, `--disallowedTools`)
- Model and iteration controls (`--model`, `--max-turns`)
- System prompt strategy
- Structured output via JSON schema (`--json-schema`)
- Output artifact handling

The Claude Code Action (`anthropics/claude-code-action@v1`) accepts a `claude_args` parameter that passes CLI flags directly to Claude Code. WorkPipe must transform its declarative agent configuration into this flag format.

### Key Design Tensions

1. **Declarative DSL vs. CLI flag pass-through**: Should WorkPipe expose Claude Code flags directly or provide a higher-level abstraction?

2. **Token management**: Claude Code Action requires a GitHub token. Should WorkPipe generate token acquisition steps, or require users to configure tokens externally?

3. **Structured output reliability**: The Claude Code Action's output handling may vary across versions. How do we ensure reliable structured output retrieval?

4. **File reference resolution**: Prompts and schemas can be external files. How should paths be resolved?

### Prior Decisions

- **ADR-0003**: Reserved keywords `agent_job`, `agent_task`, `model`, `mcp`, `tools`, `system_prompt`, `prompt`, `output_artifact`, `output_schema` for Phase 4 grammar expansion.

- **ADR-0004**: Established extensible IR architecture with explicit provisions for new step types: "StepIR extension: Add additional step types."

## Decision

### 1. Grammar Structure for Agent Constructs

**Decision**: Introduce `agent_job` as a distinct job type and `agent_task` as a step type within it.

**Grammar additions**:

```
AgentJobDecl {
  kw<"agent_job"> Identifier AfterClause? "{" AgentJobBody "}"
}

AfterClause {
  kw<"after"> Identifier
}

AgentJobBody {
  AgentJobProperty*
}

AgentJobProperty {
  RunsOnProperty |
  NeedsProperty |
  StepsProperty |
  ConsumesProperty
}

ConsumesProperty {
  kw<"consumes"> Identifier kw<"from"> PropertyAccess
}

AgentTaskStep {
  kw<"agent_task"> "(" String ")" "{" AgentTaskBody "}"
}

AgentTaskBody {
  AgentTaskProperty*
}

AgentTaskProperty {
  ModelProperty |
  MaxTurnsProperty |
  ToolsBlock |
  McpBlock |
  SystemPromptProperty |
  PromptProperty |
  OutputSchemaProperty |
  OutputArtifactProperty
}

ModelProperty {
  kw<"model"> "=" StringOrIdent
}

MaxTurnsProperty {
  kw<"max_turns"> "=" Number
}

ToolsBlock {
  kw<"tools"> "{" ToolsProperty* "}"
}

ToolsProperty {
  AllowedProperty | DisallowedProperty
}

AllowedProperty {
  kw<"allowed"> "=" "[" StringList "]"
}

DisallowedProperty {
  kw<"disallowed"> "=" "[" StringList "]"
}

McpBlock {
  kw<"mcp"> "{" McpProperty* "}"
}

McpProperty {
  McpStrictProperty | McpConfigFileProperty
}

McpStrictProperty {
  kw<"strict"> "=" Boolean
}

McpConfigFileProperty {
  kw<"config_file"> "=" String
}

SystemPromptProperty {
  kw<"system_prompt"> "=" PromptValue
}

PromptProperty {
  kw<"prompt"> "=" PromptValue
}

PromptValue {
  String |
  FileRef |
  TemplateExpr
}

FileRef {
  kw<"file"> "(" String ")"
}

TemplateExpr {
  kw<"template"> "(" TripleString ")"
}

OutputSchemaProperty {
  kw<"output_schema"> "=" FileRef
}

OutputArtifactProperty {
  kw<"output_artifact"> "=" String
}
```

**Rationale**:
- `agent_job` as a distinct construct (vs. modifier on `job`) makes agent-specific properties like `consumes` unambiguous
- `after` clause provides explicit job ordering separate from `needs` (data dependencies)
- Nested blocks (`tools {}`, `mcp {}`) group related configuration, improving readability
- `file()` and `template()` wrappers make the value source explicit
- Property assignment uses `=` consistently (aligning with configuration style, distinct from YAML-like `:`)

### 2. Configuration Mapping to claude_args

**Decision**: Transform agent task properties to Claude Code CLI flags during the transform phase, building a single `claude_args` string.

**Mapping table**:

| WorkPipe Property | Claude Code Flag | Notes |
|-------------------|------------------|-------|
| `model = "sonnet"` | `--model sonnet` | Direct mapping |
| `max_turns = 10` | `--max-turns 10` | Direct mapping |
| `tools.allowed = [...]` | `--allowedTools '[...]'` | JSON array, single-quoted |
| `tools.disallowed = [...]` | `--disallowedTools '[...]'` | JSON array, single-quoted |
| `mcp.config_file = ".mcp.json"` | `--mcp-config .mcp.json` | Path as-is |
| `mcp.strict = true` | `--strict-mcp-config` | Flag only when true |
| `output_schema = file("...")` | `--json-schema '...'` | Schema content inlined or via env var |
| `system_prompt = "..."` | `--append-system-prompt '...'` | Default: append mode |
| `system_prompt = file("...")` | `--append-system-prompt '...'` | File content loaded |

**Flag ordering**: Flags are emitted in a deterministic order for reproducible output:
1. `--model`
2. `--max-turns`
3. `--allowedTools`
4. `--disallowedTools`
5. `--mcp-config`
6. `--strict-mcp-config`
7. `--json-schema`
8. `--append-system-prompt`

**Rationale**:
- Single `claude_args` string matches Claude Code Action interface
- JSON array format for tools aligns with Claude Code expectations
- Append mode for system prompts preserves Claude Code's default behavior while adding WorkPipe requirements
- Deterministic ordering ensures reproducible YAML output (per ADR-0004)

### 3. Output Artifact Handling Strategy

**Decision**: Implement a file-based output contract where WorkPipe injects output path requirements into the system prompt and generates an artifact upload step.

**Output file convention**:
```
.workpipe/out/<artifact_name>.json
```

**Implementation**:

1. **System prompt injection**: Append to the system prompt (after user-provided content):
   ```
   IMPORTANT: You MUST write your final JSON output to the file `.workpipe/out/<artifact_name>.json`.
   The output must be valid JSON matching the provided schema. Overwrite the file if it exists.
   Do not include any text outside the JSON structure in this file.
   ```

2. **Upload step generation**: After the Claude Code step, emit:
   ```yaml
   - name: Upload <artifact_name> output
     uses: actions/upload-artifact@v4
     with:
       name: wp.<workflow_slug>.<job_name>.<artifact_name>.${{ github.run_attempt }}
       path: .workpipe/out/<artifact_name>.json
       if-no-files-found: error
   ```

3. **Directory creation**: Inject a setup step before Claude Code:
   ```yaml
   - name: Create WorkPipe output directory
     run: mkdir -p .workpipe/out
   ```

**Rationale**:
- File-based output avoids coupling to Claude Code Action's internal output mechanisms (per PROJECT.md Section 9.2)
- System prompt injection ensures Claude writes to the expected location regardless of task complexity
- `if-no-files-found: error` fails fast if Claude doesn't produce output
- Artifact naming with `run_attempt` ensures uniqueness across retries (per PROJECT.md artifact naming rule)

### 4. Token Generation Strategy

**Decision**: Generate GitHub App token acquisition by default, with fallback to `GITHUB_TOKEN` when App configuration is unavailable.

**Default token generation** (when `output_artifact` is specified or MCP tools require repo access):
```yaml
- name: Generate GitHub App Token
  id: wp-app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.WORKPIPE_APP_ID }}
    private-key: ${{ secrets.WORKPIPE_APP_PRIVATE_KEY }}
  continue-on-error: true

- name: Set GitHub Token
  id: wp-token
  run: |
    if [ -n "${{ steps.wp-app-token.outputs.token }}" ]; then
      echo "token=${{ steps.wp-app-token.outputs.token }}" >> $GITHUB_OUTPUT
    else
      echo "token=${{ github.token }}" >> $GITHUB_OUTPUT
    fi
```

**Token usage in Claude Code step**:
```yaml
- uses: anthropics/claude-code-action@v1
  with:
    github_token: ${{ steps.wp-token.outputs.token }}
```

**Rationale**:
- GitHub App tokens provide elevated permissions needed for cross-repository operations and avoiding rate limits
- Fallback to `GITHUB_TOKEN` ensures workflows run even without App configuration (with reduced capabilities)
- `continue-on-error: true` on App token step prevents workflow failure when App isn't configured
- Standardized step IDs (`wp-app-token`, `wp-token`) enable predictable token references

**Configuration expectation**: Users configure a GitHub App and set:
- `vars.WORKPIPE_APP_ID`: App ID as a repository variable
- `secrets.WORKPIPE_APP_PRIVATE_KEY`: App private key as a repository secret

### 5. Artifact Naming Convention

**Decision**: Use a hierarchical naming scheme that guarantees uniqueness across workflows, jobs, artifacts, and run attempts.

**Format**:
```
wp.<workflow_slug>.<job_name>.<artifact_name>.${{ github.run_attempt }}
```

**Components**:
- `wp.`: Prefix identifying WorkPipe-managed artifacts
- `<workflow_slug>`: Workflow name converted to kebab-case (e.g., "Issue Pipeline" -> "issue-pipeline")
- `<job_name>`: Job identifier as declared in WorkPipe source
- `<artifact_name>`: Artifact identifier from `output_artifact` or `emits`
- `${{ github.run_attempt }}`: GitHub-provided run attempt number

**Examples**:
- `wp.issue-pipeline.triage.triage_output.1`
- `wp.ci-workflow.build.coverage_report.2`

**Rationale**:
- Hierarchical structure enables artifact filtering and discovery
- `wp.` prefix distinguishes WorkPipe artifacts from user-created artifacts
- Run attempt suffix prevents v4 immutability conflicts (per PROJECT.md Section 2.1)
- Slug conversion ensures valid artifact names (no spaces or special characters)

### 6. File Reference Resolution

**Decision**: Resolve all file references relative to the repository root.

**Resolution rules**:
- `file("prompts/po.system.txt")` resolves to `<repo_root>/prompts/po.system.txt`
- `file("schemas/triage.schema.json")` resolves to `<repo_root>/schemas/triage.schema.json`
- Absolute paths are not supported (portability concern)
- Paths must not escape repository root (`../` that escapes is an error)

**Compile-time behavior**:
- File existence is NOT validated at compile time
- File content is NOT inlined at compile time
- Generated YAML references the path; content is read at workflow runtime

**Runtime file loading** (for system prompts and schemas):
```yaml
env:
  WP_SYSTEM_PROMPT: ${{ github.workspace }}/prompts/po.system.txt
  WP_SCHEMA_PATH: ${{ github.workspace }}/schemas/triage.schema.json
```

For small schemas (< 1KB), content is loaded into an environment variable:
```yaml
- name: Load schema content
  id: wp-schema
  run: |
    SCHEMA_CONTENT=$(cat schemas/triage.schema.json | jq -c .)
    echo "content=$SCHEMA_CONTENT" >> $GITHUB_OUTPUT
```

For larger schemas, the file path is passed directly:
```yaml
claude_args: >
  --json-schema-file ${{ github.workspace }}/schemas/triage.schema.json
```

**Rationale**:
- Repository-relative paths are portable across clones and forks
- Runtime resolution ensures files can be modified without recompilation
- Deferring validation to runtime simplifies the compiler (missing files become runtime errors with clear messages)
- Size-based strategy for schema handling balances command-line length limits with simplicity

### 7. Error Handling for Missing Files

**Decision**: Defer file existence validation to workflow runtime, with clear error messages.

**Compile-time**:
- Parser accepts any valid string as file path
- No file system access during compilation
- No validation of file existence or content

**Runtime**:
- Missing files produce clear error messages from file-reading steps
- Schema validation errors surface from Claude Code's `--json-schema` processing
- System prompt file errors surface from the load step

**Generated error handling**:
```yaml
- name: Load system prompt
  id: wp-system-prompt
  run: |
    if [ ! -f "prompts/po.system.txt" ]; then
      echo "::error file=prompts/po.system.txt::WorkPipe: System prompt file not found"
      exit 1
    fi
    cat prompts/po.system.txt
```

**Rationale**:
- Compile-time file validation would require file system access, complicating the compiler
- Runtime errors provide actionable context (file path, job name)
- GitHub Actions error annotations (`::error file=...`) integrate with PR checks
- Matches behavior of other CI systems where file references are runtime-resolved

### 8. AST Node Types

**Decision**: Introduce dedicated AST node types for agent constructs.

**New types in `ast/types.ts`**:

```typescript
export interface AgentJobNode {
  readonly kind: "agent_job";
  readonly name: string;
  readonly after: string | null;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly steps: readonly StepNode[];
  readonly consumes: readonly ConsumeNode[];
  readonly span: Span;
}

export interface AgentTaskNode {
  readonly kind: "agent_task";
  readonly taskName: string;
  readonly model: string | null;
  readonly maxTurns: number | null;
  readonly tools: ToolsConfigNode | null;
  readonly mcp: McpConfigNode | null;
  readonly systemPrompt: PromptValueNode | null;
  readonly prompt: PromptValueNode | null;
  readonly outputSchema: string | null;
  readonly outputArtifact: string | null;
  readonly span: Span;
}

export interface ToolsConfigNode {
  readonly kind: "tools_config";
  readonly allowed: readonly string[] | null;
  readonly disallowed: readonly string[] | null;
  readonly span: Span;
}

export interface McpConfigNode {
  readonly kind: "mcp_config";
  readonly strict: boolean | null;
  readonly configFile: string | null;
  readonly span: Span;
}

export type PromptValueNode =
  | LiteralPromptNode
  | FilePromptNode
  | TemplatePromptNode;

export interface LiteralPromptNode {
  readonly kind: "literal_prompt";
  readonly value: string;
  readonly span: Span;
}

export interface FilePromptNode {
  readonly kind: "file_prompt";
  readonly path: string;
  readonly span: Span;
}

export interface TemplatePromptNode {
  readonly kind: "template_prompt";
  readonly content: string;
  readonly span: Span;
}

export interface ConsumeNode {
  readonly kind: "consume";
  readonly artifactName: string;
  readonly sourceJob: string;
  readonly sourceArtifact: string;
  readonly span: Span;
}
```

**Type union updates**:
```typescript
export type StepNode = RunStepNode | UsesStepNode | AgentTaskNode;

export type AnyJobNode = JobNode | AgentJobNode;
```

**Rationale**:
- Distinct `AgentJobNode` allows type-safe handling of agent-specific properties
- `AgentTaskNode` captures all Claude Code configuration in a structured form
- Nested config nodes (`ToolsConfigNode`, `McpConfigNode`) preserve source structure for diagnostics
- `PromptValueNode` discriminated union enables type-safe handling of literal/file/template variants
- All nodes include `span` for error reporting with source locations

### 9. IR Types for Code Generation

**Decision**: Extend YAML IR with agent-specific step types.

**New IR types in `codegen/yaml-ir.ts`**:

```typescript
export interface ClaudeCodeStepIR {
  readonly kind: "claude_code";
  readonly name: string;
  readonly id?: string;
  readonly uses: "anthropics/claude-code-action@v1";
  readonly with: {
    readonly github_token: string;
    readonly claude_args: string;
    readonly prompt?: string;
  };
  readonly env?: Record<string, string>;
}

export interface UploadArtifactStepIR {
  readonly kind: "upload_artifact";
  readonly name: string;
  readonly uses: "actions/upload-artifact@v4";
  readonly with: {
    readonly name: string;
    readonly path: string;
    readonly "if-no-files-found": "error" | "warn" | "ignore";
  };
}

export interface DownloadArtifactStepIR {
  readonly kind: "download_artifact";
  readonly name: string;
  readonly uses: "actions/download-artifact@v4";
  readonly with: {
    readonly name: string;
    readonly path?: string;
  };
}

export interface SetupStepIR {
  readonly kind: "setup";
  readonly name: string;
  readonly id?: string;
  readonly run: string;
}
```

**Extended StepIR union**:
```typescript
export type StepIR =
  | RunStepIR
  | UsesStepIR
  | ClaudeCodeStepIR
  | UploadArtifactStepIR
  | DownloadArtifactStepIR
  | SetupStepIR;
```

**Rationale**:
- Dedicated IR types enable type-safe emit logic for each step variant
- `ClaudeCodeStepIR.with` structure mirrors the action's input schema
- Separate artifact IR types support both upload and download (for `consumes`)
- `SetupStepIR` handles generated shell commands (directory creation, file loading)

### 10. Template Expression Handling

**Decision**: Parse template interpolations (`{{...}}`) as strings for now; defer semantic validation to a future type-checking phase.

**Current scope**:
- Grammar recognizes `template("""...""")` wrapper
- Content between `{{` and `}}` is captured as raw string
- AST stores template content with interpolation markers intact
- Transform phase passes template to runtime (GitHub Actions expressions handle substitution)

**Future work** (separate work item):
- Parse interpolation expressions during AST building
- Validate references against workflow inputs, job outputs, artifacts
- Type-check interpolated values

**Runtime behavior**:
Template content is emitted as a GitHub Actions expression that performs substitution:
```yaml
prompt: |
  triage issue ${{ inputs.issue_number }}.
  Use the repo docs as canonical.
```

**Rationale**:
- Immediate value: agent tasks work with templates without blocking on type-checking infrastructure
- GitHub Actions expressions provide runtime interpolation
- Deferred validation follows ADR-0003's incremental approach
- Type checking can be added without grammar changes

## Alternatives Considered

### Alternative 1: Modifier on Regular Job Instead of agent_job

**Approach**: Use `job foo agent { ... }` instead of `agent_job foo { ... }`.

```workpipe
job triage agent {
  runs_on: ubuntu-latest
  steps: [
    agent_task("Review code") { ... }
  ]
}
```

**Pros**:
- Unified job construct
- Agent capability as an additive modifier

**Cons**:
- Agent jobs have different valid properties (`consumes`, no arbitrary steps mixed)
- Modifier syntax less clear than distinct keyword
- Harder to validate that non-agent steps aren't mixed with agent_task

**Decision**: Rejected. Distinct `agent_job` keyword makes agent-specific validation cleaner and the syntax more readable.

### Alternative 2: Direct CLI Flag Pass-through

**Approach**: Allow users to specify `claude_args` directly.

```workpipe
agent_task("Review") {
  claude_args = "--model sonnet --max-turns 10"
}
```

**Pros**:
- Full flexibility for any Claude Code flag
- No abstraction leakage

**Cons**:
- Loses type safety (no validation of flag syntax)
- Harder to provide IDE completion
- No structured access for transforms (e.g., extracting model for diagnostics)

**Decision**: Rejected. Structured configuration enables validation, IDE support, and future optimizations. An escape hatch (`raw_claude_args`) can be added if needed.

### Alternative 3: Inline Schema Content in DSL

**Approach**: Allow schema JSON directly in WorkPipe source.

```workpipe
agent_task("Review") {
  output_schema = json"""
    {
      "type": "object",
      "properties": { ... }
    }
  """
}
```

**Pros**:
- Self-contained spec
- No external file dependencies

**Cons**:
- Large schemas bloat WorkPipe files
- Duplicates schema if used in multiple tasks
- Harder to maintain schemas separately
- JSON in DSL requires careful escaping

**Decision**: Rejected. File references keep WorkPipe specs focused on workflow structure. Schemas are typically maintained as separate artifacts.

### Alternative 4: Compile-Time File Validation

**Approach**: Validate file existence and content during compilation.

**Pros**:
- Earlier error detection
- Can inline file content in generated YAML

**Cons**:
- Requires file system access during compilation
- Complicates pure-function compiler design
- Files may change between compile and run
- Cross-platform path handling complexity

**Decision**: Rejected. Runtime validation aligns with GitHub Actions' model and keeps the compiler simple.

### Alternative 5: Always Use GITHUB_TOKEN

**Approach**: Don't generate App token steps; use default token.

**Pros**:
- Simpler generated YAML
- No App configuration required

**Cons**:
- `GITHUB_TOKEN` has limited permissions
- Can't trigger other workflows
- Rate limits apply
- MCP tools may need elevated access

**Decision**: Rejected. App token with fallback provides flexibility for both simple and advanced use cases.

## Consequences

### Positive

1. **Clear agent syntax**: `agent_job` and `agent_task` provide a readable, declarative way to configure Claude Code integration

2. **Type-safe configuration**: Structured properties enable validation, IDE completion, and meaningful error messages

3. **Reliable output handling**: File-based output contract with artifact upload ensures structured output is captured regardless of Claude Code Action internals

4. **Flexible token management**: App token with fallback supports both simple workflows and advanced cross-repo scenarios

5. **Predictable artifact naming**: Hierarchical naming prevents collisions and enables artifact discovery

6. **Extensible design**: AST and IR types support future enhancements (new Claude Code flags, additional output formats)

### Negative

1. **Runtime file errors**: Missing prompt/schema files only surface at workflow execution time, not compile time

2. **Token configuration burden**: Users must set up GitHub App for full capabilities

3. **Generated YAML verbosity**: Token generation, directory setup, and artifact upload add multiple steps per agent task

4. **Template validation deferred**: Type errors in `{{...}}` expressions won't be caught until runtime

### Neutral

1. **Append-only system prompt**: WorkPipe always appends to system prompt (including output instructions); users can't fully replace Claude Code's default system prompt

2. **Schema size threshold**: The 1KB threshold for inline vs. file-based schema handling is somewhat arbitrary

3. **No mixed steps**: `agent_job` only allows `agent_task` steps, not arbitrary `run`/`uses` steps (enforced by grammar)

## References

- PROJECT.md Section 9: Agentic tasks (Claude Code Action) specification
- PROJECT.md Section 2.1: Artifacts v4 immutability constraints
- ADR-0003: Reserved keywords for agent constructs
- ADR-0004: YAML IR extensibility for new step types
- [Claude Code CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [actions/create-github-app-token](https://github.com/actions/create-github-app-token)
- [actions/upload-artifact@v4](https://github.com/actions/upload-artifact)
