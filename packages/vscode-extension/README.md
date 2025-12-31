# WorkPipe VS Code Extension

Syntax highlighting and diagnostics for the WorkPipe DSL.

## Features

- Syntax highlighting for `.workpipe` and `.wp` files
- Real-time diagnostics from the WorkPipe compiler
- Auto-closing pairs for brackets and strings
- Comment toggling support

## Supported Keywords

### Workflow Structure
- `workflow`, `job`, `agent_job`, `cycle`

### Control Flow
- `on`, `if`, `needs`, `after`

### Cycle Properties
- `max_iters`, `until`, `guard_js`, `body`, `key`

### Job Properties
- `runs_on`, `steps`, `model`, `max_turns`
- `tools`, `mcp`, `system_prompt`, `prompt`
- `output_schema`, `output_artifact`, `consumes`

### Step Types
- `run`, `uses`, `agent_task`

### Tool Configuration
- `allowed`, `disallowed`, `strict`, `config_file`

### References
- `file`, `template`, `from`

## Installation

This extension is part of the WorkPipe monorepo. To install for development:

1. Run `pnpm install` in the monorepo root
2. Run `pnpm build` in `packages/vscode-extension`
3. Press F5 to launch a development host with the extension

## Development

```bash
# Build the extension
pnpm build

# Watch for changes
pnpm watch

# Run tests
pnpm test
```
