# Getting Started with WorkPipe

WorkPipe is a domain-specific language (DSL) that compiles to GitHub Actions workflow YAML files. It provides a cleaner, type-safe way to define CI/CD pipelines with features like typed parameter passing, agentic task support, and cycle-based iterative workflows.

## Installation

### Prerequisites

- Node.js 20 or later
- npm or pnpm

### Install via npm

```bash
npm install -g @workpipe/cli
```

### Verify Installation

```bash
workpipe --version
```

## Your First Workflow

### Step 1: Create a WorkPipe File

Create a file named `ci.workpipe` in a `workpipe/` directory at your project root:

```bash
mkdir -p workpipe
```

Add the following content to `workpipe/ci.workpipe`:

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

### Step 2: Compile to GitHub Actions YAML

Run the WorkPipe compiler:

```bash
workpipe build workpipe/ci.workpipe
```

This generates `.github/workflows/ci.yml`:

```yaml
name: ci
on: push
jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo Hello, WorkPipe!
```

### Step 3: Commit and Push

Commit both the source `.workpipe` file and the generated `.yml` file:

```bash
git add workpipe/ci.workpipe .github/workflows/ci.yml
git commit -m "Add CI workflow with WorkPipe"
git push
```

## A More Complete Example

Here is a workflow with multiple jobs and dependencies:

```workpipe
workflow build_and_test {
  on: [push, pull_request]

  job lint {
    runs_on: ubuntu-latest
    steps: [
      uses("actions/checkout@v4"),
      uses("actions/setup-node@v4") {
        with: {
          node-version: "20"
        }
      },
      run("npm ci"),
      run("npm run lint")
    ]
  }

  job test {
    runs_on: ubuntu-latest
    needs: [lint]
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

  job build {
    runs_on: ubuntu-latest
    needs: [test]
    steps: [
      uses("actions/checkout@v4"),
      uses("actions/setup-node@v4") {
        with: {
          node-version: "20"
        }
      },
      run("npm ci"),
      run("npm run build")
    ]
  }
}
```

## Setting Up Automated Compilation

WorkPipe can automatically recompile your workflows when you change `.workpipe` files. Generate a bootstrap workflow:

```bash
workpipe init --bootstrap
```

This creates `.github/workflows/workpipe-compile.yml`, which:

1. Triggers when `.workpipe` files change
2. Runs the WorkPipe compiler
3. Commits the updated workflow files

## Validating Without Building

Check your WorkPipe files for errors without generating output:

```bash
workpipe check
```

This is useful for:
- Pre-commit hooks
- CI validation gates
- Quick syntax checking

## Formatting Your Code

Keep your WorkPipe files consistently formatted:

```bash
# Preview formatted output
workpipe fmt workpipe/ci.workpipe

# Format files in place
workpipe fmt --write

# Check if formatting is needed (for CI)
workpipe fmt --check
```

## Project Structure

A typical WorkPipe project looks like this:

```
my-project/
  workpipe/
    ci.workpipe
    deploy.workpipe
  .github/
    workflows/
      ci.yml              # Generated from ci.workpipe
      deploy.yml          # Generated from deploy.workpipe
      workpipe-compile.yml  # Bootstrap workflow (optional)
```

## Next Steps

- [CLI Reference](cli-reference.md) - Complete documentation of all CLI commands
- [Language Reference](language-reference.md) - Full syntax and semantics guide
