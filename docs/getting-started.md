# Getting Started with WorkPipe

WorkPipe is a domain-specific language (DSL) that compiles to GitHub Actions workflow YAML files. It provides a cleaner, type-safe way to define CI/CD pipelines with features like typed parameter passing, agentic task support, and cycle-based iterative workflows.

**Time to complete:** 5-10 minutes

---

## Installation

### Prerequisites

- Node.js 20 or later
- npm, pnpm, or yarn

### Option 1: Install Globally (Recommended)

```bash
npm install -g @workpipe/cli
```

### Option 2: Try Without Installing

Use `npx` to run WorkPipe without global installation:

```bash
npx @workpipe/cli --version
```

### Verify Installation

```bash
workpipe --version
```

**Expected output:**

```
0.0.1
```

If you see a version number, installation succeeded. If you get "command not found", ensure Node.js 20+ is installed and your npm global bin directory is in your PATH.

---

## Your First Workflow

**Time:** 2-3 minutes

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
    steps {
      shell { echo "Hello, WorkPipe!" }
    }
  }
}
```

The `steps { }` block contains your job's actions. The `shell { }` block lets you write shell commands directly without quotes.

### Step 2: Validate Your Syntax (Optional)

Before compiling, you can check for errors:

```bash
workpipe check workpipe/ci.workpipe
```

**Expected output:**

```
All 1 file(s) valid
```

### Step 3: Compile to GitHub Actions YAML

Run the WorkPipe compiler:

```bash
workpipe build workpipe/ci.workpipe
```

**Expected output:**

```
Wrote: .github/workflows/ci.yml
```

The generated `.github/workflows/ci.yml` contains:

```yaml
name: ci
on: push
jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo Hello, WorkPipe!
```

**Success!** You have compiled your first WorkPipe workflow.

### Step 4: Commit and Push

Commit both the source `.workpipe` file and the generated `.yml` file:

```bash
git add workpipe/ci.workpipe .github/workflows/ci.yml
git commit -m "Add CI workflow with WorkPipe"
git push
```

Your workflow is now live on GitHub Actions.

---

## A More Complete Example

Here is a workflow with multiple jobs and dependencies:

```workpipe
workflow build_and_test {
  on: [push, pull_request]

  job lint {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {
        with: { node-version: "20" }
      }
      shell {
        npm ci
        npm run lint
      }
    }
  }

  job test {
    runs_on: ubuntu-latest
    needs: [lint]
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {
        with: { node-version: "20" }
      }
      shell {
        npm ci
        npm test
      }
    }
  }

  job build {
    runs_on: ubuntu-latest
    needs: [test]
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {
        with: { node-version: "20" }
      }
      shell {
        npm ci
        npm run build
      }
    }
  }
}
```

Notice how shell commands inside `shell { }` blocks don't need quotes or commas. Multi-line scripts are natural and readable.

**Note:** In block syntax, `uses()` requires a trailing block. Use `{}` for actions with no configuration, or `{ with: {...} }` to pass inputs.

---

## Setting Up Automated Compilation

WorkPipe can automatically recompile your workflows when you change `.workpipe` files. Generate a bootstrap workflow:

```bash
workpipe init --bootstrap
```

**Expected output:**

```
Created: .github/workflows/workpipe-compile.yml
```

This bootstrap workflow:

1. Triggers when `.workpipe` files change
2. Runs the WorkPipe compiler
3. Commits the updated workflow files

This means your generated YAML stays in sync automatically.

---

## Validating Without Building

Check your WorkPipe files for errors without generating output:

```bash
workpipe check
```

This is useful for:
- Pre-commit hooks
- CI validation gates
- Quick syntax checking during development

---

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

---

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

---

## Editor Setup: VS Code Extension

The WorkPipe VS Code extension provides syntax highlighting and real-time error checking.

### Installation

1. Download the `.vsix` file from the releases or build it locally
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
4. Type "Install from VSIX" and select **Extensions: Install from VSIX...**
5. Select the `workpipe-vscode-x.x.x.vsix` file
6. Reload VS Code when prompted

### What It Provides

| Feature | Description |
|---------|-------------|
| **Syntax Highlighting** | Color-coded keywords, strings, and constructs |
| **Error Squiggles** | Red underlines on syntax and semantic errors |
| **Hover Information** | See error details and hints by hovering |
| **Problems Panel** | All diagnostics listed in one place |

For detailed extension documentation, see [VS Code Extension](vscode-extension.md).

---

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| `command not found: workpipe` | Ensure npm global bin is in PATH. Run `npm bin -g` to find the path. |
| `Error: Cannot find module` | Re-run `npm install -g @workpipe/cli` |
| `No files found` | Ensure your file has a `.workpipe` or `.wp` extension |
| Syntax errors | Run `workpipe check <file>` to see detailed error messages |

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](troubleshooting.md) for common type and syntax errors
2. Review the [Error Reference](errors.md) for specific error codes
3. Open an issue on GitHub with the error message and your WorkPipe source

---

## What's Next?

Now that you have a working workflow, explore these resources:

### Learn the Language

- [Language Reference](language-reference.md) - Complete syntax and semantics guide
- [Quick Reference](quick-reference.md) - One-page cheat sheet

### Explore Examples

- [Examples Directory](../examples/) - Real-world workflow examples
- Start with [minimal](../examples/minimal/) and work through the [learning path](../examples/README.md)

### CLI Mastery

- [CLI Reference](cli-reference.md) - All commands, flags, and options

### Advanced Topics

- [User-Defined Types](language-reference.md#user-defined-types) - Reusable type definitions with compile-time validation
- [Imports](language-reference.md#imports) - Share types across workflow files
- [Agent Tasks](language-reference.md#agent-jobs) - AI-powered workflows with Claude
- [Cycles](language-reference.md#cycles) - Iterative workflows that span multiple runs

---

## Adding Imports to Existing Projects

If you have an existing WorkPipe project with inline type definitions scattered across files, you can consolidate them using imports:

### Step 1: Identify Shared Types

Look for types that are duplicated across workflow files or that represent your domain model:

```bash
# Find all type declarations in your project
grep -r "^type " workpipe/
```

### Step 2: Create a Types File

Create a dedicated file for shared type definitions:

```bash
mkdir -p workpipe/types
```

Move common types to `workpipe/types/common.workpipe`:

```workpipe
// workpipe/types/common.workpipe
type BuildInfo {
  version: string
  commit: string
}

type DeployConfig {
  environment: string
  region: string
}
```

### Step 3: Update Workflow Files

Replace inline type definitions with imports:

**Before:**

```workpipe
type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  job build {
    outputs: { info: BuildInfo }
  }
}
```

**After:**

```workpipe
import { BuildInfo } from "./types/common.workpipe"

workflow ci {
  job build {
    outputs: { info: BuildInfo }
  }
}
```

### Step 4: Verify

Run the compiler to ensure everything still works:

```bash
workpipe check workpipe/**/*.workpipe
workpipe build workpipe/**/*.workpipe
```

### Tips

- Start small: Extract one or two types first
- Types-only files produce no YAML output
- The compiler automatically determines compilation order
- Use aliased imports to avoid name collisions: `import { Config as DeployConfig } from ...`
