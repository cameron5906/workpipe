import * as vscode from "vscode";

const KEYWORD_DOCS: Record<string, { description: string; example: string }> = {
  workflow: {
    description:
      "Defines a GitHub Actions workflow. A workflow is the top-level container that defines a CI/CD pipeline with jobs, cycles, and triggers.",
    example: `workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("npm install")]
  }
}`,
  },
  shell: {
    description:
      "Execute shell commands directly without string quoting. The shell block allows multi-line shell scripts with proper syntax highlighting.",
    example: `steps {
  shell {
    npm install
    npm run build
    npm test
  }
}`,
  },
  job: {
    description:
      "Defines a job that runs on a specified runner. Jobs can have steps, outputs, and dependencies on other jobs.",
    example: `job build {
  runs_on: ubuntu-latest
  steps: [
    run("npm install"),
    run("npm test")
  ]
}`,
  },
  agent_job: {
    description:
      "Defines an AI agent job for automated tasks. Agent jobs run AI agents with prompts, tools, and outputs.",
    example: `agent_job review {
  runs_on: ubuntu-latest
  prompt: "Review the code changes"
  tools: ["read_file", "write_file"]
}`,
  },
  cycle: {
    description:
      "Defines an iterative refinement cycle. A cycle repeats until a condition is met or a maximum number of iterations is reached.",
    example: `cycle retry_build {
  max_iters = 3
  body {
    job attempt {
      runs_on: ubuntu-latest
      steps: [run("npm run build")]
    }
  }
}`,
  },
  agent_task: {
    description:
      "Defines a task within an agent job. Agent tasks are reusable AI agent definitions that can be invoked within jobs or cycles.",
    example: `agent_task code_review {
  prompt: "Review code for best practices"
  tools: ["read_file"]
}`,
  },
  type: {
    description:
      "Declares a reusable type definition. Types define structured data schemas that can be used for job outputs and agent task schemas.",
    example: `type BuildInfo {
  version: string
  commit: string
  artifacts: [string]
}`,
  },
};

const PROPERTY_DOCS: Record<string, { description: string; example: string }> = {
  runs_on: {
    description:
      "Specifies the runner environment where the job executes. Common values include 'ubuntu-latest', 'windows-latest', and 'macos-latest'.",
    example: `runs_on: ubuntu-latest`,
  },
  needs: {
    description:
      "Defines job dependencies. The job will wait for all specified jobs to complete before starting.",
    example: `needs: [build, test]`,
  },
  steps: {
    description:
      "A block or array of commands or actions to execute in sequence within a job. Can use array syntax or block syntax with shell and uses blocks.",
    example: `steps {
  shell {
    npm install
    npm test
  }
  uses("actions/checkout@v4") {
    with: { fetch-depth: 0 }
  }
}`,
  },
  with: {
    description:
      "Provides input parameters to a uses action. Used inside uses() blocks to pass configuration to GitHub Actions.",
    example: `uses("actions/checkout@v4") {
  with: {
    fetch-depth: 0
    ref: "main"
  }
}`,
  },
  outputs: {
    description:
      "Defines values that can be passed to dependent jobs. Outputs are key-value pairs accessible via job references.",
    example: `outputs: {
  version: "1.0.0",
  artifact_path: "./dist"
}`,
  },
  max_iters: {
    description:
      "The maximum number of iterations a cycle will execute before stopping, even if the until condition is not met.",
    example: `max_iters = 5`,
  },
  until: {
    description:
      "A guard condition that, when true, stops the cycle from continuing. Used with guard_js for JavaScript expressions.",
    example: `until guard_js """return outputs.success === true"""`,
  },
  on: {
    description:
      "Defines the trigger events that start the workflow. Common triggers include 'push', 'pull_request', and 'schedule'.",
    example: `on: push`,
  },
  body: {
    description:
      "The body of a cycle containing the jobs that execute on each iteration.",
    example: `body {
  job inner {
    runs_on: ubuntu-latest
    steps: []
  }
}`,
  },
};

interface JobInfo {
  name: string;
  kind: "job" | "agent_job" | "matrix_job";
  runsOn: string | null;
  needs: string[];
  outputs: Array<{ name: string; type: string }>;
}

interface TypeInfo {
  name: string;
  provenance?: string;
  fields: Array<{ name: string; type: string }>;
}

function parseTypeExpression(typeStr: string): string {
  return typeStr.trim();
}

function extractTypeFields(fieldsBlock: string): Array<{ name: string; type: string }> {
  const fields: Array<{ name: string; type: string }> = [];
  const lines = fieldsBlock.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const name = trimmed.substring(0, colonIndex).trim();
    let type = trimmed.substring(colonIndex + 1).trim();

    if (!name || !type) continue;

    type = parseTypeExpression(type);
    fields.push({ name, type });
  }

  return fields;
}

function findJobDefinitions(source: string): JobInfo[] {
  const jobs: JobInfo[] = [];

  const jobPattern = /\b(job|agent_job|matrix\s+job)\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
  let match;

  while ((match = jobPattern.exec(source)) !== null) {
    const kindStr = match[1].replace(/\s+/g, '_');
    const kind = kindStr === 'matrix_job' ? 'matrix_job' : kindStr as "job" | "agent_job" | "matrix_job";
    const name = match[2];
    const body = match[3];

    let runsOn: string | null = null;
    const needs: string[] = [];
    const outputs: Array<{ name: string; type: string }> = [];

    const runsOnMatch = body.match(/runs_on\s*:\s*(\S+)/);
    if (runsOnMatch) {
      runsOn = runsOnMatch[1];
    }

    const needsMatch = body.match(/needs\s*:\s*\[([^\]]*)\]/);
    if (needsMatch) {
      const needsList = needsMatch[1].split(',').map(n => n.trim()).filter(n => n);
      needs.push(...needsList);
    } else {
      const singleNeedsMatch = body.match(/needs\s*:\s*(\w+)/);
      if (singleNeedsMatch) {
        needs.push(singleNeedsMatch[1]);
      }
    }

    const outputsMatch = body.match(/outputs\s*:\s*\{([^}]*)\}/s);
    if (outputsMatch) {
      const outputsBlock = outputsMatch[1];
      const outputPattern = /(\w+)\s*:\s*(\w+)/g;
      let outputMatch;
      while ((outputMatch = outputPattern.exec(outputsBlock)) !== null) {
        outputs.push({ name: outputMatch[1], type: outputMatch[2] });
      }
    }

    jobs.push({ name, kind, runsOn, needs, outputs });
  }

  return jobs;
}

function findCycleDefinitions(source: string): Array<{ name: string; maxIters: number | null }> {
  const cycles: Array<{ name: string; maxIters: number | null }> = [];

  const cyclePattern = /\bcycle\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/gs;
  let match;

  while ((match = cyclePattern.exec(source)) !== null) {
    const name = match[1];
    const body = match[2];

    let maxIters: number | null = null;
    const maxItersMatch = body.match(/max_iters\s*=\s*(\d+)/);
    if (maxItersMatch) {
      maxIters = parseInt(maxItersMatch[1], 10);
    }

    cycles.push({ name, maxIters });
  }

  return cycles;
}

function findImportForType(
  source: string,
  typeName: string
): { path: string; originalName: string } | null {
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let match;

  while ((match = importPattern.exec(source)) !== null) {
    const imports = match[1];
    const path = match[2];

    const aliasPattern = new RegExp(`(\\w+)\\s+as\\s+${typeName}\\b`);
    const aliasMatch = imports.match(aliasPattern);
    if (aliasMatch) {
      return { path, originalName: aliasMatch[1] };
    }

    const directPattern = new RegExp(`\\b${typeName}\\b`);
    if (directPattern.test(imports)) {
      return { path, originalName: typeName };
    }
  }

  return null;
}

export class HoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position, /[a-z_]+/i);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const wordLower = word.toLowerCase();

    if (KEYWORD_DOCS[wordLower]) {
      const doc = KEYWORD_DOCS[wordLower];
      return this.createKeywordHover(wordLower, doc.description, doc.example);
    }

    if (PROPERTY_DOCS[wordLower]) {
      const doc = PROPERTY_DOCS[wordLower];
      return this.createKeywordHover(wordLower, doc.description, doc.example);
    }

    const source = document.getText();
    const line = document.lineAt(position.line).text;

    const jobHover = this.getJobHover(source, word, line, position);
    if (jobHover) {
      return jobHover;
    }

    const cycleHover = this.getCycleHover(source, word, line);
    if (cycleHover) {
      return cycleHover;
    }

    const typeHover = this.getTypeHover(source, word);
    if (typeHover) {
      return typeHover;
    }

    const outputRefHover = this.getOutputReferenceHover(source, word, line);
    if (outputRefHover) {
      return outputRefHover;
    }

    return null;
  }

  private getJobHover(
    source: string,
    word: string,
    line: string,
    position: vscode.Position
  ): vscode.Hover | null {
    const jobs = findJobDefinitions(source);
    const job = jobs.find((j) => j.name === word);

    if (!job) {
      return null;
    }

    const isJobDefinition = new RegExp(
      `\\b(job|agent_job|matrix\\s+job)\\s+${word}\\b`
    ).test(line);
    const isNeedsReference = /\bneeds\s*:\s*/.test(line);
    const isJobsPrefix = new RegExp(`\\bjobs\\.${word}\\b`).test(line);

    if (!isJobDefinition && !isNeedsReference && !isJobsPrefix) {
      return null;
    }

    return this.createJobHover(job);
  }

  private createJobHover(job: JobInfo): vscode.Hover {
    const markdown = new vscode.MarkdownString();

    const kindLabel =
      job.kind === "agent_job"
        ? "agent_job"
        : job.kind === "matrix_job"
          ? "matrix job"
          : "job";

    markdown.appendMarkdown(`**${kindLabel}** \`${job.name}\`\n\n`);

    if (job.runsOn) {
      markdown.appendMarkdown(`**Runs on:** \`${job.runsOn}\`\n\n`);
    }

    if (job.needs.length > 0) {
      const needsList = job.needs.map((n) => `\`${n}\``).join(", ");
      markdown.appendMarkdown(`**Needs:** ${needsList}\n\n`);
    }

    if (job.outputs.length > 0) {
      markdown.appendMarkdown(`**Outputs:**\n`);
      for (const output of job.outputs) {
        markdown.appendMarkdown(`- \`${output.name}\` (${output.type})\n`);
      }
    }

    return new vscode.Hover(markdown);
  }

  private getCycleHover(
    source: string,
    word: string,
    line: string
  ): vscode.Hover | null {
    const cycles = findCycleDefinitions(source);
    const cycle = cycles.find((c) => c.name === word);

    if (!cycle) {
      return null;
    }

    const isCycleDefinition = new RegExp(`\\bcycle\\s+${word}\\b`).test(line);
    if (!isCycleDefinition) {
      return null;
    }

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**cycle** \`${cycle.name}\`\n\n`);

    if (cycle.maxIters !== null) {
      markdown.appendMarkdown(`**Max iterations:** ${cycle.maxIters}\n`);
    }

    return new vscode.Hover(markdown);
  }

  private getTypeHover(source: string, typeName: string): vscode.Hover | null {
    const typePattern = new RegExp(
      `type\\s+${typeName}\\s*\\{([^}]*)\\}`,
      "s"
    );
    const match = source.match(typePattern);

    if (match) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**type** \`${typeName}\`\n\n`);
      markdown.appendMarkdown(`Locally defined type.\n\n`);

      const fieldsStr = match[1];
      const fields = extractTypeFields(fieldsStr);

      if (fields.length > 0) {
        markdown.appendMarkdown(`**Fields:**\n`);
        for (const field of fields) {
          markdown.appendMarkdown(`- \`${field.name}\`: ${field.type}\n`);
        }
      }

      return new vscode.Hover(markdown);
    }

    const importInfo = findImportForType(source, typeName);
    if (importInfo) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**type** \`${typeName}\`\n\n`);

      if (importInfo.originalName !== typeName) {
        markdown.appendMarkdown(
          `Imported as \`${typeName}\` (originally \`${importInfo.originalName}\`)\n\n`
        );
      }

      markdown.appendMarkdown(`**From:** \`${importInfo.path}\`\n`);

      return new vscode.Hover(markdown);
    }

    return null;
  }

  private getOutputReferenceHover(
    source: string,
    word: string,
    line: string
  ): vscode.Hover | null {
    const outputRefPattern = new RegExp(`jobs\\.(\\w+)\\.outputs\\.${word}\\b`);
    const match = line.match(outputRefPattern);

    if (!match) {
      return null;
    }

    const jobName = match[1];
    const jobs = findJobDefinitions(source);
    const job = jobs.find((j) => j.name === jobName);

    if (!job) {
      return null;
    }

    const output = job.outputs.find((o) => o.name === word);
    if (!output) {
      return null;
    }

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**output** \`${word}\`\n\n`);
    markdown.appendMarkdown(`**Type:** ${output.type}\n\n`);
    markdown.appendMarkdown(`**From job:** \`${jobName}\`\n`);

    return new vscode.Hover(markdown);
  }

  private createKeywordHover(
    keyword: string,
    description: string,
    example: string
  ): vscode.Hover {
    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${keyword}**\n\n`);
    markdown.appendMarkdown(`${description}\n\n`);
    markdown.appendMarkdown(`**Example:**\n`);
    markdown.appendCodeblock(example, "workpipe");
    return new vscode.Hover(markdown);
  }
}

export function getKeywordDocs(): typeof KEYWORD_DOCS {
  return KEYWORD_DOCS;
}

export function getPropertyDocs(): typeof PROPERTY_DOCS {
  return PROPERTY_DOCS;
}
