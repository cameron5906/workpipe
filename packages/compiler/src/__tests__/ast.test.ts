import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@workpipe/lang";
import { buildAST, buildFileAST } from "../ast/index.js";
import type {
  WorkflowNode,
  WorkPipeFileNode,
  JobNode,
  AgentJobNode,
  AgentTaskNode,
  RunStepNode,
  UsesStepNode,
  GuardJsStepNode,
  BinaryExpressionNode,
  PropertyAccessNode,
  StringLiteralNode,
  CycleNode,
  SchemaObjectNode,
  SchemaPrimitiveNode,
  SchemaArrayNode,
  SchemaUnionNode,
  SchemaNullNode,
  SchemaStringLiteralNode,
  TypeDeclarationNode,
  TypeFieldNode,
  PrimitiveTypeNode,
  TypeReferenceNode,
  ArrayTypeNode,
  ObjectTypeNode,
  UnionTypeNode,
  StringLiteralTypeNode,
  NullTypeNode,
  ImportDeclarationNode,
  ImportItemNode,
} from "../ast/index.js";

function loadExample(name: string): string {
  const examplesRoot = resolve(__dirname, "../../../../examples");
  return readFileSync(resolve(examplesRoot, name), "utf-8");
}

describe("AST Builder", () => {
  describe("minimal.workpipe", () => {
    it("parses workflow name correctly", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.kind).toBe("workflow");
      expect(ast!.name).toBe("minimal");
    });

    it("parses trigger with single event", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.trigger).not.toBeNull();
      expect(ast!.trigger!.kind).toBe("trigger");
      expect(ast!.trigger!.events).toEqual(["push"]);
    });

    it("parses job with run step", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(1);

      const job = ast!.jobs[0] as JobNode;
      expect(job.kind).toBe("job");
      expect(job.name).toBe("hello");
      expect(job.runsOn).toBe("ubuntu-latest");
      expect(job.needs).toEqual([]);
      expect(job.condition).toBeNull();

      expect(job.steps).toHaveLength(1);
      const step = job.steps[0] as RunStepNode;
      expect(step.kind).toBe("run");
      expect(step.command).toBe("echo Hello, WorkPipe!");
    });
  });

  describe("simple-job.workpipe", () => {
    it("parses workflow name correctly", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.name).toBe("simple_job");
    });

    it("parses trigger with multiple events", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.trigger).not.toBeNull();
      expect(ast!.trigger!.events).toEqual(["push", "pull_request"]);
    });

    it("parses two jobs", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(2);
      expect(ast!.jobs[0].name).toBe("build");
      expect(ast!.jobs[1].name).toBe("deploy");
    });

    it("parses build job with uses and run steps", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const buildJob = ast!.jobs[0] as JobNode;
      expect(buildJob.runsOn).toBe("ubuntu-latest");
      expect(buildJob.needs).toEqual([]);
      expect(buildJob.condition).toBeNull();
      expect(buildJob.steps).toHaveLength(3);

      const usesStep = buildJob.steps[0] as UsesStepNode;
      expect(usesStep.kind).toBe("uses");
      expect(usesStep.action).toBe("actions/checkout@v4");

      const runStep1 = buildJob.steps[1] as RunStepNode;
      expect(runStep1.kind).toBe("run");
      expect(runStep1.command).toBe("npm install");

      const runStep2 = buildJob.steps[2] as RunStepNode;
      expect(runStep2.kind).toBe("run");
      expect(runStep2.command).toBe("npm test");
    });

    it("parses deploy job with needs dependency", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const deployJob = ast!.jobs[1];
      expect(deployJob.needs).toEqual(["build"]);
    });

    it("parses deploy job condition expression", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const deployJob = ast!.jobs[1] as JobNode;
      expect(deployJob.condition).not.toBeNull();

      const condition = deployJob.condition as BinaryExpressionNode;
      expect(condition.kind).toBe("binary");
      expect(condition.operator).toBe("==");

      const left = condition.left as PropertyAccessNode;
      expect(left.kind).toBe("property");
      expect(left.path).toEqual(["github", "ref"]);

      const right = condition.right as StringLiteralNode;
      expect(right.kind).toBe("string");
      expect(right.value).toBe("refs/heads/main");
    });
  });

  describe("span preservation", () => {
    it("preserves workflow span", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.span.start).toBe(0);
      expect(ast!.span.end).toBeGreaterThan(0);
    });

    it("preserves trigger span", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.trigger!.span.start).toBeGreaterThan(0);
      expect(ast!.trigger!.span.end).toBeGreaterThan(ast!.trigger!.span.start);
    });

    it("preserves job span", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0];
      expect(job.span.start).toBeGreaterThan(0);
      expect(job.span.end).toBeGreaterThan(job.span.start);
    });

    it("preserves step span", () => {
      const source = loadExample("minimal/minimal.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0];
      expect(step.span.start).toBeGreaterThan(0);
      expect(step.span.end).toBeGreaterThan(step.span.start);
    });

    it("preserves expression spans", () => {
      const source = loadExample("simple-job/simple-job.workpipe");
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const deployJob = ast!.jobs[1] as JobNode;
      const condition = deployJob.condition as BinaryExpressionNode;
      expect(condition.span.start).toBeGreaterThan(0);
      expect(condition.span.end).toBeGreaterThan(condition.span.start);

      const left = condition.left as PropertyAccessNode;
      expect(left.span.start).toBeGreaterThan(0);
      expect(left.span.end).toBeGreaterThan(left.span.start);

      const right = condition.right as StringLiteralNode;
      expect(right.span.start).toBeGreaterThan(0);
      expect(right.span.end).toBeGreaterThan(right.span.start);
    });
  });

  describe("error recovery", () => {
    it("returns null for empty input", () => {
      const source = "";
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).toBeNull();
    });

    it("produces partial AST for invalid syntax", () => {
      const source = `workflow broken {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [
      run("valid step")
    ]
  }
`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.name).toBe("broken");
      expect(ast!.trigger!.events).toEqual(["push"]);
      expect(ast!.jobs).toHaveLength(1);
      expect(ast!.jobs[0].name).toBe("test");
    });
  });

  describe("string unquoting", () => {
    it("handles simple strings", () => {
      const source = `workflow test {
  on: push
  job test {
    steps: [
      run("simple string")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as RunStepNode;
      expect(step.command).toBe("simple string");
    });

    it("handles escaped quotes", () => {
      const source = `workflow test {
  on: push
  job test {
    steps: [
      run("say \\"hello\\"")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as RunStepNode;
      expect(step.command).toBe('say "hello"');
    });

    it("handles escaped backslashes", () => {
      const source = `workflow test {
  on: push
  job test {
    steps: [
      run("path\\\\to\\\\file")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as RunStepNode;
      expect(step.command).toBe("path\\to\\file");
    });

    it("handles newline escapes", () => {
      const source = `workflow test {
  on: push
  job test {
    steps: [
      run("line1\\nline2")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as RunStepNode;
      expect(step.command).toBe("line1\nline2");
    });

    it("handles tab escapes", () => {
      const source = `workflow test {
  on: push
  job test {
    steps: [
      run("col1\\tcol2")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as RunStepNode;
      expect(step.command).toBe("col1\tcol2");
    });
  });

  describe("agent job parsing", () => {
    it("parses basic agent_job declaration", () => {
      const source = `workflow test {
  on: push
  agent_job analyzer {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.jobs).toHaveLength(1);

      const job = ast!.jobs[0] as AgentJobNode;
      expect(job.kind).toBe("agent_job");
      expect(job.name).toBe("analyzer");
      expect(job.runsOn).toBe("ubuntu-latest");
      expect(job.after).toBeUndefined();
    });

    it("parses agent_job with after clause", () => {
      const source = `workflow test {
  on: push
  job setup {
    runs_on: ubuntu-latest
    steps: [
      run("setup")
    ]
  }
  agent_job analyzer after setup {
    runs_on: ubuntu-latest
    steps: [
      run("analyze")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(2);

      const agentJob = ast!.jobs[1] as AgentJobNode;
      expect(agentJob.kind).toBe("agent_job");
      expect(agentJob.name).toBe("analyzer");
      expect(agentJob.after).toBe("setup");
    });

    it("parses agent_job with needs dependency", () => {
      const source = `workflow test {
  on: push
  agent_job analyzer {
    runs_on: ubuntu-latest
    needs: build
    steps: [
      run("analyze")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as AgentJobNode;
      expect(job.needs).toEqual(["build"]);
    });
  });

  describe("agent task step parsing", () => {
    it("parses basic agent_task step", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze the code") {
        model: "claude-3-opus"
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs[0].steps).toHaveLength(1);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.kind).toBe("agent_task");
      expect(step.taskDescription).toBe("Analyze the code");
      expect(step.model).toBe("claude-3-opus");
    });

    it("parses agent_task with max_turns", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        max_turns: 10
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.maxTurns).toBe(10);
    });

    it("parses agent_task with tools configuration", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        tools: {
          allowed: ["read", "write"]
          disallowed: ["delete"]
          strict: true
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.tools).toBeDefined();
      expect(step.tools!.allowed).toEqual(["read", "write"]);
      expect(step.tools!.disallowed).toEqual(["delete"]);
      expect(step.tools!.strict).toBe(true);
    });

    it("parses agent_task with tools allowed: *", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        tools: {
          allowed: *
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.tools).toBeDefined();
      expect(step.tools!.allowed).toEqual(["*"]);
    });

    it("parses agent_task with mcp configuration", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        mcp: {
          config_file: "./mcp.json"
          allowed: ["server1", "server2"]
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.mcp).toBeDefined();
      expect(step.mcp!.configFile).toBe("./mcp.json");
      expect(step.mcp!.allowed).toEqual(["server1", "server2"]);
    });

    it("parses agent_task with literal system_prompt", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        system_prompt: "You are a helpful assistant"
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.systemPrompt).toBeDefined();
      expect(step.systemPrompt!.kind).toBe("literal");
      expect((step.systemPrompt as { kind: "literal"; value: string }).value).toBe("You are a helpful assistant");
    });

    it("parses agent_task with file reference prompt", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        system_prompt: file("./prompts/system.md")
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.systemPrompt).toBeDefined();
      expect(step.systemPrompt!.kind).toBe("file");
      expect((step.systemPrompt as { kind: "file"; path: string }).path).toBe("./prompts/system.md");
    });

    it("parses agent_task with template reference prompt", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        prompt: template("analyze-{{type}}")
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.prompt).toBeDefined();
      expect(step.prompt!.kind).toBe("template");
      expect((step.prompt as { kind: "template"; content: string }).content).toBe("analyze-{{type}}");
    });

    it("parses agent_task with output_schema and output_artifact", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: "AnalysisResult"
        output_artifact: "analysis.json"
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.outputSchema).toBe("AnalysisResult");
      expect(step.outputArtifact).toBe("analysis.json");
    });

    it("parses agent_task with consumes block", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        consumes: {
          data: from("previous_job.output")
          config: from("setup.config")
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.consumes).toHaveLength(2);
      expect(step.consumes[0].name).toBe("data");
      expect(step.consumes[0].source).toBe("previous_job.output");
      expect(step.consumes[1].name).toBe("config");
      expect(step.consumes[1].source).toBe("setup.config");
    });

    it("parses fully configured agent_task", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Full analysis task") {
        model: "claude-3-opus"
        max_turns: 20
        tools: {
          allowed: ["read", "write"]
          strict: false
        }
        system_prompt: "You are an expert analyzer"
        prompt: file("./prompt.md")
        output_schema: "Result"
        output_artifact: "result.json"
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.kind).toBe("agent_task");
      expect(step.taskDescription).toBe("Full analysis task");
      expect(step.model).toBe("claude-3-opus");
      expect(step.maxTurns).toBe(20);
      expect(step.tools!.allowed).toEqual(["read", "write"]);
      expect(step.tools!.strict).toBe(false);
      expect(step.systemPrompt!.kind).toBe("literal");
      expect(step.prompt!.kind).toBe("file");
      expect(step.outputSchema).toBe("Result");
      expect(step.outputArtifact).toBe("result.json");
    });
  });

  describe("mixed job types", () => {
    it("parses workflow with both regular and agent jobs", () => {
      const source = `workflow mixed {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [
      run("npm build")
    ]
  }
  agent_job analyze after build {
    runs_on: ubuntu-latest
    steps: [
      agent_task("Analyze build output") {
        model: "claude-3-sonnet"
      }
    ]
  }
  job deploy {
    runs_on: ubuntu-latest
    needs: analyze
    steps: [
      run("npm deploy")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(3);

      const buildJob = ast!.jobs[0] as JobNode;
      expect(buildJob.kind).toBe("job");
      expect(buildJob.name).toBe("build");

      const analyzeJob = ast!.jobs[1] as AgentJobNode;
      expect(analyzeJob.kind).toBe("agent_job");
      expect(analyzeJob.name).toBe("analyze");
      expect(analyzeJob.after).toBe("build");

      const deployJob = ast!.jobs[2] as JobNode;
      expect(deployJob.kind).toBe("job");
      expect(deployJob.name).toBe("deploy");
      expect(deployJob.needs).toEqual(["analyze"]);
    });
  });

  describe("cycle parsing", () => {
    it("parses basic cycle with max_iters", () => {
      const source = `workflow test {
  on: push
  cycle review_loop {
    max_iters = 5
    body {
      job check {
        runs_on: ubuntu-latest
        steps: [
          run("echo checking")
        ]
      }
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.cycles).toHaveLength(1);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.kind).toBe("cycle");
      expect(cycle.name).toBe("review_loop");
      expect(cycle.maxIters).toBe(5);
      expect(cycle.key).toBeNull();
      expect(cycle.until).toBeNull();
      expect(cycle.body.kind).toBe("cycle_body");
      expect(cycle.body.jobs).toHaveLength(1);
      expect(cycle.body.jobs[0].name).toBe("check");
    });

    it("parses cycle with key property", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    max_iters = 3
    key = "iteration_key"
    body {
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.key).toBe("iteration_key");
    });

    it("parses cycle with until guard_js", () => {
      const source = `workflow test {
  on: push
  cycle refine_loop {
    until guard_js """
      return context.quality_score > 0.95;
    """
    body {
      job improve {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.maxIters).toBeNull();
      expect(cycle.until).not.toBeNull();
      expect(cycle.until!.kind).toBe("guard_js");
      expect(cycle.until!.code).toContain("return context.quality_score > 0.95");
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
      agent_job analyze {
        steps: []
      }
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.name).toBe("full_cycle");
      expect(cycle.maxIters).toBe(10);
      expect(cycle.key).toBe("my_key");
      expect(cycle.until).not.toBeNull();
      expect(cycle.until!.code).toContain("return ctx.done === true");
      expect(cycle.body.jobs).toHaveLength(2);
      expect(cycle.body.jobs[0].kind).toBe("job");
      expect(cycle.body.jobs[1].kind).toBe("agent_job");
    });

    it("parses workflow with both cycles and jobs", () => {
      const source = `workflow mixed {
  on: push
  job setup {
    runs_on: ubuntu-latest
    steps: []
  }
  cycle iterate {
    max_iters = 5
    body {
      job process {
        steps: []
      }
    }
  }
  job cleanup {
    runs_on: ubuntu-latest
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(2);
      expect(ast!.jobs[0].name).toBe("setup");
      expect(ast!.jobs[1].name).toBe("cleanup");
      expect(ast!.cycles).toHaveLength(1);
      expect(ast!.cycles[0].name).toBe("iterate");
    });

    it("preserves cycle span", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    max_iters = 5
    body {
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.span.start).toBeGreaterThan(0);
      expect(cycle.span.end).toBeGreaterThan(cycle.span.start);
    });

    it("preserves guard_js span", () => {
      const source = `workflow test {
  on: push
  cycle my_cycle {
    until guard_js """return true;"""
    body {
    }
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const cycle = ast!.cycles[0] as CycleNode;
      expect(cycle.until).not.toBeNull();
      expect(cycle.until!.span.start).toBeGreaterThan(0);
      expect(cycle.until!.span.end).toBeGreaterThan(cycle.until!.span.start);
    });
  });

  describe("outputs parsing", () => {
    it("parses job with outputs block", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      success: bool
    }
    steps: [
      run("echo hello")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.jobs).toHaveLength(1);

      const job = ast!.jobs[0] as JobNode;
      expect(job.outputs).toHaveLength(2);
      expect(job.outputs[0].name).toBe("version");
      expect(job.outputs[0].type).toBe("string");
      expect(job.outputs[1].name).toBe("success");
      expect(job.outputs[1].type).toBe("bool");
    });

    it("parses job with all output types", () => {
      const source = `workflow test {
  on: push
  job types {
    runs_on: ubuntu-latest
    outputs: {
      str: string
      num: int
      flt: float
      flag: bool
      data: json
      file_out: path
    }
    steps: [
      run("echo")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as JobNode;
      expect(job.outputs).toHaveLength(6);
      expect(job.outputs.map(o => o.type)).toEqual(["string", "int", "float", "bool", "json", "path"]);
    });

    it("parses job without outputs as empty array", () => {
      const source = `workflow test {
  on: push
  job simple {
    runs_on: ubuntu-latest
    steps: [
      run("echo")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as JobNode;
      expect(job.outputs).toEqual([]);
    });

    it("preserves output declaration span", () => {
      const source = `workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    outputs: {
      result: string
    }
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as JobNode;
      expect(job.outputs[0].span.start).toBeGreaterThan(0);
      expect(job.outputs[0].span.end).toBeGreaterThan(job.outputs[0].span.start);
    });
  });

  describe("inline schema parsing", () => {
    it("parses agent_task with inline schema containing primitive fields", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          name: string
          count: int
          score: float
          active: bool
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.outputSchema).toBeDefined();
      expect(typeof step.outputSchema).toBe("object");

      const schema = step.outputSchema as SchemaObjectNode;
      expect(schema.kind).toBe("object");
      expect(schema.fields).toHaveLength(4);

      expect(schema.fields[0].name).toBe("name");
      expect((schema.fields[0].type as SchemaPrimitiveNode).kind).toBe("primitive");
      expect((schema.fields[0].type as SchemaPrimitiveNode).type).toBe("string");

      expect(schema.fields[1].name).toBe("count");
      expect((schema.fields[1].type as SchemaPrimitiveNode).type).toBe("int");

      expect(schema.fields[2].name).toBe("score");
      expect((schema.fields[2].type as SchemaPrimitiveNode).type).toBe("float");

      expect(schema.fields[3].name).toBe("active");
      expect((schema.fields[3].type as SchemaPrimitiveNode).type).toBe("bool");
    });

    it("parses agent_task with inline schema containing array type", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          items: [string]
          numbers: [int]
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.fields).toHaveLength(2);

      const itemsField = schema.fields[0];
      expect(itemsField.name).toBe("items");
      expect((itemsField.type as SchemaArrayNode).kind).toBe("array");
      expect(((itemsField.type as SchemaArrayNode).elementType as SchemaPrimitiveNode).type).toBe("string");

      const numbersField = schema.fields[1];
      expect(numbersField.name).toBe("numbers");
      expect((numbersField.type as SchemaArrayNode).kind).toBe("array");
      expect(((numbersField.type as SchemaArrayNode).elementType as SchemaPrimitiveNode).type).toBe("int");
    });

    it("parses agent_task with inline schema containing union type", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          value: string | int
          optional: string | null
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.fields).toHaveLength(2);

      const valueField = schema.fields[0];
      expect(valueField.name).toBe("value");
      expect((valueField.type as SchemaUnionNode).kind).toBe("union");
      expect((valueField.type as SchemaUnionNode).types).toHaveLength(2);
      expect(((valueField.type as SchemaUnionNode).types[0] as SchemaPrimitiveNode).type).toBe("string");
      expect(((valueField.type as SchemaUnionNode).types[1] as SchemaPrimitiveNode).type).toBe("int");

      const optionalField = schema.fields[1];
      expect(optionalField.name).toBe("optional");
      expect((optionalField.type as SchemaUnionNode).kind).toBe("union");
      expect(((optionalField.type as SchemaUnionNode).types[1] as SchemaNullNode).kind).toBe("null");
    });

    it("parses agent_task with inline schema containing string literal type", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          status: "success" | "error"
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.fields).toHaveLength(1);

      const statusField = schema.fields[0];
      expect(statusField.name).toBe("status");
      expect((statusField.type as SchemaUnionNode).kind).toBe("union");
      expect(((statusField.type as SchemaUnionNode).types[0] as SchemaStringLiteralNode).kind).toBe("stringLiteral");
      expect(((statusField.type as SchemaUnionNode).types[0] as SchemaStringLiteralNode).value).toBe("success");
      expect(((statusField.type as SchemaUnionNode).types[1] as SchemaStringLiteralNode).value).toBe("error");
    });

    it("parses agent_task with inline schema containing nested object", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          user: {
            name: string
            age: int
          }
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.fields).toHaveLength(1);

      const userField = schema.fields[0];
      expect(userField.name).toBe("user");
      expect((userField.type as SchemaObjectNode).kind).toBe("object");

      const nestedSchema = userField.type as SchemaObjectNode;
      expect(nestedSchema.fields).toHaveLength(2);
      expect(nestedSchema.fields[0].name).toBe("name");
      expect(nestedSchema.fields[1].name).toBe("age");
    });

    it("parses agent_task with inline schema containing array of objects", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          items: [{
            id: int
            label: string
          }]
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.fields).toHaveLength(1);

      const itemsField = schema.fields[0];
      expect(itemsField.name).toBe("items");
      expect((itemsField.type as SchemaArrayNode).kind).toBe("array");

      const elementType = (itemsField.type as SchemaArrayNode).elementType as SchemaObjectNode;
      expect(elementType.kind).toBe("object");
      expect(elementType.fields).toHaveLength(2);
      expect(elementType.fields[0].name).toBe("id");
      expect(elementType.fields[1].name).toBe("label");
    });

    it("still parses agent_task with string output_schema", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: "AnalysisResult"
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      expect(step.outputSchema).toBe("AnalysisResult");
      expect(typeof step.outputSchema).toBe("string");
    });

    it("preserves inline schema spans", () => {
      const source = `workflow test {
  on: push
  job analyze {
    steps: [
      agent_task("Analyze") {
        output_schema: {
          name: string
        }
      }
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as AgentTaskNode;
      const schema = step.outputSchema as SchemaObjectNode;

      expect(schema.span.start).toBeGreaterThan(0);
      expect(schema.span.end).toBeGreaterThan(schema.span.start);

      expect(schema.fields[0].span.start).toBeGreaterThan(0);
      expect(schema.fields[0].span.end).toBeGreaterThan(schema.fields[0].span.start);
    });
  });

  describe("guard_js step parsing", () => {
    it("parses basic guard_js step", () => {
      const source = `workflow test {
  on: push
  job guard {
    steps: [
      step "decide" guard_js """
        return context.event.issue?.labels?.some(l => l.name === 'priority');
      """
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.jobs).toHaveLength(1);
      expect(ast!.jobs[0].steps).toHaveLength(1);

      const step = ast!.jobs[0].steps[0] as GuardJsStepNode;
      expect(step.kind).toBe("guard_js_step");
      expect(step.id).toBe("decide");
      expect(step.code).toContain("return context.event.issue?.labels?.some");
    });

    it("parses guard_js step with simple boolean check", () => {
      const source = `workflow test {
  on: push
  job guard {
    steps: [
      step "check_branch" guard_js """
        return context.ref === 'refs/heads/main';
      """
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as GuardJsStepNode;
      expect(step.kind).toBe("guard_js_step");
      expect(step.id).toBe("check_branch");
      expect(step.code).toContain("refs/heads/main");
    });

    it("parses guard_js step with multiline code", () => {
      const source = `workflow test {
  on: push
  job guard {
    steps: [
      step "complex_guard" guard_js """
        const labels = context.event.issue?.labels || [];
        const hasPriority = labels.some(l => l.name === 'priority');
        const isUrgent = labels.some(l => l.name === 'urgent');
        return hasPriority || isUrgent;
      """
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as GuardJsStepNode;
      expect(step.kind).toBe("guard_js_step");
      expect(step.id).toBe("complex_guard");
      expect(step.code).toContain("const labels = context.event.issue?.labels");
      expect(step.code).toContain("return hasPriority || isUrgent");
    });

    it("parses guard_js step mixed with other steps", () => {
      const source = `workflow test {
  on: push
  job guard {
    steps: [
      uses("actions/checkout@v4"),
      step "check" guard_js """
        return true;
      """,
      run("echo done")
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs[0].steps).toHaveLength(3);
      expect(ast!.jobs[0].steps[0].kind).toBe("uses");
      expect(ast!.jobs[0].steps[1].kind).toBe("guard_js_step");
      expect(ast!.jobs[0].steps[2].kind).toBe("run");
    });

    it("preserves guard_js step span", () => {
      const source = `workflow test {
  on: push
  job guard {
    steps: [
      step "decide" guard_js """
        return context.event.action === 'opened';
      """
    ]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const step = ast!.jobs[0].steps[0] as GuardJsStepNode;
      expect(step.span.start).toBeGreaterThan(0);
      expect(step.span.end).toBeGreaterThan(step.span.start);
    });
  });

  describe("matrix job parsing", () => {
    it("parses basic matrix job declaration", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20, 22]
    }
    runs_on: ubuntu-latest
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.jobs).toHaveLength(1);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.name).toBe("test");
      expect(job.axes).toEqual({ node: [18, 20, 22] });
      expect(job.runsOn).toBe("ubuntu-latest");
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
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.axes).toEqual({
        node: [18, 20, 22],
        os: ["ubuntu-latest", "macos-latest"],
      });
    });

    it("parses matrix job with string axis values", () => {
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
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.axes).toEqual({ env: ["dev", "staging", "prod"] });
    });

    it("parses matrix job with max_parallel property", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    max_parallel = 4
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.maxParallel).toBe(4);
    });

    it("parses matrix job with fail_fast = true", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    fail_fast = true
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.failFast).toBe(true);
    });

    it("parses matrix job with fail_fast = false", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    fail_fast = false
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.failFast).toBe(false);
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
    fail_fast = true
    runs_on: ubuntu-latest
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.name).toBe("test");
      expect(job.axes).toEqual({
        node: [18, 20, 22],
        os: ["ubuntu-latest", "macos-latest"],
      });
      expect(job.maxParallel).toBe(4);
      expect(job.failFast).toBe(true);
      expect(job.runsOn).toBe("ubuntu-latest");
      expect(job.steps).toHaveLength(1);
    });

    it("parses regular job without matrix modifier", () => {
      const source = `workflow test {
  on: push
  job test {
    runs_on: ubuntu-latest
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as JobNode;
      expect(job.kind).toBe("job");
      expect(job.name).toBe("test");
    });

    it("parses matrix job with needs dependency", () => {
      const source = `workflow test {
  on: push
  job setup {
    steps: []
  }
  job test matrix {
    axes {
      node: [18, 20]
    }
    needs: setup
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast!.jobs).toHaveLength(2);

      const setupJob = ast!.jobs[0] as JobNode;
      expect(setupJob.kind).toBe("job");
      expect(setupJob.name).toBe("setup");

      const matrixJob = ast!.jobs[1] as import("../ast/index.js").MatrixJobNode;
      expect(matrixJob.kind).toBe("matrix_job");
      expect(matrixJob.name).toBe("test");
      expect(matrixJob.needs).toEqual(["setup"]);
    });

    it("preserves matrix job span", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      node: [18, 20]
    }
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.span.start).toBeGreaterThan(0);
      expect(job.span.end).toBeGreaterThan(job.span.start);
    });

    it("parses matrix job with mixed axis value types", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      version: [18, 20, 22]
      environment: ["dev", "prod"]
      runner: [ubuntu-latest]
    }
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.axes.version).toEqual([18, 20, 22]);
      expect(job.axes.environment).toEqual(["dev", "prod"]);
      expect(job.axes.runner).toEqual(["ubuntu-latest"]);
    });

    it("parses matrix job with include clause", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest, macos-latest]
      node: [18, 20]
    }
    include [
      { os: ubuntu-latest, node: 22, experimental: true }
    ]
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.include).toBeDefined();
      expect(job.include).toHaveLength(1);
      expect(job.include![0]).toEqual({
        os: "ubuntu-latest",
        node: 22,
        experimental: true,
      });
    });

    it("parses matrix job with exclude clause", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest, macos-latest]
      node: [18, 20]
    }
    exclude [
      { os: macos-latest, node: 18 }
    ]
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.exclude).toBeDefined();
      expect(job.exclude).toHaveLength(1);
      expect(job.exclude![0]).toEqual({
        os: "macos-latest",
        node: 18,
      });
    });

    it("parses matrix job with both include and exclude", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest, macos-latest]
      node: [18, 20]
    }
    include [
      { os: ubuntu-latest, node: 22, experimental: true }
    ]
    exclude [
      { os: macos-latest, node: 18 }
    ]
    runs_on: matrix.os
    steps: [run("npm test")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.kind).toBe("matrix_job");
      expect(job.axes).toEqual({
        os: ["ubuntu-latest", "macos-latest"],
        node: [18, 20],
      });
      expect(job.include).toHaveLength(1);
      expect(job.include![0]).toEqual({
        os: "ubuntu-latest",
        node: 22,
        experimental: true,
      });
      expect(job.exclude).toHaveLength(1);
      expect(job.exclude![0]).toEqual({
        os: "macos-latest",
        node: 18,
      });
    });

    it("parses matrix job with multiple include combinations", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest]
    }
    include [
      { os: ubuntu-latest, node: 18 },
      { os: ubuntu-latest, node: 20 },
      { os: windows-latest, node: 20 }
    ]
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.include).toHaveLength(3);
      expect(job.include![0]).toEqual({ os: "ubuntu-latest", node: 18 });
      expect(job.include![1]).toEqual({ os: "ubuntu-latest", node: 20 });
      expect(job.include![2]).toEqual({ os: "windows-latest", node: 20 });
    });

    it("parses matrix job with string values in include", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest]
    }
    include [
      { os: "ubuntu-20.04", name: "legacy" }
    ]
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.include).toHaveLength(1);
      expect(job.include![0]).toEqual({
        os: "ubuntu-20.04",
        name: "legacy",
      });
    });

    it("parses matrix job with boolean false in include", () => {
      const source = `workflow test {
  on: push
  job test matrix {
    axes {
      os: [ubuntu-latest]
    }
    include [
      { os: ubuntu-latest, experimental: false }
    ]
    steps: []
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      const job = ast!.jobs[0] as import("../ast/index.js").MatrixJobNode;
      expect(job.include).toHaveLength(1);
      expect(job.include![0].experimental).toBe(false);
    });
  });

  describe("type declaration parsing", () => {
    it("parses simple type declaration", () => {
      const source = `type BuildInfo {
  version: string
  commit: string
}

workflow test {
  on: push
  job build {
    steps: []
  }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst).not.toBeNull();
      expect(fileAst!.kind).toBe("file");
      expect(fileAst!.types).toHaveLength(1);
      expect(fileAst!.workflows).toHaveLength(1);

      const typeDecl = fileAst!.types[0] as TypeDeclarationNode;
      expect(typeDecl.kind).toBe("type_declaration");
      expect(typeDecl.name).toBe("BuildInfo");
      expect(typeDecl.fields).toHaveLength(2);
      expect(typeDecl.fields[0].name).toBe("version");
      expect(typeDecl.fields[1].name).toBe("commit");
    });

    it("parses type with multiple fields and various primitive types", () => {
      const source = `type Config {
  name: string
  count: int
  score: float
  enabled: bool
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.fields).toHaveLength(4);

      expect(typeDecl.fields[0].name).toBe("name");
      expect((typeDecl.fields[0].type as PrimitiveTypeNode).kind).toBe("primitive_type");
      expect((typeDecl.fields[0].type as PrimitiveTypeNode).type).toBe("string");

      expect(typeDecl.fields[1].name).toBe("count");
      expect((typeDecl.fields[1].type as PrimitiveTypeNode).type).toBe("int");

      expect(typeDecl.fields[2].name).toBe("score");
      expect((typeDecl.fields[2].type as PrimitiveTypeNode).type).toBe("float");

      expect(typeDecl.fields[3].name).toBe("enabled");
      expect((typeDecl.fields[3].type as PrimitiveTypeNode).type).toBe("bool");
    });

    it("parses type with nested object field", () => {
      const source = `type User {
  name: string
  address: {
    street: string
    city: string
    zip: int
  }
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.fields).toHaveLength(2);

      const addressField = typeDecl.fields[1];
      expect(addressField.name).toBe("address");
      expect((addressField.type as ObjectTypeNode).kind).toBe("object_type");

      const nestedObject = addressField.type as ObjectTypeNode;
      expect(nestedObject.fields).toHaveLength(3);
      expect(nestedObject.fields[0].name).toBe("street");
      expect(nestedObject.fields[1].name).toBe("city");
      expect(nestedObject.fields[2].name).toBe("zip");
    });

    it("parses type with array field", () => {
      const source = `type Project {
  name: string
  tags: [string]
  scores: [int]
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.fields).toHaveLength(3);

      const tagsField = typeDecl.fields[1];
      expect(tagsField.name).toBe("tags");
      expect((tagsField.type as ArrayTypeNode).kind).toBe("array_type");
      expect(((tagsField.type as ArrayTypeNode).elementType as PrimitiveTypeNode).type).toBe("string");

      const scoresField = typeDecl.fields[2];
      expect((scoresField.type as ArrayTypeNode).kind).toBe("array_type");
      expect(((scoresField.type as ArrayTypeNode).elementType as PrimitiveTypeNode).type).toBe("int");
    });

    it("parses type with union field", () => {
      const source = `type Result {
  value: string | int
  status: "success" | "error"
  optional: string | null
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.fields).toHaveLength(3);

      const valueField = typeDecl.fields[0];
      expect(valueField.name).toBe("value");
      expect((valueField.type as UnionTypeNode).kind).toBe("union_type");
      expect((valueField.type as UnionTypeNode).members).toHaveLength(2);
      expect(((valueField.type as UnionTypeNode).members[0] as PrimitiveTypeNode).type).toBe("string");
      expect(((valueField.type as UnionTypeNode).members[1] as PrimitiveTypeNode).type).toBe("int");

      const statusField = typeDecl.fields[1];
      expect((statusField.type as UnionTypeNode).kind).toBe("union_type");
      expect(((statusField.type as UnionTypeNode).members[0] as StringLiteralTypeNode).kind).toBe("string_literal_type");
      expect(((statusField.type as UnionTypeNode).members[0] as StringLiteralTypeNode).value).toBe("success");
      expect(((statusField.type as UnionTypeNode).members[1] as StringLiteralTypeNode).value).toBe("error");

      const optionalField = typeDecl.fields[2];
      expect(((optionalField.type as UnionTypeNode).members[1] as NullTypeNode).kind).toBe("null_type");
    });

    it("parses type reference in field (non-primitive type name)", () => {
      const source = `type Address {
  street: string
  city: string
}

type User {
  name: string
  address: Address
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.types).toHaveLength(2);

      const userType = fileAst!.types[1];
      expect(userType.name).toBe("User");

      const addressField = userType.fields[1];
      expect(addressField.name).toBe("address");
      expect((addressField.type as TypeReferenceNode).kind).toBe("type_reference");
      expect((addressField.type as TypeReferenceNode).name).toBe("Address");
    });

    it("parses multiple type declarations", () => {
      const source = `type Point {
  x: int
  y: int
}

type Line {
  start: Point
  end: Point
}

type Shape {
  name: string
  points: [Point]
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.types).toHaveLength(3);
      expect(fileAst!.types[0].name).toBe("Point");
      expect(fileAst!.types[1].name).toBe("Line");
      expect(fileAst!.types[2].name).toBe("Shape");
    });

    it("parses type with array of objects", () => {
      const source = `type ReviewResult {
  approved: bool
  comments: [{
    filename: string
    line: int
    message: string
  }]
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      const commentsField = typeDecl.fields[1];
      expect(commentsField.name).toBe("comments");
      expect((commentsField.type as ArrayTypeNode).kind).toBe("array_type");

      const elementType = (commentsField.type as ArrayTypeNode).elementType as ObjectTypeNode;
      expect(elementType.kind).toBe("object_type");
      expect(elementType.fields).toHaveLength(3);
      expect(elementType.fields[0].name).toBe("filename");
      expect(elementType.fields[1].name).toBe("line");
      expect(elementType.fields[2].name).toBe("message");
    });

    it("parses empty file with no types", () => {
      const source = `workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst).not.toBeNull();
      expect(fileAst!.types).toHaveLength(0);
      expect(fileAst!.workflows).toHaveLength(1);
    });

    it("parses file with only types and no workflow", () => {
      const source = `type Config {
  name: string
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst).not.toBeNull();
      expect(fileAst!.types).toHaveLength(1);
      expect(fileAst!.workflows).toHaveLength(0);
    });

    it("preserves type declaration span", () => {
      const source = `type BuildInfo {
  version: string
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.span.start).toBe(0);
      expect(typeDecl.span.end).toBeGreaterThan(typeDecl.span.start);
    });

    it("preserves type field span", () => {
      const source = `type BuildInfo {
  version: string
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const field = fileAst!.types[0].fields[0];
      expect(field.span.start).toBeGreaterThan(0);
      expect(field.span.end).toBeGreaterThan(field.span.start);
    });

    it("buildAST still works (returns first workflow, ignoring types)", () => {
      const source = `type BuildInfo {
  version: string
}

workflow test {
  on: push
  job build {
    runs_on: ubuntu-latest
    steps: [run("echo hello")]
  }
}`;
      const tree = parse(source);
      const ast = buildAST(tree, source);

      expect(ast).not.toBeNull();
      expect(ast!.kind).toBe("workflow");
      expect(ast!.name).toBe("test");
      expect(ast!.jobs).toHaveLength(1);
    });

    it("parses type with complex nested structure", () => {
      const source = `type DeploymentResult {
  success: bool
  environment: "dev" | "staging" | "prod"
  metadata: {
    timestamp: int
    version: string
    author: {
      name: string
      email: string
    }
  }
  artifacts: [{
    name: string
    size: int
    checksum: string | null
  }]
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const typeDecl = fileAst!.types[0];
      expect(typeDecl.name).toBe("DeploymentResult");
      expect(typeDecl.fields).toHaveLength(4);

      const successField = typeDecl.fields[0];
      expect((successField.type as PrimitiveTypeNode).type).toBe("bool");

      const envField = typeDecl.fields[1];
      expect((envField.type as UnionTypeNode).kind).toBe("union_type");
      expect((envField.type as UnionTypeNode).members).toHaveLength(3);

      const metadataField = typeDecl.fields[2];
      expect((metadataField.type as ObjectTypeNode).kind).toBe("object_type");
      const metadataObj = metadataField.type as ObjectTypeNode;
      expect(metadataObj.fields).toHaveLength(3);
      const authorField = metadataObj.fields[2];
      expect((authorField.type as ObjectTypeNode).kind).toBe("object_type");

      const artifactsField = typeDecl.fields[3];
      expect((artifactsField.type as ArrayTypeNode).kind).toBe("array_type");
      const artifactElement = (artifactsField.type as ArrayTypeNode).elementType as ObjectTypeNode;
      expect(artifactElement.fields).toHaveLength(3);
      const checksumField = artifactElement.fields[2];
      expect((checksumField.type as UnionTypeNode).kind).toBe("union_type");
    });

    it("parses multiple workflows in file", () => {
      const source = `type Config {
  name: string
}

workflow ci {
  on: push
  job build { steps: [] }
}

workflow cd {
  on: push
  job deploy { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.types).toHaveLength(1);
      expect(fileAst!.workflows).toHaveLength(2);
      expect(fileAst!.workflows[0].name).toBe("ci");
      expect(fileAst!.workflows[1].name).toBe("cd");
    });
  });

  describe("import declaration parsing", () => {
    it("parses single import declaration", () => {
      const source = `import { Foo } from "./foo.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst).not.toBeNull();
      expect(fileAst!.imports).toHaveLength(1);

      const importDecl = fileAst!.imports[0];
      expect(importDecl.kind).toBe("import_declaration");
      expect(importDecl.path).toBe("./foo.workpipe");
      expect(importDecl.items).toHaveLength(1);
      expect(importDecl.items[0].name).toBe("Foo");
      expect(importDecl.items[0].alias).toBeUndefined();
    });

    it("parses import with multiple items", () => {
      const source = `import { Foo, Bar, Baz } from "./types.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);

      const importDecl = fileAst!.imports[0];
      expect(importDecl.path).toBe("./types.workpipe");
      expect(importDecl.items).toHaveLength(3);
      expect(importDecl.items[0].name).toBe("Foo");
      expect(importDecl.items[1].name).toBe("Bar");
      expect(importDecl.items[2].name).toBe("Baz");
    });

    it("parses import with alias", () => {
      const source = `import { Foo as F } from "./foo.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);

      const importDecl = fileAst!.imports[0];
      expect(importDecl.items).toHaveLength(1);
      expect(importDecl.items[0].name).toBe("Foo");
      expect(importDecl.items[0].alias).toBe("F");
    });

    it("parses import with multiple aliased items", () => {
      const source = `import { Foo as F, Bar as B } from "./types.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);

      const importDecl = fileAst!.imports[0];
      expect(importDecl.items).toHaveLength(2);
      expect(importDecl.items[0].name).toBe("Foo");
      expect(importDecl.items[0].alias).toBe("F");
      expect(importDecl.items[1].name).toBe("Bar");
      expect(importDecl.items[1].alias).toBe("B");
    });

    it("parses import with trailing comma", () => {
      const source = `import { Foo, } from "./foo.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);
      expect(fileAst!.imports[0].items).toHaveLength(1);
      expect(fileAst!.imports[0].items[0].name).toBe("Foo");
    });

    it("parses multiple import statements", () => {
      const source = `import { BuildInfo } from "./types.workpipe"
import { ReviewResult as CodeReview } from "../shared/review.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(2);

      expect(fileAst!.imports[0].path).toBe("./types.workpipe");
      expect(fileAst!.imports[0].items[0].name).toBe("BuildInfo");

      expect(fileAst!.imports[1].path).toBe("../shared/review.workpipe");
      expect(fileAst!.imports[1].items[0].name).toBe("ReviewResult");
      expect(fileAst!.imports[1].items[0].alias).toBe("CodeReview");
    });

    it("parses file with imports, types, and workflows", () => {
      const source = `import { BuildInfo, DeployResult } from "./types.workpipe"

type LocalConfig {
  name: string
}

workflow ci {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);
      expect(fileAst!.imports[0].items).toHaveLength(2);
      expect(fileAst!.types).toHaveLength(1);
      expect(fileAst!.types[0].name).toBe("LocalConfig");
      expect(fileAst!.workflows).toHaveLength(1);
      expect(fileAst!.workflows[0].name).toBe("ci");
    });

    it("parses file without imports as empty imports array", () => {
      const source = `type Config {
  name: string
}

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toEqual([]);
      expect(fileAst!.types).toHaveLength(1);
      expect(fileAst!.workflows).toHaveLength(1);
    });

    it("preserves import declaration span", () => {
      const source = `import { Foo } from "./foo.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const importDecl = fileAst!.imports[0];
      expect(importDecl.span.start).toBe(0);
      expect(importDecl.span.end).toBeGreaterThan(importDecl.span.start);
    });

    it("preserves import item span", () => {
      const source = `import { Foo } from "./foo.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      const item = fileAst!.imports[0].items[0];
      expect(item.span.start).toBeGreaterThan(0);
      expect(item.span.end).toBeGreaterThan(item.span.start);
    });

    it("parses complex import with mixed aliased and non-aliased items", () => {
      const source = `import { BuildInfo, DeployResult as Deploy, Config } from "./types.workpipe"

workflow test {
  on: push
  job build { steps: [] }
}`;
      const tree = parse(source);
      const fileAst = buildFileAST(tree, source);

      expect(fileAst!.imports).toHaveLength(1);

      const items = fileAst!.imports[0].items;
      expect(items).toHaveLength(3);
      expect(items[0].name).toBe("BuildInfo");
      expect(items[0].alias).toBeUndefined();
      expect(items[1].name).toBe("DeployResult");
      expect(items[1].alias).toBe("Deploy");
      expect(items[2].name).toBe("Config");
      expect(items[2].alias).toBeUndefined();
    });
  });
});
