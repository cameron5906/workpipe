import { Command } from "commander";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { EXIT_SUCCESS, EXIT_ERROR } from "../utils/exit-codes.js";

const BOOTSTRAP_TEMPLATE = `name: WorkPipe Compile

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
          token: \${{ secrets.GITHUB_TOKEN }}

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
`;

export interface InitOptions {
  bootstrap: boolean;
}

export async function generateBootstrapWorkflow(
  cwd: string = process.cwd()
): Promise<string> {
  const workflowPath = join(cwd, ".github", "workflows", "workpipe-compile.yml");
  await mkdir(dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, BOOTSTRAP_TEMPLATE, "utf-8");
  return workflowPath;
}

export async function initAction(options: InitOptions): Promise<number> {
  if (options.bootstrap) {
    try {
      const workflowPath = await generateBootstrapWorkflow();
      console.log(`Created: ${workflowPath}`);
      return EXIT_SUCCESS;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create bootstrap workflow: ${message}`);
      return EXIT_ERROR;
    }
  }

  console.log("WorkPipe init: use --bootstrap to generate the CI workflow");
  return EXIT_SUCCESS;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize WorkPipe in a project")
    .option("--bootstrap", "Generate bootstrap workflow for CI compilation", false)
    .action(async (options: InitOptions) => {
      const exitCode = await initAction(options);
      process.exit(exitCode);
    });
}
