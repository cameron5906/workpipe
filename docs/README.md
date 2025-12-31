# WorkPipe Documentation

WorkPipe is a domain-specific language (DSL) that compiles to GitHub Actions workflow YAML files. It provides a cleaner, type-safe way to define CI/CD pipelines.

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Installation, first workflow, and project setup |
| [CLI Reference](cli-reference.md) | Complete documentation of all CLI commands |
| [Language Reference](language-reference.md) | Full syntax and semantics guide |
| [Error Reference](errors.md) | Diagnostic codes and how to fix them |

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

## Project Resources

- [PROJECT.md](../PROJECT.md) - Language and compiler design document
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and implementation details
- [examples/](../examples/) - Example WorkPipe files
