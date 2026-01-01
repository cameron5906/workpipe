import { describe, it, expect } from "vitest";
import * as vscode from "vscode";
import { HoverProvider, getKeywordDocs, getPropertyDocs } from "../hover";

function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split("\n");
  return {
    getText: (range?: vscode.Range) => {
      if (!range) return content;
      const startLine = lines[range.start.line] || "";
      return startLine.substring(range.start.character, range.end.character);
    },
    lineAt: (lineOrPosition: number | vscode.Position) => {
      const lineNum = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return {
        text: lines[lineNum] || "",
        range: new vscode.Range(lineNum, 0, lineNum, (lines[lineNum] || "").length),
      };
    },
    getWordRangeAtPosition: (position: vscode.Position, pattern?: RegExp) => {
      const line = lines[position.line] || "";
      const regex = pattern || /\w+/;
      let match;
      const globalRegex = new RegExp(regex.source, "gi");
      while ((match = globalRegex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new vscode.Range(position.line, start, position.line, end);
        }
      }
      return undefined;
    },
  } as unknown as vscode.TextDocument;
}

function createMockToken(): vscode.CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  } as vscode.CancellationToken;
}

describe("HoverProvider", () => {
  const provider = new HoverProvider();

  describe("keyword hover", () => {
    it("should provide hover for 'workflow' keyword", () => {
      const document = createMockDocument("workflow ci {\n}");
      const position = new vscode.Position(0, 4);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(vscode.Hover);
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**workflow**");
      expect(markdown.value).toContain("top-level container");
    });

    it("should provide hover for 'job' keyword", () => {
      const document = createMockDocument("  job build {\n  }");
      const position = new vscode.Position(0, 3);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**job**");
      expect(markdown.value).toContain("Defines a job that runs on a specified runner");
    });

    it("should provide hover for 'agent_job' keyword", () => {
      const document = createMockDocument("  agent_job review {\n  }");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**agent_job**");
      expect(markdown.value).toContain("AI agent");
    });

    it("should provide hover for 'cycle' keyword", () => {
      const document = createMockDocument("  cycle retry {\n  }");
      const position = new vscode.Position(0, 4);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**cycle**");
      expect(markdown.value).toContain("iterative refinement cycle");
    });

    it("should provide hover for 'agent_task' keyword", () => {
      const document = createMockDocument("  agent_task review {\n  }");
      const position = new vscode.Position(0, 6);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**agent_task**");
      expect(markdown.value).toContain("reusable");
    });

    it("should provide hover for 'shell' keyword", () => {
      const document = createMockDocument("  shell {\n    npm install\n  }");
      const position = new vscode.Position(0, 4);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**shell**");
      expect(markdown.value).toContain("shell commands directly");
    });
  });

  describe("property hover", () => {
    it("should provide hover for 'runs_on' property", () => {
      const document = createMockDocument("    runs_on: ubuntu-latest");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**runs_on**");
      expect(markdown.value).toContain("runner");
    });

    it("should provide hover for 'needs' property", () => {
      const document = createMockDocument("    needs: [build]");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**needs**");
      expect(markdown.value).toContain("dependencies");
    });

    it("should provide hover for 'steps' property", () => {
      const document = createMockDocument("    steps: []");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**steps**");
      expect(markdown.value).toContain("commands");
    });

    it("should provide hover for 'outputs' property", () => {
      const document = createMockDocument("    outputs: {}");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**outputs**");
      expect(markdown.value).toContain("passed to dependent jobs");
    });

    it("should provide hover for 'with' property", () => {
      const document = createMockDocument("    with: { fetch-depth: 0 }");
      const position = new vscode.Position(0, 5);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**with**");
      expect(markdown.value).toContain("input parameters");
    });
  });

  describe("no hover", () => {
    it("should return null for unknown words", () => {
      const document = createMockDocument("  foobar: something");
      const position = new vscode.Position(0, 4);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeNull();
    });

    it("should return null when no word at position", () => {
      const document = createMockDocument("   ");
      const position = new vscode.Position(0, 1);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeNull();
    });
  });

  describe("documentation exports", () => {
    it("should export keyword documentation", () => {
      const keywords = getKeywordDocs();
      expect(keywords).toHaveProperty("workflow");
      expect(keywords).toHaveProperty("job");
      expect(keywords).toHaveProperty("agent_job");
      expect(keywords).toHaveProperty("cycle");
      expect(keywords).toHaveProperty("agent_task");
      expect(keywords).toHaveProperty("shell");
    });

    it("should export property documentation", () => {
      const properties = getPropertyDocs();
      expect(properties).toHaveProperty("runs_on");
      expect(properties).toHaveProperty("needs");
      expect(properties).toHaveProperty("steps");
      expect(properties).toHaveProperty("outputs");
      expect(properties).toHaveProperty("with");
    });
  });

  describe("type hover", () => {
    it("should provide hover for locally defined type", () => {
      const document = createMockDocument(`type BuildInfo {
  version: string
  commit: string
}

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: []
  }
}`);
      const position = new vscode.Position(10, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("Locally defined type");
      expect(markdown.value).toContain("version");
      expect(markdown.value).toContain("commit");
    });

    it("should provide hover for imported type", () => {
      const document = createMockDocument(`import { BuildInfo } from "./types.workpipe"

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: []
  }
}`);
      const position = new vscode.Position(7, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("./types.workpipe");
    });

    it("should provide hover for aliased imported type", () => {
      const document = createMockDocument(`import { BuildInfo as BI } from "./types.workpipe"

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BI
    }
    steps: []
  }
}`);
      const position = new vscode.Position(7, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BI`");
      expect(markdown.value).toContain("originally");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("./types.workpipe");
    });

    it("should return null for unknown type", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: UnknownType
    }
    steps: []
  }
}`);
      const position = new vscode.Position(5, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeNull();
    });
  });

  describe("type keyword hover", () => {
    it("should provide hover for 'type' keyword", () => {
      const document = createMockDocument("type BuildInfo {\n  version: string\n}");
      const position = new vscode.Position(0, 2);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("reusable type definition");
    });
  });

  describe("job name hover", () => {
    it("should provide hover for job definition with details", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    needs: [lint, test]
    outputs: {
      version: string
      artifacts: BuildInfo
    }
    steps: []
  }
}`);
      const position = new vscode.Position(2, 7);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**job**");
      expect(markdown.value).toContain("`build`");
      expect(markdown.value).toContain("**Runs on:**");
      expect(markdown.value).toContain("`ubuntu-latest`");
      expect(markdown.value).toContain("**Needs:**");
      expect(markdown.value).toContain("`lint`");
      expect(markdown.value).toContain("`test`");
      expect(markdown.value).toContain("**Outputs:**");
      expect(markdown.value).toContain("`version`");
      expect(markdown.value).toContain("(string)");
    });

    it("should provide hover for agent_job definition", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  agent_job review {
    runs_on: ubuntu-latest
    steps: []
  }
}`);
      const position = new vscode.Position(2, 13);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**agent_job**");
      expect(markdown.value).toContain("`review`");
    });

    it("should provide hover for job referenced in needs", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job lint {
    runs_on: ubuntu-latest
    steps: []
  }
  job build {
    runs_on: ubuntu-latest
    needs: [lint]
    steps: []
  }
}`);
      const position = new vscode.Position(8, 13);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**job**");
      expect(markdown.value).toContain("`lint`");
    });

    it("should provide hover for job with single needs", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job test {
    runs_on: ubuntu-latest
    needs: build
    steps: []
  }
}`);
      const position = new vscode.Position(2, 7);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**Needs:**");
      expect(markdown.value).toContain("`build`");
    });
  });

  describe("cycle hover", () => {
    it("should provide hover for cycle definition", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  cycle retry_build {
    max_iters = 3
    body {
      job attempt {
        runs_on: ubuntu-latest
        steps: []
      }
    }
  }
}`);
      const position = new vscode.Position(2, 10);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**cycle**");
      expect(markdown.value).toContain("`retry_build`");
      expect(markdown.value).toContain("**Max iterations:**");
      expect(markdown.value).toContain("3");
    });
  });

  describe("output reference hover", () => {
    it("should provide hover for output reference in expression", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
    }
    steps: []
  }
  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    if: jobs.build.outputs.version == "1.0.0"
    steps: []
  }
}`);
      const position = new vscode.Position(12, 30);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**output**");
      expect(markdown.value).toContain("`version`");
      expect(markdown.value).toContain("**Type:**");
      expect(markdown.value).toContain("string");
      expect(markdown.value).toContain("**From job:**");
      expect(markdown.value).toContain("`build`");
    });
  });

  describe("type hover with fields", () => {
    it("should show all fields in type hover", () => {
      const document = createMockDocument(`type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: []
  }
}`);
      const position = new vscode.Position(11, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("Locally defined type");
      expect(markdown.value).toContain("**Fields:**");
      expect(markdown.value).toContain("`version`");
      expect(markdown.value).toContain("`commit`");
      expect(markdown.value).toContain("`timestamp`");
    });
  });

  describe("imported type hover with provenance", () => {
    it("should show import source for imported type", () => {
      const document = createMockDocument(`import { BuildInfo } from "./types.workpipe"

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: []
  }
}`);
      const position = new vscode.Position(7, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("**From:**");
      expect(markdown.value).toContain("`./types.workpipe`");
    });

    it("should show original name for aliased imported type", () => {
      const document = createMockDocument(`import { BuildInfo as BI } from "./types.workpipe"

workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BI
    }
    steps: []
  }
}`);
      const position = new vscode.Position(7, 12);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**type**");
      expect(markdown.value).toContain("`BI`");
      expect(markdown.value).toContain("originally");
      expect(markdown.value).toContain("`BuildInfo`");
      expect(markdown.value).toContain("**From:**");
      expect(markdown.value).toContain("`./types.workpipe`");
    });
  });

  describe("job hover edge cases", () => {
    it("should not show hover for job name in unrelated context", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo build")]
  }
}`);
      const position = new vscode.Position(4, 20);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeNull();
    });

    it("should handle job without outputs", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: []
  }
}`);
      const position = new vscode.Position(2, 7);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).toContain("**job**");
      expect(markdown.value).toContain("`test`");
      expect(markdown.value).not.toContain("**Outputs:**");
    });

    it("should handle job without needs", () => {
      const document = createMockDocument(`workflow ci {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: []
  }
}`);
      const position = new vscode.Position(2, 7);
      const result = provider.provideHover(document, position, createMockToken());

      expect(result).toBeDefined();
      const hover = result as vscode.Hover;
      const markdown = hover.contents as vscode.MarkdownString;
      expect(markdown.value).not.toContain("**Needs:**");
    });
  });
});
