import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LRParser } from "@lezer/lr";
import type { Tree, TreeCursor } from "@lezer/common";
import { parser as generatedParser } from "../grammar.js";
import * as terms from "../grammar.terms.js";

const parser: LRParser = generatedParser;

function parse(source: string): Tree {
  return parser.parse(source);
}

function printTree(source: string): string {
  const tree = parser.parse(source);
  const lines: string[] = [];

  function visit(cursor: TreeCursor, depth: number) {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${cursor.name} [${cursor.from}-${cursor.to}]`);

    if (cursor.firstChild()) {
      do {
        visit(cursor, depth + 1);
      } while (cursor.nextSibling());
      cursor.parent();
    }
  }

  const cursor = tree.cursor();
  visit(cursor, 0);

  return lines.join("\n");
}

function hasErrors(tree: Tree): boolean {
  let foundError = false;
  tree.cursor().iterate((node) => {
    if (node.type.isError) {
      foundError = true;
      return false;
    }
  });
  return foundError;
}

function getErrors(source: string): Array<{ from: number; to: number; message: string }> {
  const tree = parser.parse(source);
  const errors: Array<{ from: number; to: number; message: string }> = [];

  tree.cursor().iterate((node) => {
    if (node.type.isError) {
      errors.push({
        from: node.from,
        to: node.to,
        message: `Syntax error at position ${node.from}`,
      });
    }
  });

  return errors;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../../../examples");

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("WorkPipe Parser", () => {
  describe("minimal.workpipe fixture", () => {
    const source = loadFixture("minimal/minimal.workpipe");

    it("parses without errors", () => {
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);
    });

    it("has correct top-level structure", () => {
      const tree = parse(source);
      const cursor = tree.cursor();

      expect(cursor.name).toBe("Workflow");
      expect(cursor.firstChild()).toBe(true);
      expect(cursor.name).toBe("WorkflowDecl");
    });

    it("parses workflow identifier", () => {
      const tree = parse(source);
      const cursor = tree.cursor();

      cursor.firstChild();
      cursor.firstChild();
      expect(cursor.name).toBe("workflow");

      cursor.nextSibling();
      expect(cursor.name).toBe("Identifier");
      expect(source.slice(cursor.from, cursor.to)).toBe("minimal");
    });

    it("parses on clause with single event", () => {
      const tree = parse(source);
      const cursor = tree.cursor();

      cursor.firstChild();
      cursor.firstChild();

      while (cursor.nextSibling()) {
        if (cursor.name === "WorkflowBody") break;
      }

      cursor.firstChild();
      expect(cursor.name).toBe("OnClause");

      cursor.firstChild();
      expect(cursor.name).toBe("on");

      cursor.nextSibling();
      cursor.nextSibling();
      expect(cursor.name).toBe("TriggerSpec");

      cursor.firstChild();
      expect(cursor.name).toBe("EventName");
      expect(source.slice(cursor.from, cursor.to)).toBe("push");
    });

    it("parses job with steps", () => {
      const tree = parse(source);
      const cursor = tree.cursor();

      cursor.firstChild();
      cursor.firstChild();

      while (cursor.nextSibling()) {
        if (cursor.name === "WorkflowBody") break;
      }

      cursor.firstChild();
      while (cursor.nextSibling()) {
        if (cursor.name === "JobDecl") break;
      }

      expect(cursor.name).toBe("JobDecl");

      cursor.firstChild();
      expect(cursor.name).toBe("job");

      cursor.nextSibling();
      expect(cursor.name).toBe("Identifier");
      expect(source.slice(cursor.from, cursor.to)).toBe("hello");
    });

    it("parses run step with string argument", () => {
      const tree = parse(source);
      let foundRunStep = false;
      let runStepText = "";

      tree.cursor().iterate((node) => {
        if (node.name === "RunStep") {
          foundRunStep = true;
        }
        if (node.name === "String" && foundRunStep && !runStepText) {
          runStepText = source.slice(node.from, node.to);
        }
      });

      expect(foundRunStep).toBe(true);
      expect(runStepText).toBe('"echo Hello, WorkPipe!"');
    });
  });

  describe("simple-job.workpipe fixture", () => {
    const source = loadFixture("simple-job/simple-job.workpipe");

    it("parses without errors", () => {
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);
    });

    it("parses workflow identifier", () => {
      const tree = parse(source);
      const cursor = tree.cursor();

      cursor.firstChild();
      cursor.firstChild();
      cursor.nextSibling();
      expect(cursor.name).toBe("Identifier");
      expect(source.slice(cursor.from, cursor.to)).toBe("simple_job");
    });

    it("parses on clause with event list", () => {
      const tree = parse(source);
      let foundEventList = false;
      const events: string[] = [];

      tree.cursor().iterate((node) => {
        if (node.name === "EventList") {
          foundEventList = true;
        }
        if (node.name === "EventName") {
          events.push(source.slice(node.from, node.to));
        }
      });

      expect(foundEventList).toBe(true);
      expect(events).toContain("push");
      expect(events).toContain("pull_request");
    });

    it("parses multiple jobs", () => {
      const tree = parse(source);
      let jobCount = 0;
      let foundBuild = false;
      let foundDeploy = false;
      let inJobDecl = false;
      let lookingForJobName = false;

      tree.cursor().iterate((node) => {
        if (node.name === "JobDecl") {
          jobCount++;
          inJobDecl = true;
        }
        if (node.name === "job") {
          lookingForJobName = true;
        }
        if (lookingForJobName && node.name === "Identifier") {
          const name = source.slice(node.from, node.to);
          if (name === "build") foundBuild = true;
          if (name === "deploy") foundDeploy = true;
          lookingForJobName = false;
        }
      });

      expect(jobCount).toBe(2);
      expect(foundBuild).toBe(true);
      expect(foundDeploy).toBe(true);
    });

    it("parses needs property", () => {
      const tree = parse(source);
      let foundNeeds = false;
      let needsValue = "";

      tree.cursor().iterate((node) => {
        if (node.name === "NeedsProperty") {
          foundNeeds = true;
        }
        if (foundNeeds && node.name === "Identifier" && !needsValue) {
          const text = source.slice(node.from, node.to);
          if (text === "build") {
            needsValue = text;
          }
        }
      });

      expect(foundNeeds).toBe(true);
      expect(needsValue).toBe("build");
    });

    it("parses if property with comparison expression", () => {
      const tree = parse(source);
      let foundIf = false;
      let foundComparison = false;
      let foundPropertyAccess = false;
      let foundString = false;

      tree.cursor().iterate((node) => {
        if (node.name === "IfProperty") foundIf = true;
        if (node.name === "ComparisonExpr") foundComparison = true;
        if (node.name === "PropertyAccess") {
          const text = source.slice(node.from, node.to);
          if (text === "github.ref") foundPropertyAccess = true;
        }
        if (node.name === "String") {
          const text = source.slice(node.from, node.to);
          if (text === '"refs/heads/main"') foundString = true;
        }
      });

      expect(foundIf).toBe(true);
      expect(foundComparison).toBe(true);
      expect(foundPropertyAccess).toBe(true);
      expect(foundString).toBe(true);
    });

    it("parses uses step with action reference", () => {
      const tree = parse(source);
      let foundUsesStep = false;
      let usesStepText = "";

      tree.cursor().iterate((node) => {
        if (node.name === "UsesStep") {
          foundUsesStep = true;
        }
        if (node.name === "String" && foundUsesStep && !usesStepText) {
          usesStepText = source.slice(node.from, node.to);
        }
      });

      expect(foundUsesStep).toBe(true);
      expect(usesStepText).toBe('"actions/checkout@v4"');
    });
  });

  describe("error recovery", () => {
    it("handles incomplete workflow block", () => {
      const source = `workflow incomplete {
  on: push
  job test {
`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(true);

      const errors = getErrors(source);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("handles missing closing bracket in steps", () => {
      const source = `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(true);
    });

    it("handles missing colon after keyword", () => {
      const source = `workflow test {
  on push
  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(true);
    });

    it("recovers and still parses valid parts", () => {
      const source = `workflow partial {
  on: push

  job valid {
    runs_on: ubuntu-latest
    steps: [
      run("echo works")
    ]
  }

  job broken {
    runs_on: invalid syntax here!!!
  }
}`;
      const tree = parse(source);

      let foundValidJob = false;
      tree.cursor().iterate((node) => {
        if (node.name === "JobDecl") {
          foundValidJob = true;
        }
      });

      expect(foundValidJob).toBe(true);
    });
  });

  describe("printTree utility", () => {
    it("produces readable output", () => {
      const source = `workflow test { on: push }`;
      const output = printTree(source);

      expect(output).toContain("Workflow");
      expect(output).toContain("WorkflowDecl");
      expect(output).toContain("OnClause");
    });
  });

  describe("node term constants", () => {
    it("exports term constants", () => {
      expect(terms.Workflow).toBeDefined();
      expect(terms.WorkflowDecl).toBeDefined();
      expect(terms.JobDecl).toBeDefined();
      expect(terms.OnClause).toBeDefined();
      expect(terms.StepsProperty).toBeDefined();
      expect(terms.RunStep).toBeDefined();
      expect(terms.UsesStep).toBeDefined();
    });

    it("exports agent task term constants", () => {
      expect(terms.AgentJobDecl).toBeDefined();
      expect(terms.AgentTaskStep).toBeDefined();
      expect(terms.AgentTaskBody).toBeDefined();
      expect(terms.ModelProperty).toBeDefined();
      expect(terms.MaxTurnsProperty).toBeDefined();
      expect(terms.ToolsProperty).toBeDefined();
      expect(terms.McpProperty).toBeDefined();
      expect(terms.PromptProperty).toBeDefined();
      expect(terms.SystemPromptProperty).toBeDefined();
      expect(terms.OutputSchemaProperty).toBeDefined();
      expect(terms.OutputArtifactProperty).toBeDefined();
      expect(terms.ConsumesProperty).toBeDefined();
    });

    it("exports inline schema term constants", () => {
      expect(terms.InlineSchema).toBeDefined();
      expect(terms.SchemaField).toBeDefined();
      expect(terms.SchemaType).toBeDefined();
      expect(terms.NonUnionSchemaType).toBeDefined();
      expect(terms.SchemaPrimitiveType).toBeDefined();
      expect(terms.ArrayType).toBeDefined();
      expect(terms.ObjectType).toBeDefined();
      expect(terms.UnionType).toBeDefined();
      expect(terms.NullType).toBeDefined();
      expect(terms.StringLiteralType).toBeDefined();
    });
  });

  describe("agent job syntax", () => {
    it("parses basic agent_job declaration", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundAgentJob = false;
      let jobName = "";

      tree.cursor().iterate((node) => {
        if (node.name === "AgentJobDecl") {
          foundAgentJob = true;
        }
        if (foundAgentJob && node.name === "Identifier" && !jobName) {
          jobName = source.slice(node.from, node.to);
        }
      });

      expect(foundAgentJob).toBe(true);
      expect(jobName).toBe("analyze");
    });

    it("parses agent_job with after clause", () => {
      const source = `workflow test {
  on: push
  job build {
    steps: []
  }
  agent_job analyze after build {
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundAfterClause = false;
      let afterValue = "";
      let inAfterClause = false;

      tree.cursor().iterate((node) => {
        if (node.name === "AfterClause") {
          foundAfterClause = true;
          inAfterClause = true;
        }
        if (inAfterClause && node.name === "Identifier") {
          afterValue = source.slice(node.from, node.to);
          inAfterClause = false;
        }
      });

      expect(foundAfterClause).toBe(true);
      expect(afterValue).toBe("build");
    });
  });

  describe("agent task step syntax", () => {
    it("parses basic agent_task step", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Analyze the code") {
        model: "claude-sonnet-4-20250514"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundAgentTask = false;
      let taskDescription = "";

      tree.cursor().iterate((node) => {
        if (node.name === "AgentTaskStep") {
          foundAgentTask = true;
        }
        if (foundAgentTask && node.name === "String" && !taskDescription) {
          taskDescription = source.slice(node.from, node.to);
        }
      });

      expect(foundAgentTask).toBe(true);
      expect(taskDescription).toBe('"Analyze the code"');
    });

    it("parses agent_task with model property", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundModelProperty = false;
      let modelValue = "";
      let inModelProperty = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ModelProperty") {
          foundModelProperty = true;
          inModelProperty = true;
        }
        if (inModelProperty && node.name === "String") {
          modelValue = source.slice(node.from, node.to);
          inModelProperty = false;
        }
      });

      expect(foundModelProperty).toBe(true);
      expect(modelValue).toBe('"claude-sonnet-4-20250514"');
    });

    it("parses agent_task with max_turns property", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        max_turns: 10
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundMaxTurns = false;
      let maxTurnsValue = "";
      let inMaxTurns = false;

      tree.cursor().iterate((node) => {
        if (node.name === "MaxTurnsProperty") {
          foundMaxTurns = true;
          inMaxTurns = true;
        }
        if (inMaxTurns && node.name === "Number") {
          maxTurnsValue = source.slice(node.from, node.to);
          inMaxTurns = false;
        }
      });

      expect(foundMaxTurns).toBe(true);
      expect(maxTurnsValue).toBe("10");
    });

    it("parses agent_task with tools block - wildcard allowed", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        tools: {
          allowed: *
          strict: true
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundToolsProperty = false;
      let foundToolsBlock = false;
      let foundAllowedProperty = false;
      let foundStrictProperty = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ToolsProperty") foundToolsProperty = true;
        if (node.name === "ToolsBlock") foundToolsBlock = true;
        if (node.name === "AllowedProperty") foundAllowedProperty = true;
        if (node.name === "StrictProperty") foundStrictProperty = true;
      });

      expect(foundToolsProperty).toBe(true);
      expect(foundToolsBlock).toBe(true);
      expect(foundAllowedProperty).toBe(true);
      expect(foundStrictProperty).toBe(true);
    });

    it("parses agent_task with tools block - string list allowed", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        tools: {
          allowed: ["read_file", "write_file"]
          disallowed: ["exec"]
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundDisallowedProperty = false;

      tree.cursor().iterate((node) => {
        if (node.name === "DisallowedProperty") foundDisallowedProperty = true;
      });

      expect(foundDisallowedProperty).toBe(true);
    });

    it("parses agent_task with mcp block", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        mcp: {
          config_file: ".mcp/config.json"
          allowed: ["github", "slack"]
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundMcpProperty = false;
      let foundMcpBlock = false;
      let foundConfigFile = false;

      tree.cursor().iterate((node) => {
        if (node.name === "McpProperty") foundMcpProperty = true;
        if (node.name === "McpBlock") foundMcpBlock = true;
        if (node.name === "ConfigFileProperty") foundConfigFile = true;
      });

      expect(foundMcpProperty).toBe(true);
      expect(foundMcpBlock).toBe(true);
      expect(foundConfigFile).toBe(true);
    });

    it("parses agent_task with system_prompt string", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        system_prompt: "You are a helpful assistant"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundSystemPrompt = false;

      tree.cursor().iterate((node) => {
        if (node.name === "SystemPromptProperty") foundSystemPrompt = true;
      });

      expect(foundSystemPrompt).toBe(true);
    });

    it("parses agent_task with prompt from file reference", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        prompt: file("prompts/analyze.md")
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundPromptProperty = false;
      let foundFileReference = false;

      tree.cursor().iterate((node) => {
        if (node.name === "PromptProperty") foundPromptProperty = true;
        if (node.name === "FileReference") foundFileReference = true;
      });

      expect(foundPromptProperty).toBe(true);
      expect(foundFileReference).toBe(true);
    });

    it("parses agent_task with prompt from template reference", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        prompt: template("code_review")
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTemplateReference = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TemplateReference") foundTemplateReference = true;
      });

      expect(foundTemplateReference).toBe(true);
    });

    it("parses agent_task with output_schema string path", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: "AnalysisResult"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundOutputSchema = false;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputSchemaProperty") foundOutputSchema = true;
      });

      expect(foundOutputSchema).toBe(true);
    });

    it("parses agent_task with simple inline schema", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { rating: int }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundOutputSchema = false;
      let foundInlineSchema = false;
      let foundSchemaField = false;
      let foundSchemaPrimitiveType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputSchemaProperty") foundOutputSchema = true;
        if (node.name === "InlineSchema") foundInlineSchema = true;
        if (node.name === "SchemaField") foundSchemaField = true;
        if (node.name === "SchemaPrimitiveType") foundSchemaPrimitiveType = true;
      });

      expect(foundOutputSchema).toBe(true);
      expect(foundInlineSchema).toBe(true);
      expect(foundSchemaField).toBe(true);
      expect(foundSchemaPrimitiveType).toBe(true);
    });

    it("parses inline schema with array type", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { tags: [string] }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundArrayType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ArrayType") foundArrayType = true;
      });

      expect(foundArrayType).toBe(true);
    });

    it("parses inline schema with union type including null", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { value: string | null }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundUnionType = false;
      let foundNullType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "UnionType") foundUnionType = true;
        if (node.name === "NullType") foundNullType = true;
      });

      expect(foundUnionType).toBe(true);
      expect(foundNullType).toBe(true);
    });

    it("parses inline schema with string literal enum", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { severity: "error" | "warning" }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundUnionType = false;
      let foundStringLiteralType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "UnionType") foundUnionType = true;
        if (node.name === "StringLiteralType") foundStringLiteralType = true;
      });

      expect(foundUnionType).toBe(true);
      expect(foundStringLiteralType).toBe(true);
    });

    it("parses inline schema with nested object type", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { metadata: { name: string version: int } }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundObjectType = false;
      let schemaFieldCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "ObjectType") foundObjectType = true;
        if (node.name === "SchemaField") schemaFieldCount++;
      });

      expect(foundObjectType).toBe(true);
      expect(schemaFieldCount).toBe(3);
    });

    it("parses inline schema with array of objects", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: { items: [{ name: string value: int }] }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundArrayType = false;
      let foundObjectType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ArrayType") foundArrayType = true;
        if (node.name === "ObjectType") foundObjectType = true;
      });

      expect(foundArrayType).toBe(true);
      expect(foundObjectType).toBe(true);
    });

    it("parses complex inline schema with multiple fields and types", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: {
          rating: int
          summary: string
          tags: [string]
          severity: "error" | "warning" | null
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const nodeTypes = new Set<string>();
      tree.cursor().iterate((node) => {
        nodeTypes.add(node.name);
      });

      expect(nodeTypes.has("InlineSchema")).toBe(true);
      expect(nodeTypes.has("SchemaField")).toBe(true);
      expect(nodeTypes.has("SchemaPrimitiveType")).toBe(true);
      expect(nodeTypes.has("ArrayType")).toBe(true);
      expect(nodeTypes.has("UnionType")).toBe(true);
      expect(nodeTypes.has("StringLiteralType")).toBe(true);
      expect(nodeTypes.has("NullType")).toBe(true);
    });

    it("parses all primitive schema types", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_schema: {
          text: string
          count: int
          ratio: float
          active: bool
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const primitiveTypes: string[] = [];

      tree.cursor().iterate((node) => {
        if (node.name === "SchemaPrimitiveType") {
          primitiveTypes.push(source.slice(node.from, node.to));
        }
      });

      expect(primitiveTypes).toContain("string");
      expect(primitiveTypes).toContain("int");
      expect(primitiveTypes).toContain("float");
      expect(primitiveTypes).toContain("bool");
    });

    it("parses agent_task with output_artifact", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        output_artifact: "analysis_report"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundOutputArtifact = false;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputArtifactProperty") foundOutputArtifact = true;
      });

      expect(foundOutputArtifact).toBe(true);
    });

    it("parses agent_task with consumes block", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        model: "claude-sonnet-4-20250514"
        consumes: {
          previous_result: from("build.output")
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundConsumesProperty = false;
      let foundConsumesBlock = false;
      let foundConsumesItem = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ConsumesProperty") foundConsumesProperty = true;
        if (node.name === "ConsumesBlock") foundConsumesBlock = true;
        if (node.name === "ConsumesItem") foundConsumesItem = true;
      });

      expect(foundConsumesProperty).toBe(true);
      expect(foundConsumesBlock).toBe(true);
      expect(foundConsumesItem).toBe(true);
    });

    it("parses complex agent_task with all properties", () => {
      const source = `workflow code_review {
  on: pull_request

  agent_job review after lint {
    steps: [
      agent_task("Review code changes") {
        model: "claude-sonnet-4-20250514"
        max_turns: 15
        tools: {
          allowed: ["read_file", "search", "grep"]
          disallowed: ["write_file", "exec"]
          strict: true
        }
        mcp: {
          config_file: ".mcp/review.json"
          allowed: ["github"]
        }
        system_prompt: "You are an expert code reviewer"
        prompt: file("prompts/review.md")
        output_schema: "ReviewResult"
        output_artifact: "review_report"
        consumes: {
          lint_output: from("lint.result")
          test_coverage: from("test.coverage")
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const nodeTypes = new Set<string>();
      tree.cursor().iterate((node) => {
        nodeTypes.add(node.name);
      });

      expect(nodeTypes.has("AgentJobDecl")).toBe(true);
      expect(nodeTypes.has("AfterClause")).toBe(true);
      expect(nodeTypes.has("AgentTaskStep")).toBe(true);
      expect(nodeTypes.has("ModelProperty")).toBe(true);
      expect(nodeTypes.has("MaxTurnsProperty")).toBe(true);
      expect(nodeTypes.has("ToolsProperty")).toBe(true);
      expect(nodeTypes.has("McpProperty")).toBe(true);
      expect(nodeTypes.has("SystemPromptProperty")).toBe(true);
      expect(nodeTypes.has("PromptProperty")).toBe(true);
      expect(nodeTypes.has("OutputSchemaProperty")).toBe(true);
      expect(nodeTypes.has("OutputArtifactProperty")).toBe(true);
      expect(nodeTypes.has("ConsumesProperty")).toBe(true);
    });
  });

  describe("mixed job types", () => {
    it("parses workflow with both job and agent_job", () => {
      const source = `workflow mixed {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps: [
      run("npm install"),
      run("npm build")
    ]
  }

  agent_job analyze after build {
    steps: [
      agent_task("Analyze build output") {
        model: "claude-sonnet-4-20250514"
        prompt: "Review the build logs"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let jobCount = 0;
      let agentJobCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "JobDecl") jobCount++;
        if (node.name === "AgentJobDecl") agentJobCount++;
      });

      expect(jobCount).toBe(1);
      expect(agentJobCount).toBe(1);
    });
  });

  describe("Number token", () => {
    it("parses numbers in expressions", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Task") {
        max_turns: 42
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundNumber = false;
      let numberValue = "";

      tree.cursor().iterate((node) => {
        if (node.name === "Number") {
          foundNumber = true;
          numberValue = source.slice(node.from, node.to);
        }
      });

      expect(foundNumber).toBe(true);
      expect(numberValue).toBe("42");
    });
  });

  describe("cycle syntax", () => {
    it("parses basic cycle declaration", () => {
      const source = `workflow test {
  on: push
  cycle review_loop {
    max_iters = 5
    body {
      job check {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundCycleDecl = false;
      let cycleName = "";
      let inCycleDecl = false;

      tree.cursor().iterate((node) => {
        if (node.name === "CycleDecl") {
          foundCycleDecl = true;
          inCycleDecl = true;
        }
        if (inCycleDecl && node.name === "Identifier" && !cycleName) {
          cycleName = source.slice(node.from, node.to);
        }
      });

      expect(foundCycleDecl).toBe(true);
      expect(cycleName).toBe("review_loop");
    });

    it("parses cycle with max_iters property", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    max_iters = 10
    body {
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundMaxItersProperty = false;
      let maxItersValue = "";
      let inMaxIters = false;

      tree.cursor().iterate((node) => {
        if (node.name === "MaxItersProperty") {
          foundMaxItersProperty = true;
          inMaxIters = true;
        }
        if (inMaxIters && node.name === "Number") {
          maxItersValue = source.slice(node.from, node.to);
          inMaxIters = false;
        }
      });

      expect(foundMaxItersProperty).toBe(true);
      expect(maxItersValue).toBe("10");
    });

    it("parses cycle with key property", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    max_iters = 5
    key = "iteration_key"
    body {
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundKeyProperty = false;
      let keyValue = "";
      let inKeyProperty = false;

      tree.cursor().iterate((node) => {
        if (node.name === "KeyProperty") {
          foundKeyProperty = true;
          inKeyProperty = true;
        }
        if (inKeyProperty && node.name === "String") {
          keyValue = source.slice(node.from, node.to);
          inKeyProperty = false;
        }
      });

      expect(foundKeyProperty).toBe(true);
      expect(keyValue).toBe('"iteration_key"');
    });

    it("parses cycle with until guard_js", () => {
      const source = `workflow test {
  on: push
  cycle refine_loop {
    until guard_js """
      return context.quality_score > 0.95;
    """
    body {
      agent_job improve {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundUntilProperty = false;
      let foundGuardJs = false;
      let foundTripleQuotedString = false;

      tree.cursor().iterate((node) => {
        if (node.name === "UntilProperty") foundUntilProperty = true;
        if (node.name === "GuardJs") foundGuardJs = true;
        if (node.name === "TripleQuotedString") foundTripleQuotedString = true;
      });

      expect(foundUntilProperty).toBe(true);
      expect(foundGuardJs).toBe(true);
      expect(foundTripleQuotedString).toBe(true);
    });

    it("parses cycle with body containing jobs", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    max_iters = 3
    body {
      job first {
        steps: [
          run("echo first")
        ]
      }
      agent_job second {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundBodyBlock = false;
      let jobCount = 0;
      let agentJobCount = 0;
      let inBodyBlock = false;

      tree.cursor().iterate((node) => {
        if (node.name === "BodyBlock") {
          foundBodyBlock = true;
          inBodyBlock = true;
        }
        if (inBodyBlock && node.name === "JobDecl") jobCount++;
        if (inBodyBlock && node.name === "AgentJobDecl") agentJobCount++;
      });

      expect(foundBodyBlock).toBe(true);
      expect(jobCount).toBe(1);
      expect(agentJobCount).toBe(1);
    });

    it("parses cycle with all properties", () => {
      const source = `workflow test {
  on: push
  cycle full_cycle {
    max_iters = 10
    key = "my_key"
    until guard_js """
      return ctx.done === true;
    """
    body {
      job process {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const nodeTypes = new Set<string>();
      tree.cursor().iterate((node) => {
        nodeTypes.add(node.name);
      });

      expect(nodeTypes.has("CycleDecl")).toBe(true);
      expect(nodeTypes.has("CycleBody")).toBe(true);
      expect(nodeTypes.has("CycleProperty")).toBe(true);
      expect(nodeTypes.has("MaxItersProperty")).toBe(true);
      expect(nodeTypes.has("KeyProperty")).toBe(true);
      expect(nodeTypes.has("UntilProperty")).toBe(true);
      expect(nodeTypes.has("GuardJs")).toBe(true);
      expect(nodeTypes.has("TripleQuotedString")).toBe(true);
      expect(nodeTypes.has("BodyBlock")).toBe(true);
    });

    it("exports cycle term constants", () => {
      expect(terms.CycleDecl).toBeDefined();
      expect(terms.CycleBody).toBeDefined();
      expect(terms.CycleProperty).toBeDefined();
      expect(terms.MaxItersProperty).toBeDefined();
      expect(terms.KeyProperty).toBeDefined();
      expect(terms.UntilProperty).toBeDefined();
      expect(terms.GuardJs).toBeDefined();
      expect(terms.TripleQuotedString).toBeDefined();
      expect(terms.BodyBlock).toBeDefined();
    });
  });

  describe("job outputs syntax", () => {
    it("parses job with single output declaration", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundOutputsProperty = false;
      let foundOutputsBlock = false;
      let foundOutputDecl = false;
      let foundTypeName = false;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputsProperty") foundOutputsProperty = true;
        if (node.name === "OutputsBlock") foundOutputsBlock = true;
        if (node.name === "OutputDecl") foundOutputDecl = true;
        if (node.name === "TypeName") foundTypeName = true;
      });

      expect(foundOutputsProperty).toBe(true);
      expect(foundOutputsBlock).toBe(true);
      expect(foundOutputDecl).toBe(true);
      expect(foundTypeName).toBe(true);
    });

    it("parses job with multiple output declarations", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      count: int
      success: bool
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let outputDeclCount = 0;
      const typeNames: string[] = [];

      tree.cursor().iterate((node) => {
        if (node.name === "OutputDecl") outputDeclCount++;
        if (node.name === "TypeName") {
          typeNames.push(source.slice(node.from, node.to));
        }
      });

      expect(outputDeclCount).toBe(3);
      expect(typeNames).toContain("string");
      expect(typeNames).toContain("int");
      expect(typeNames).toContain("bool");
    });

    it("parses all supported type names", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      text: string
      count: int
      ratio: float
      flag: bool
      data: json
      file_out: path
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const typeNames = new Set<string>();

      tree.cursor().iterate((node) => {
        if (node.name === "TypeName") {
          typeNames.add(source.slice(node.from, node.to));
        }
      });

      expect(typeNames).toEqual(new Set(["string", "int", "float", "bool", "json", "path"]));
    });

    it("parses output declaration identifier names", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      my_output: string
      anotherOutput: int
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const outputNames: string[] = [];
      let inOutputDecl = false;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputDecl") {
          inOutputDecl = true;
        }
        if (inOutputDecl && node.name === "Identifier") {
          outputNames.push(source.slice(node.from, node.to));
          inOutputDecl = false;
        }
      });

      expect(outputNames).toContain("my_output");
      expect(outputNames).toContain("anotherOutput");
    });

    it("parses job with outputs and other properties", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    needs: setup
    outputs: {
      version: string
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundRunsOn = false;
      let foundNeeds = false;
      let foundOutputs = false;
      let foundSteps = false;

      tree.cursor().iterate((node) => {
        if (node.name === "RunsOnProperty") foundRunsOn = true;
        if (node.name === "NeedsProperty") foundNeeds = true;
        if (node.name === "OutputsProperty") foundOutputs = true;
        if (node.name === "StepsProperty") foundSteps = true;
      });

      expect(foundRunsOn).toBe(true);
      expect(foundNeeds).toBe(true);
      expect(foundOutputs).toBe(true);
      expect(foundSteps).toBe(true);
    });

    it("parses agent_job with outputs", () => {
      const source = `workflow test {
  on: push
  agent_job analyze {
    outputs: {
      analysis_result: json
    }
    steps: [
      agent_task("Analyze") {
        model: "claude-sonnet-4-20250514"
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundAgentJob = false;
      let foundOutputsProperty = false;

      tree.cursor().iterate((node) => {
        if (node.name === "AgentJobDecl") foundAgentJob = true;
        if (node.name === "OutputsProperty") foundOutputsProperty = true;
      });

      expect(foundAgentJob).toBe(true);
      expect(foundOutputsProperty).toBe(true);
    });

    it("parses empty outputs block", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundOutputsBlock = false;
      let outputDeclCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "OutputsBlock") foundOutputsBlock = true;
        if (node.name === "OutputDecl") outputDeclCount++;
      });

      expect(foundOutputsBlock).toBe(true);
      expect(outputDeclCount).toBe(0);
    });

    it("exports outputs term constants", () => {
      expect(terms.OutputsProperty).toBeDefined();
      expect(terms.OutputsBlock).toBeDefined();
      expect(terms.OutputDecl).toBeDefined();
      expect(terms.TypeName).toBeDefined();
    });
  });

  describe("matrix job syntax", () => {
    it("parses basic matrix job declaration", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20, 22]
    }
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundMatrixModifier = false;
      let foundAxesProperty = false;
      let foundAxisDecl = false;

      tree.cursor().iterate((node) => {
        if (node.name === "MatrixModifier") foundMatrixModifier = true;
        if (node.name === "AxesProperty") foundAxesProperty = true;
        if (node.name === "AxisDecl") foundAxisDecl = true;
      });

      expect(foundMatrixModifier).toBe(true);
      expect(foundAxesProperty).toBe(true);
      expect(foundAxisDecl).toBe(true);
    });

    it("parses matrix job with multiple axes", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20, 22]
      os: [ubuntu-latest, macos-latest]
    }
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let axisDeclCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "AxisDecl") axisDeclCount++;
      });

      expect(axisDeclCount).toBe(2);
    });

    it("parses matrix job with max_parallel property", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    max_parallel = 4
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundMaxParallelProperty = false;
      let maxParallelValue = "";
      let inMaxParallel = false;

      tree.cursor().iterate((node) => {
        if (node.name === "MaxParallelProperty") {
          foundMaxParallelProperty = true;
          inMaxParallel = true;
        }
        if (inMaxParallel && node.name === "Number") {
          maxParallelValue = source.slice(node.from, node.to);
          inMaxParallel = false;
        }
      });

      expect(foundMaxParallelProperty).toBe(true);
      expect(maxParallelValue).toBe("4");
    });

    it("parses matrix job with fail_fast property", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    fail_fast = false
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundFailFastProperty = false;
      let failFastValue = "";
      let inFailFast = false;

      tree.cursor().iterate((node) => {
        if (node.name === "FailFastProperty") {
          foundFailFastProperty = true;
          inFailFast = true;
        }
        if (inFailFast && node.name === "Boolean") {
          failFastValue = source.slice(node.from, node.to);
          inFailFast = false;
        }
      });

      expect(foundFailFastProperty).toBe(true);
      expect(failFastValue).toBe("false");
    });

    it("parses matrix job with all properties", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20, 22]
      os: [ubuntu-latest, macos-latest]
    }
    max_parallel = 4
    fail_fast = false
    runs_on: ubuntu-latest
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const nodeTypes = new Set<string>();
      tree.cursor().iterate((node) => {
        nodeTypes.add(node.name);
      });

      expect(nodeTypes.has("MatrixModifier")).toBe(true);
      expect(nodeTypes.has("AxesProperty")).toBe(true);
      expect(nodeTypes.has("AxisDecl")).toBe(true);
      expect(nodeTypes.has("MaxParallelProperty")).toBe(true);
      expect(nodeTypes.has("FailFastProperty")).toBe(true);
      expect(nodeTypes.has("RunsOnProperty")).toBe(true);
      expect(nodeTypes.has("StepsProperty")).toBe(true);
    });

    it("parses axis values as numbers", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      version: [18, 20, 22]
    }
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const numbers: string[] = [];
      let inAxisValueList = false;

      tree.cursor().iterate((node) => {
        if (node.name === "AxisValueList") {
          inAxisValueList = true;
        }
        if (inAxisValueList && node.name === "Number") {
          numbers.push(source.slice(node.from, node.to));
        }
        if (node.name === "AxisDecl") {
          inAxisValueList = false;
        }
      });

      expect(numbers).toContain("18");
      expect(numbers).toContain("20");
      expect(numbers).toContain("22");
    });

    it("parses axis values as strings", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      env: ["dev", "staging", "prod"]
    }
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const strings: string[] = [];
      let inAxisValueList = false;

      tree.cursor().iterate((node) => {
        if (node.name === "AxisValueList") {
          inAxisValueList = true;
        }
        if (inAxisValueList && node.name === "String") {
          strings.push(source.slice(node.from, node.to));
        }
        if (node.name === "AxisDecl") {
          inAxisValueList = false;
        }
      });

      expect(strings).toContain('"dev"');
      expect(strings).toContain('"staging"');
      expect(strings).toContain('"prod"');
    });

    it("parses axis values as bare identifiers with hyphens", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest, macos-latest, windows-latest]
    }
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundAxisValueList = false;
      let foundHyphenatedIdentifier = false;

      tree.cursor().iterate((node) => {
        if (node.name === "AxisValueList") foundAxisValueList = true;
        if (foundAxisValueList && node.name === "HyphenatedIdentifier") foundHyphenatedIdentifier = true;
      });

      expect(foundAxisValueList).toBe(true);
      expect(foundHyphenatedIdentifier).toBe(true);
    });

    it("exports matrix term constants", () => {
      expect(terms.MatrixModifier).toBeDefined();
      expect(terms.AxesProperty).toBeDefined();
      expect(terms.AxisDecl).toBeDefined();
      expect(terms.AxisValueList).toBeDefined();
      expect(terms.AxisValue).toBeDefined();
      expect(terms.HyphenatedIdentifier).toBeDefined();
      expect(terms.MaxParallelProperty).toBeDefined();
      expect(terms.FailFastProperty).toBeDefined();
    });
  });

  describe("type declaration syntax", () => {
    it("parses simple type declaration with one field", () => {
      const source = `type Foo { x: string }

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let typeName = "";
      let inTypeDecl = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") {
          foundTypeDecl = true;
          inTypeDecl = true;
        }
        if (inTypeDecl && node.name === "TypeDeclName" && !typeName) {
          typeName = source.slice(node.from, node.to);
        }
      });

      expect(foundTypeDecl).toBe(true);
      expect(typeName).toBe("Foo");
    });

    it("parses type declaration with multiple fields", () => {
      const source = `type BuildInfo {
  version: string
  commit: string
  timestamp: int
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let typeFieldCount = 0;
      const fieldNames: string[] = [];
      let inTypeField = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeField") {
          typeFieldCount++;
          inTypeField = true;
        }
        if (inTypeField && node.name === "Identifier") {
          fieldNames.push(source.slice(node.from, node.to));
          inTypeField = false;
        }
      });

      expect(typeFieldCount).toBe(3);
      expect(fieldNames).toContain("version");
      expect(fieldNames).toContain("commit");
      expect(fieldNames).toContain("timestamp");
    });

    it("parses type declaration with nested object type", () => {
      const source = `type Config {
  metadata: { name: string version: int }
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let foundObjectType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "ObjectType") foundObjectType = true;
      });

      expect(foundTypeDecl).toBe(true);
      expect(foundObjectType).toBe(true);
    });

    it("parses type declaration with array field", () => {
      const source = `type Result {
  items: [string]
  scores: [int]
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let arrayTypeCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "ArrayType") arrayTypeCount++;
      });

      expect(foundTypeDecl).toBe(true);
      expect(arrayTypeCount).toBe(2);
    });

    it("parses type declaration with union field", () => {
      const source = `type Response {
  status: "success" | "error" | "pending"
  value: string | null
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let unionTypeCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "UnionType") unionTypeCount++;
      });

      expect(foundTypeDecl).toBe(true);
      expect(unionTypeCount).toBe(2);
    });

    it("parses type declaration with array of objects", () => {
      const source = `type ReviewResult {
  comments: [{ filename: string lineNum: int message: string }]
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let foundArrayType = false;
      let foundObjectType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "ArrayType") foundArrayType = true;
        if (node.name === "ObjectType") foundObjectType = true;
      });

      expect(foundTypeDecl).toBe(true);
      expect(foundArrayType).toBe(true);
      expect(foundObjectType).toBe(true);
    });

    it("parses multiple type declarations before workflow", () => {
      const source = `type Point2D {
  x: int
  y: int
}

type Color {
  r: int
  g: int
  b: int
}

type Shape {
  position: { x: int y: int }
  color: { r: int g: int b: int }
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let typeDeclCount = 0;
      const typeNames: string[] = [];

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") {
          typeDeclCount++;
        }
        if (node.name === "TypeDeclName") {
          typeNames.push(source.slice(node.from, node.to));
        }
      });

      expect(typeDeclCount).toBe(3);
      expect(typeNames).toContain("Point2D");
      expect(typeNames).toContain("Color");
      expect(typeNames).toContain("Shape");
    });

    it("parses type with all primitive types", () => {
      const source = `type AllPrimitives {
  text: string
  count: int
  ratio: float
  active: bool
  data: json
  filePath: path
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      const primitiveTypes: string[] = [];

      tree.cursor().iterate((node) => {
        if (node.name === "SchemaPrimitiveType") {
          primitiveTypes.push(source.slice(node.from, node.to));
        }
      });

      expect(primitiveTypes).toContain("string");
      expect(primitiveTypes).toContain("int");
      expect(primitiveTypes).toContain("float");
      expect(primitiveTypes).toContain("bool");
      expect(primitiveTypes).toContain("json");
      expect(primitiveTypes).toContain("path");
    });

    it("parses job output with type reference", () => {
      const source = `type BuildInfo {
  version: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      info: BuildInfo
    }
    steps: [run("echo test")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let foundOutputDecl = false;
      let foundTypeReference = false;
      let typeRefName = "";

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "OutputDecl") foundOutputDecl = true;
        if (node.name === "TypeReference") {
          foundTypeReference = true;
          typeRefName = source.slice(node.from, node.to);
        }
      });

      expect(foundTypeDecl).toBe(true);
      expect(foundOutputDecl).toBe(true);
      expect(foundTypeReference).toBe(true);
      expect(typeRefName).toBe("BuildInfo");
    });

    it("parses agent task with type reference in output_schema", () => {
      const source = `type AnalysisResult {
  rating: int
  summary: string
}

workflow test {
  on: push
  agent_job analyze {
    steps: [
      agent_task("Analyze") {
        model: "claude-sonnet-4-20250514"
        output_schema: AnalysisResult
      }
    ]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let foundOutputSchemaProperty = false;
      let foundSchemaTypeReference = false;
      let typeRefName = "";

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "OutputSchemaProperty") foundOutputSchemaProperty = true;
        if (node.name === "SchemaTypeReference") {
          foundSchemaTypeReference = true;
          typeRefName = source.slice(node.from, node.to);
        }
      });

      expect(foundTypeDecl).toBe(true);
      expect(foundOutputSchemaProperty).toBe(true);
      expect(foundSchemaTypeReference).toBe(true);
      expect(typeRefName).toBe("AnalysisResult");
    });

    it("parses complex type with string literal enum", () => {
      const source = `type ReviewComment {
  filename: string
  lineNum: int
  severity: "error" | "warning" | "info"
  message: string
}

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let foundUnionType = false;
      let foundStringLiteralType = false;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "UnionType") foundUnionType = true;
        if (node.name === "StringLiteralType") foundStringLiteralType = true;
      });

      expect(foundTypeDecl).toBe(true);
      expect(foundUnionType).toBe(true);
      expect(foundStringLiteralType).toBe(true);
    });

    it("parses empty type declaration", () => {
      const source = `type Empty { }

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundTypeDecl = false;
      let typeFieldCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") foundTypeDecl = true;
        if (node.name === "TypeField") typeFieldCount++;
      });

      expect(foundTypeDecl).toBe(true);
      expect(typeFieldCount).toBe(0);
    });

    it("parses types and workflows together", () => {
      const source = `type Config {
  name: string
}

workflow first {
  on: push
  job a {
    outputs: { config: Config }
    steps: []
  }
}

workflow second {
  on: pull_request
  job b {
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let typeDeclCount = 0;
      let workflowDeclCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") typeDeclCount++;
        if (node.name === "WorkflowDecl") workflowDeclCount++;
      });

      expect(typeDeclCount).toBe(1);
      expect(workflowDeclCount).toBe(2);
    });

    it("exports type declaration term constants", () => {
      expect(terms.TypeDecl).toBeDefined();
      expect(terms.TypeDeclName).toBeDefined();
      expect(terms.TypeField).toBeDefined();
      expect(terms.TypeReference).toBeDefined();
      expect(terms.OutputType).toBeDefined();
      expect(terms.SchemaTypeReference).toBeDefined();
    });

    it("parses workflow without any type declarations", () => {
      const source = `workflow test {
  on: push
  job hello {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let typeDeclCount = 0;
      let workflowDeclCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "TypeDecl") typeDeclCount++;
        if (node.name === "WorkflowDecl") workflowDeclCount++;
      });

      expect(typeDeclCount).toBe(0);
      expect(workflowDeclCount).toBe(1);
    });
  });

  describe("import syntax", () => {
    it("parses single import", () => {
      const source = `import { Foo } from "./foo.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundImportDecl = false;
      let foundImportItem = false;
      let foundImportPath = false;
      let importName = "";
      let importPath = "";

      tree.cursor().iterate((node) => {
        if (node.name === "ImportDecl") foundImportDecl = true;
        if (node.name === "ImportItem") foundImportItem = true;
        if (node.name === "ImportPath") foundImportPath = true;
        if (node.name === "Identifier" && foundImportItem && !importName) {
          importName = source.slice(node.from, node.to);
        }
        if (node.name === "String" && foundImportPath && !importPath) {
          importPath = source.slice(node.from, node.to);
        }
      });

      expect(foundImportDecl).toBe(true);
      expect(foundImportItem).toBe(true);
      expect(foundImportPath).toBe(true);
      expect(importName).toBe("Foo");
      expect(importPath).toBe('"./foo.workpipe"');
    });

    it("parses multiple imports in single statement", () => {
      const source = `import { Foo, Bar, Baz } from "./types.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let importItemCount = 0;
      const importNames: string[] = [];
      let inImportItem = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportItem") {
          importItemCount++;
          inImportItem = true;
        }
        if (inImportItem && node.name === "Identifier") {
          importNames.push(source.slice(node.from, node.to));
          inImportItem = false;
        }
      });

      expect(importItemCount).toBe(3);
      expect(importNames).toContain("Foo");
      expect(importNames).toContain("Bar");
      expect(importNames).toContain("Baz");
    });

    it("parses aliased import", () => {
      const source = `import { Foo as F } from "./foo.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundImportItem = false;
      const identifiers: string[] = [];
      let inImportItem = false;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportItem") {
          foundImportItem = true;
          inImportItem = true;
        }
        if (inImportItem && node.name === "Identifier") {
          identifiers.push(source.slice(node.from, node.to));
        }
        if (node.name === "ImportPath") {
          inImportItem = false;
        }
      });

      expect(foundImportItem).toBe(true);
      expect(identifiers).toContain("Foo");
      expect(identifiers).toContain("F");
    });

    it("parses multiple aliased imports", () => {
      const source = `import { Foo as F, Bar as B } from "./types.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let importItemCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportItem") importItemCount++;
      });

      expect(importItemCount).toBe(2);
    });

    it("parses import with trailing comma", () => {
      const source = `import { Foo, } from "./foo.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundImportDecl = false;
      let importItemCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportDecl") foundImportDecl = true;
        if (node.name === "ImportItem") importItemCount++;
      });

      expect(foundImportDecl).toBe(true);
      expect(importItemCount).toBe(1);
    });

    it("parses multiple import statements", () => {
      const source = `import { Foo } from "./foo.workpipe"
import { Bar, Baz } from "./bar.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let importDeclCount = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportDecl") importDeclCount++;
      });

      expect(importDeclCount).toBe(2);
    });

    it("parses import before types before workflows (order enforced)", () => {
      const source = `import { BuildInfo } from "./types.workpipe"

type LocalType {
  name: string
}

workflow test {
  on: push
  job build {
    outputs: {
      info: BuildInfo
    }
    steps: []
  }
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundImportDecl = false;
      let foundTypeDecl = false;
      let foundWorkflowDecl = false;
      let importPosition = -1;
      let typePosition = -1;
      let workflowPosition = -1;
      let position = 0;

      tree.cursor().iterate((node) => {
        if (node.name === "ImportDecl" && !foundImportDecl) {
          foundImportDecl = true;
          importPosition = position++;
        }
        if (node.name === "TypeDecl" && !foundTypeDecl) {
          foundTypeDecl = true;
          typePosition = position++;
        }
        if (node.name === "WorkflowDecl" && !foundWorkflowDecl) {
          foundWorkflowDecl = true;
          workflowPosition = position++;
        }
      });

      expect(foundImportDecl).toBe(true);
      expect(foundTypeDecl).toBe(true);
      expect(foundWorkflowDecl).toBe(true);
      expect(importPosition).toBeLessThan(typePosition);
      expect(typePosition).toBeLessThan(workflowPosition);
    });

    it("parses import with relative parent path", () => {
      const source = `import { ReviewResult as CodeReview } from "../shared/review.workpipe"

workflow test {
  on: push
}`;
      const tree = parse(source);
      expect(hasErrors(tree)).toBe(false);

      let foundImportPath = false;
      let importPathValue = "";

      tree.cursor().iterate((node) => {
        if (node.name === "ImportPath") {
          foundImportPath = true;
        }
        if (foundImportPath && node.name === "String" && !importPathValue) {
          importPathValue = source.slice(node.from, node.to);
        }
      });

      expect(foundImportPath).toBe(true);
      expect(importPathValue).toBe('"../shared/review.workpipe"');
    });

    it("exports import term constants", () => {
      expect(terms.ImportDecl).toBeDefined();
      expect(terms.ImportList).toBeDefined();
      expect(terms.ImportItem).toBeDefined();
      expect(terms.ImportPath).toBeDefined();
    });
  });
});
