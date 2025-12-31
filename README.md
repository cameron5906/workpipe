# WorkPipe

**A cleaner way to write GitHub Actions workflows.**

WorkPipe is a domain-specific language (DSL) that compiles to GitHub Actions YAML. Write expressive, type-safe CI/CD pipelines without the verbosity.

## Why WorkPipe?

GitHub Actions YAML is powerful but verbose. Simple workflows become walls of repetitive configuration. WorkPipe fixes this:

| WorkPipe | GitHub Actions YAML |
|----------|---------------------|
| 10 lines | 8 lines |
| Clean syntax | Nested YAML |
| Type-safe parameters | Stringly-typed |
| Reusable patterns | Copy-paste |

**Before (YAML):**
```yaml
name: minimal
on: push
jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo Hello, WorkPipe!
```

**After (WorkPipe):**
```workpipe
workflow minimal {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo Hello, WorkPipe!")
    ]
  }
}
```

The difference grows dramatically with real-world workflows featuring matrices, job dependencies, and conditional logic.

## Installation

**Prerequisites:** Node.js 20+

```bash
# npm
npm install -g @workpipe/cli

# pnpm
pnpm add -g @workpipe/cli
```

Verify installation:

```bash
workpipe --version
```

## 5-Minute Quickstart

### 1. Create a WorkPipe file

Create `workpipe/ci.workpipe` in your project:

```bash
mkdir -p workpipe
```

Add this content:

```workpipe
workflow ci {
  on: [push, pull_request]

  job test {
    runs_on: ubuntu-latest
    steps: [
      uses("actions/checkout@v4"),
      uses("actions/setup-node@v4") {
        with: {
          node-version: "20"
        }
      },
      run("npm ci"),
      run("npm test")
    ]
  }
}
```

### 2. Compile to YAML

```bash
workpipe build workpipe/ci.workpipe
```

This generates `.github/workflows/ci.yml`:

```yaml
name: ci
on:
  - push
  - pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

### 3. Commit and push

```bash
git add workpipe/ci.workpipe .github/workflows/ci.yml
git commit -m "Add CI workflow with WorkPipe"
git push
```

Your workflow is now live on GitHub Actions.

## Key Features

- **Clean syntax** - No more YAML indentation anxiety
- **Job dependencies** - `needs: [build, test]` just works
- **Matrix builds** - Expressive multi-dimensional matrices
- **Conditional execution** - `when:` expressions for job/step control
- **User-defined types** - Reusable type definitions with compile-time validation
- **Agent jobs** - First-class support for AI-powered CI tasks
- **Cycles** - Iterative workflows that span multiple runs
- **Validation** - Catch errors before pushing with `workpipe check`
- **Formatting** - Consistent style with `workpipe fmt`

## CLI Commands

| Command | Description |
|---------|-------------|
| `workpipe build [files...]` | Compile to GitHub Actions YAML |
| `workpipe check [files...]` | Validate without generating output |
| `workpipe fmt [files...]` | Format source files |
| `workpipe init --bootstrap` | Generate auto-compile workflow |

## What's Next?

Ready to dive deeper?

- [Getting Started Guide](docs/getting-started.md) - Full walkthrough with examples
- [Language Reference](docs/language-reference.md) - Complete syntax documentation
- [CLI Reference](docs/cli-reference.md) - All commands and options

## Project Status

WorkPipe is in active development. The current release includes:

- 5 packages: `@workpipe/cli`, `@workpipe/compiler`, `@workpipe/lang`, `@workpipe/action`, and VS Code extension
- 326+ passing tests
- Full compiler pipeline: lexer, parser, semantic analysis, code generation

## License

MIT
