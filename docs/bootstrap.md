# Bootstrapping WorkPipe

WorkPipe supports a "bootstrap" workflow pattern that enables self-hosting: using WorkPipe to compile its own CI workflows. This creates an automated feedback loop where changes to your `.workpipe` source files automatically regenerate the corresponding GitHub Actions YAML files.

## What is Bootstrapping?

Bootstrapping in the WorkPipe context means setting up a CI workflow that:

1. Watches for changes to `.workpipe` and `.wp` source files
2. Automatically runs the WorkPipe compiler when those files change
3. Commits the regenerated workflow YAML files back to the repository

This pattern eliminates the manual step of running `workpipe build` locally and committing the output. Instead, you commit only your WorkPipe source files, and CI handles the compilation.

## Why Use Bootstrap?

- **Single source of truth**: Your `.workpipe` files become the authoritative definition of your workflows
- **Reduced human error**: No risk of forgetting to recompile after changes
- **Cleaner commits**: Developers commit only source changes, not generated output
- **Enforced consistency**: The compiled output always matches the source

## Setting Up Bootstrap

### Quick Start

Generate the bootstrap workflow with a single command:

```bash
workpipe init --bootstrap
```

This creates `.github/workflows/workpipe-compile.yml` in your project.

### What Gets Generated

The `--bootstrap` flag generates a workflow file with the following structure:

```yaml
name: WorkPipe Compile

on:
  push:
    paths:
      - 'workpipe/**/*.workpipe'
      - 'workpipe/**/*.wp'
  pull_request:
    paths:
      - 'workpipe/**/*.workpipe'
      - 'workpipe/**/*.wp'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install WorkPipe
        run: npm install -g @workpipe/cli

      - name: Compile WorkPipe specs
        run: |
          shopt -s globstar nullglob
          for file in workpipe/**/*.workpipe workpipe/**/*.wp; do
            [ -f "$file" ] && workpipe build "$file" --output .github/workflows/
          done

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet .github/workflows/ || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit generated workflows
        if: steps.changes.outputs.changed == 'true' && github.event_name == 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .github/workflows/
          git commit -m "chore: regenerate workflows from WorkPipe specs"
          git push
```

## How the Compile-on-Push Pattern Works

### Trigger Conditions

The workflow triggers on:

| Event | Behavior |
|-------|----------|
| `push` | Compiles and commits changes to the same branch |
| `pull_request` | Compiles and validates (no commit) |
| `workflow_dispatch` | Manual trigger for on-demand compilation |

The path filter ensures the workflow only runs when WorkPipe source files actually change, not on every push.

### Compilation Process

1. **Checkout**: The workflow checks out the repository with write permissions
2. **Setup**: Installs Node.js and the WorkPipe CLI
3. **Compile**: Iterates through all `.workpipe` and `.wp` files in the `workpipe/` directory and compiles each to `.github/workflows/`
4. **Detect changes**: Checks if the compiled output differs from the current workflows
5. **Commit**: If changes exist and this is a push event, commits the updated workflows

### Commit Behavior

The workflow only commits on `push` events, not on pull requests. This means:

- **On push to a branch**: Changes are compiled and committed automatically
- **On pull request**: Changes are compiled and validated, but not committed (the PR diff shows what would change)

This design lets you review workflow changes in PRs before they are applied.

## Project Structure with Bootstrap

A bootstrapped WorkPipe project typically looks like:

```
my-project/
  workpipe/
    ci.workpipe           # Source: your CI definition
    deploy.workpipe       # Source: your deploy definition
  .github/
    workflows/
      ci.yml              # Generated: compiled from ci.workpipe
      deploy.yml          # Generated: compiled from deploy.workpipe
      workpipe-compile.yml  # Bootstrap workflow itself
```

The `workpipe/` directory contains your source files. The `.github/workflows/` directory contains both the compiled output and the bootstrap workflow.

## Best Practices

### Commit the Bootstrap Workflow

After running `workpipe init --bootstrap`, commit the generated workflow:

```bash
git add .github/workflows/workpipe-compile.yml
git commit -m "Add WorkPipe bootstrap workflow"
git push
```

### Consider .gitignore for Generated Files

Some teams prefer to gitignore the generated workflow files and rely entirely on CI to generate them. This is a valid approach but has tradeoffs:

**Pros:**
- Cleaner diffs (only source changes visible)
- Impossible for generated files to drift from source

**Cons:**
- Workflows not visible until CI runs
- Requires CI to run before workflows are active on new branches

If you choose this approach, add to `.gitignore`:

```gitignore
# Generated workflows (managed by WorkPipe bootstrap)
.github/workflows/*.yml
!.github/workflows/workpipe-compile.yml
```

### Initial Setup for Existing Projects

If you have existing workflows you want to convert to WorkPipe:

1. Create `.workpipe` source files that generate equivalent output
2. Run `workpipe init --bootstrap`
3. Verify the compiled output matches your existing workflows
4. Commit both the source files and the bootstrap workflow

## Troubleshooting

### Workflow Not Triggering

Ensure your WorkPipe source files are in the `workpipe/` directory with `.workpipe` or `.wp` extensions. The path filter watches:

- `workpipe/**/*.workpipe`
- `workpipe/**/*.wp`

### Permission Denied on Push

The workflow requires `contents: write` permission. This is included in the generated workflow. If you see permission errors, verify:

1. The `permissions` block is present in the workflow
2. Your repository settings allow GitHub Actions to create commits

### Infinite Loop Concerns

The workflow is designed to avoid infinite loops. It only triggers on changes to `workpipe/**/*.workpipe` and `workpipe/**/*.wp` paths, not on changes to `.github/workflows/`. Since the compile step only modifies files in `.github/workflows/`, the commit it creates will not re-trigger the workflow.

## Next Steps

- [Getting Started](getting-started.md) - Learn WorkPipe basics
- [CLI Reference](cli-reference.md) - Complete command documentation
- [Language Reference](language-reference.md) - Full syntax guide
