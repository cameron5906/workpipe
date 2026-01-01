import * as vscode from "vscode";
import {
  compile,
  compileWithImports,
  createImportContext,
  normalizePath,
  type TypeRegistry,
  type FileResolver,
} from "@workpipe/compiler";

const KEYWORD_DOCS: Record<string, { description: string; example: string }> = {
  workflow: {
    description:
      "A workflow is the top-level container that defines a CI/CD pipeline. It contains jobs, cycles, and triggers.",
    example: `workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("npm install")]
  }
}`,
  },
  job: {
    description:
      "A job is a unit of work that runs on a specified runner. Jobs can have steps, outputs, and dependencies on other jobs.",
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
      "An agent job is a specialized job that runs an AI agent. It requires a runner and can have prompts, tools, and outputs.",
    example: `agent_job review {
  runs_on: ubuntu-latest
  prompt: "Review the code changes"
  tools: ["read_file", "write_file"]
}`,
  },
  cycle: {
    description:
      "A cycle defines a loop that repeats until a condition is met or a maximum number of iterations is reached. Cycles contain a body with jobs.",
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
      "An agent task is a reusable AI agent definition that can be invoked within jobs or cycles.",
    example: `agent_task code_review {
  prompt: "Review code for best practices"
  tools: ["read_file"]
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
      "An array of commands or actions to execute in sequence within a job.",
    example: `steps: [
  run("npm install"),
  run("npm test"),
  run("npm run build")
]`,
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

interface TypeInfo {
  name: string;
  provenance?: string;
  fields: Array<{ name: string; type: string }>;
}

function createMemoryFileResolver(source: string): FileResolver {
  return {
    async resolve(): Promise<string | null> {
      return null;
    },
    async read(): Promise<string> {
      return source;
    },
    async exists(): Promise<boolean> {
      return false;
    },
  };
}

async function getTypeInfoFromSource(
  source: string,
  typeName: string
): Promise<TypeInfo | null> {
  try {
    const result = compile(source);

    const typePattern = new RegExp(
      `type\\s+${typeName}\\s*\\{([^}]*)\\}`,
      "s"
    );
    const match = source.match(typePattern);
    if (match) {
      const fieldsStr = match[1];
      const fields: Array<{ name: string; type: string }> = [];
      const fieldPattern = /(\w+)\s*:\s*(\w+)/g;
      let fieldMatch;
      while ((fieldMatch = fieldPattern.exec(fieldsStr)) !== null) {
        fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
      }
      return { name: typeName, fields };
    }
  } catch {
    return null;
  }
  return null;
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
      return this.createHover(wordLower, doc.description, doc.example);
    }

    if (PROPERTY_DOCS[wordLower]) {
      const doc = PROPERTY_DOCS[wordLower];
      return this.createHover(wordLower, doc.description, doc.example);
    }

    const source = document.getText();
    const typeHover = this.getTypeHover(source, word);
    if (typeHover) {
      return typeHover;
    }

    return null;
  }

  private getTypeHover(source: string, typeName: string): vscode.Hover | null {
    const typePattern = new RegExp(
      `type\\s+${typeName}\\s*\\{([^}]*)\\}`,
      "s"
    );
    const match = source.match(typePattern);

    if (match) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**type ${typeName}**\n\n`);
      markdown.appendMarkdown(`Locally defined type.\n\n`);
      markdown.appendMarkdown(`**Fields:**\n`);

      const fieldsStr = match[1];
      const fieldPattern = /(\w+)\s*:\s*(\w+)/g;
      let fieldMatch;
      while ((fieldMatch = fieldPattern.exec(fieldsStr)) !== null) {
        markdown.appendMarkdown(`- \`${fieldMatch[1]}\`: ${fieldMatch[2]}\n`);
      }

      return new vscode.Hover(markdown);
    }

    const importInfo = findImportForType(source, typeName);
    if (importInfo) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**type ${typeName}**\n\n`);

      if (importInfo.originalName !== typeName) {
        markdown.appendMarkdown(
          `Imported as \`${typeName}\` from \`${importInfo.originalName}\` in ${importInfo.path}\n`
        );
      } else {
        markdown.appendMarkdown(`(from ${importInfo.path})\n`);
      }

      return new vscode.Hover(markdown);
    }

    return null;
  }

  private createHover(
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
