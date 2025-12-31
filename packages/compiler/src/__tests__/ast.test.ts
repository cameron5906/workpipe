import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@workpipe/lang";
import { buildAST } from "../ast/index.js";
import type {
  WorkflowNode,
  JobNode,
  AgentJobNode,
  AgentTaskNode,
  RunStepNode,
  UsesStepNode,
  BinaryExpressionNode,
  PropertyAccessNode,
  StringLiteralNode,
  CycleNode,
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
});
