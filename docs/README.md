# WorkPipe Documentation

WorkPipe is a domain-specific language (DSL) that compiles to GitHub Actions workflow YAML files. It provides a cleaner, type-safe way to define CI/CD pipelines.

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Installation, first workflow, and project setup |
| [CLI Reference](cli-reference.md) | Complete documentation of all CLI commands |
| [Language Reference](language-reference.md) | Full syntax and semantics guide |
| [Error Reference](errors.md) | Diagnostic codes and how to fix them |
| [Troubleshooting](troubleshooting.md) | Common errors with examples and fixes |
| [VS Code Extension](vscode-extension.md) | Installation, features, and troubleshooting |

## Quick Links

### Installation

```bash
npm install -g @workpipe/cli
```

### First Workflow

```workpipe
workflow ci {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo Hello, WorkPipe!")
    ]
  }
}
```

### Compile

```bash
workpipe build workpipe/ci.workpipe
```

## Key Features

| Feature | Documentation |
|---------|--------------|
| User-Defined Types | [Language Reference: Types](language-reference.md#user-defined-types) |
| Cross-File Imports | [Language Reference: Imports](language-reference.md#imports) |
| AI Agent Tasks | [Language Reference: Agent Jobs](language-reference.md#agent-jobs) |
| Iterative Cycles | [Language Reference: Cycles](language-reference.md#cycles) |
| Matrix Builds | [Language Reference: Matrices](language-reference.md#matrices) |
| Guard Expressions | [Language Reference: Guard JS Blocks](language-reference.md#guard-js-blocks) |

## Project Resources

- [PROJECT.md](../PROJECT.md) - Language and compiler design document
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and implementation details
- [examples/](../examples/) - Example WorkPipe files
