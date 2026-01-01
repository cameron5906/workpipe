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
    lineAt: (line: number) => ({
      text: lines[line] || "",
      range: new vscode.Range(line, 0, line, (lines[line] || "").length),
    }),
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
      expect(markdown.value).toContain("unit of work");
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
      expect(markdown.value).toContain("loop");
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
    });

    it("should export property documentation", () => {
      const properties = getPropertyDocs();
      expect(properties).toHaveProperty("runs_on");
      expect(properties).toHaveProperty("needs");
      expect(properties).toHaveProperty("steps");
      expect(properties).toHaveProperty("outputs");
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
      expect(markdown.value).toContain("**type BuildInfo**");
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
      expect(markdown.value).toContain("**type BuildInfo**");
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
      expect(markdown.value).toContain("**type BI**");
      expect(markdown.value).toContain("Imported as");
      expect(markdown.value).toContain("BuildInfo");
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
});
