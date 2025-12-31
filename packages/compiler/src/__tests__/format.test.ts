import { describe, it, expect } from "vitest";
import { format } from "../format/index.js";

describe("format", () => {
  describe("basic workflow formatting", () => {
    it("formats a minimal workflow", () => {
      const input = `workflow test{on:push job hello{runs_on:ubuntu-latest steps:[run("echo hello")]}}`;
      const expected = `workflow test {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}
`;
      expect(format(input)).toBe(expected);
    });

    it("preserves workflow name", () => {
      const input = `workflow my_workflow { on: push }`;
      const output = format(input);
      expect(output).toContain("workflow my_workflow {");
    });

    it("ensures trailing newline", () => {
      const input = `workflow test { on: push }`;
      const output = format(input);
      expect(output.endsWith("\n")).toBe(true);
    });
  });

  describe("indentation normalization", () => {
    it("uses 2-space indentation by default", () => {
      const input = `workflow test {
on: push
job hello {
runs_on: ubuntu-latest
steps: []
}
}`;
      const output = format(input);
      expect(output).toContain("  on: push");
      expect(output).toContain("  job hello {");
      expect(output).toContain("    runs_on: ubuntu-latest");
    });

    it("respects custom indent size", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [] } }`;
      const output = format(input, { indentSize: 4 });
      expect(output).toContain("    on: push");
      expect(output).toContain("    job hello {");
      expect(output).toContain("        runs_on: ubuntu-latest");
    });

    it("normalizes inconsistent indentation", () => {
      const input = `workflow test {
   on: push
      job hello {
  runs_on: ubuntu-latest
         steps: []
      }
}`;
      const output = format(input);
      const lines = output.split("\n");
      expect(lines[1]).toBe("  on: push");
      expect(lines[3]).toBe("  job hello {");
      expect(lines[4]).toBe("    runs_on: ubuntu-latest");
    });
  });

  describe("brace placement", () => {
    it("places opening brace on same line as declaration", () => {
      const input = `workflow test
{
on: push
}`;
      const output = format(input);
      expect(output).toContain("workflow test {");
    });

    it("places closing brace on its own line", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [] } }`;
      const output = format(input);
      const lines = output.split("\n").filter((l) => l.trim() === "}");
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe("spacing rules", () => {
    it("adds one space after colons in properties", () => {
      const input = `workflow test{on:push job hello{runs_on:ubuntu-latest steps:[]}}`;
      const output = format(input);
      expect(output).toContain("on: push");
      expect(output).toContain("runs_on: ubuntu-latest");
      expect(output).toContain("steps: [");
    });

    it("adds one space around = in cycle assignments", () => {
      const input = `workflow test { on: push cycle loop { max_iters=5 body { } } }`;
      const output = format(input);
      expect(output).toContain("max_iters = 5");
    });
  });

  describe("blank lines between declarations", () => {
    it("adds blank line between on clause and first job", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [] } }`;
      const output = format(input);
      expect(output).toContain("on: push\n\n  job");
    });

    it("adds blank line between multiple jobs", () => {
      const input = `workflow test {
  on: push
  job first { runs_on: ubuntu-latest steps: [] }
  job second { runs_on: ubuntu-latest steps: [] }
}`;
      const output = format(input);
      expect(output).toMatch(/}\n\n\s+job second/);
    });

    it("adds blank line between jobs and cycles", () => {
      const input = `workflow test {
  on: push
  job first { runs_on: ubuntu-latest steps: [] }
  cycle loop { max_iters = 5 body { } }
}`;
      const output = format(input);
      expect(output).toMatch(/}\n\n\s+cycle/);
    });
  });

  describe("triple-quoted string preservation", () => {
    it("preserves triple-quoted string content exactly", () => {
      const input = `workflow test {
  on: push
  cycle loop {
    until guard_js """
      return context.score > 0.95;
    """
    body { }
  }
}`;
      const output = format(input);
      expect(output).toContain('"""');
      expect(output).toContain("return context.score > 0.95;");
    });

    it("preserves multiline content in triple-quoted strings", () => {
      const guardCode = `"""
      const a = 1;
      const b = 2;
      return a + b > 2;
    """`;
      const input = `workflow test { on: push cycle loop { until guard_js ${guardCode} body { } } }`;
      const output = format(input);
      expect(output).toContain("const a = 1;");
      expect(output).toContain("const b = 2;");
    });
  });

  describe("string preservation", () => {
    it("preserves string content exactly", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [run("echo Hello, World!")] } }`;
      const output = format(input);
      expect(output).toContain('"echo Hello, World!"');
    });

    it("preserves escaped characters in strings", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [run("echo \\"quoted\\"")] } }`;
      const output = format(input);
      expect(output).toContain('\\"quoted\\"');
    });
  });

  describe("event list formatting", () => {
    it("formats single event", () => {
      const input = `workflow test { on: push }`;
      const output = format(input);
      expect(output).toContain("on: push");
    });

    it("formats event list", () => {
      const input = `workflow test { on: [push,pull_request] }`;
      const output = format(input);
      expect(output).toContain("on: [push, pull_request]");
    });
  });

  describe("step list formatting", () => {
    it("formats empty step list", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [] } }`;
      const output = format(input);
      expect(output).toContain("steps: []");
    });

    it("formats single step on multiple lines", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [run("echo test")] } }`;
      const output = format(input);
      expect(output).toContain("steps: [\n");
      expect(output).toContain('run("echo test")');
    });

    it("formats multiple steps with commas", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [run("first"),run("second")] } }`;
      const output = format(input);
      expect(output).toContain('run("first"),');
      expect(output).toContain('run("second")');
    });

    it("formats uses steps", () => {
      const input = `workflow test { on: push job hello { runs_on: ubuntu-latest steps: [uses("actions/checkout@v4")] } }`;
      const output = format(input);
      expect(output).toContain('uses("actions/checkout@v4")');
    });
  });

  describe("agent job formatting", () => {
    it("formats basic agent_job", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [] } }`;
      const output = format(input);
      expect(output).toContain("agent_job analyze {");
    });

    it("formats agent_job with after clause", () => {
      const input = `workflow test { on: push job build { steps: [] } agent_job analyze after build { steps: [] } }`;
      const output = format(input);
      expect(output).toContain("agent_job analyze after build {");
    });
  });

  describe("agent task formatting", () => {
    it("formats basic agent_task", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Do something") { model: "claude-sonnet-4-20250514" }] } }`;
      const output = format(input);
      expect(output).toContain('agent_task("Do something") {');
      expect(output).toContain('model: "claude-sonnet-4-20250514"');
    });

    it("formats agent_task with max_turns", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" max_turns: 10 }] } }`;
      const output = format(input);
      expect(output).toContain("max_turns: 10");
    });

    it("formats agent_task with tools block", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" tools: { allowed: * strict: true } }] } }`;
      const output = format(input);
      expect(output).toContain("tools: {");
      expect(output).toContain("allowed: *");
      expect(output).toContain("strict: true");
    });

    it("formats agent_task with tools allowed list", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" tools: { allowed: ["read", "write"] } }] } }`;
      const output = format(input);
      expect(output).toContain('allowed: ["read", "write"]');
    });

    it("formats agent_task with prompt file reference", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" prompt: file("prompts/task.md") }] } }`;
      const output = format(input);
      expect(output).toContain('prompt: file("prompts/task.md")');
    });

    it("formats agent_task with template reference", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" prompt: template("code_review") }] } }`;
      const output = format(input);
      expect(output).toContain('prompt: template("code_review")');
    });

    it("formats agent_task with consumes block", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" consumes: { result: from("build.output") } }] } }`;
      const output = format(input);
      expect(output).toContain("consumes: {");
      expect(output).toContain('result: from("build.output")');
    });
  });

  describe("cycle formatting", () => {
    it("formats basic cycle", () => {
      const input = `workflow test { on: push cycle loop { max_iters = 5 body { } } }`;
      const output = format(input);
      expect(output).toContain("cycle loop {");
      expect(output).toContain("max_iters = 5");
      expect(output).toContain("body {");
    });

    it("formats cycle with key property", () => {
      const input = `workflow test { on: push cycle loop { max_iters = 5 key = "iteration" body { } } }`;
      const output = format(input);
      expect(output).toContain('key = "iteration"');
    });

    it("formats cycle with until guard_js", () => {
      const input = `workflow test { on: push cycle loop { until guard_js """return true;""" body { } } }`;
      const output = format(input);
      expect(output).toContain("until guard_js");
      expect(output).toContain('"""');
    });

    it("formats cycle body with jobs", () => {
      const input = `workflow test { on: push cycle loop { max_iters = 3 body { job first { runs_on: ubuntu-latest steps: [] } job second { runs_on: ubuntu-latest steps: [] } } } }`;
      const output = format(input);
      expect(output).toContain("body {");
      expect(output).toContain("job first {");
      expect(output).toContain("job second {");
    });
  });

  describe("needs property formatting", () => {
    it("formats single needs dependency", () => {
      const input = `workflow test { on: push job build { runs_on: ubuntu-latest steps: [] } job deploy { runs_on: ubuntu-latest needs: build steps: [] } }`;
      const output = format(input);
      expect(output).toContain("needs: build");
    });

    it("formats multiple needs dependencies", () => {
      const input = `workflow test { on: push job a { steps: [] } job b { steps: [] } job c { needs: [a, b] steps: [] } }`;
      const output = format(input);
      expect(output).toContain("needs: [a, b]");
    });
  });

  describe("if property formatting", () => {
    it("formats if condition", () => {
      const input = `workflow test { on: push job deploy { runs_on: ubuntu-latest if: github.ref == "refs/heads/main" steps: [] } }`;
      const output = format(input);
      expect(output).toContain('if: github.ref == "refs/heads/main"');
    });
  });

  describe("mcp block formatting", () => {
    it("formats mcp block with config_file", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" mcp: { config_file: ".mcp/config.json" } }] } }`;
      const output = format(input);
      expect(output).toContain("mcp: {");
      expect(output).toContain('config_file: ".mcp/config.json"');
    });

    it("formats mcp block with allowed list", () => {
      const input = `workflow test { on: push agent_job analyze { steps: [agent_task("Task") { model: "claude-sonnet-4-20250514" mcp: { allowed: ["github", "slack"] } }] } }`;
      const output = format(input);
      expect(output).toContain('allowed: ["github", "slack"]');
    });
  });

  describe("idempotency", () => {
    it("formatting twice produces same result", () => {
      const input = `workflow test{on:push job hello{runs_on:ubuntu-latest steps:[run("test")]}}`;
      const firstFormat = format(input);
      const secondFormat = format(firstFormat);
      expect(secondFormat).toBe(firstFormat);
    });

    it("already formatted code stays the same", () => {
      const formatted = `workflow test {
  on: push

  job hello {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}
`;
      expect(format(formatted)).toBe(formatted);
    });
  });

  describe("complex workflows", () => {
    it("formats a complete workflow with multiple features", () => {
      const input = `workflow complex {
on: [push, pull_request]
job build {
runs_on: ubuntu-latest
steps: [
uses("actions/checkout@v4"),
run("npm install"),
run("npm build")
]
}
agent_job analyze after build {
steps: [
agent_task("Review code") {
model: "claude-sonnet-4-20250514"
max_turns: 10
tools: {
allowed: ["read_file"]
strict: true
}
prompt: "Review the code changes"
}
]
}
cycle refine_loop {
max_iters = 5
key = "iteration"
until guard_js """
return context.score > 0.9;
"""
body {
agent_job improve {
steps: []
}
}
}
}`;
      const output = format(input);

      expect(output).toContain("workflow complex {");
      expect(output).toContain("on: [push, pull_request]");
      expect(output).toContain("job build {");
      expect(output).toContain("agent_job analyze after build {");
      expect(output).toContain("cycle refine_loop {");
      expect(output).toContain("max_iters = 5");
      expect(output).toContain('key = "iteration"');
      expect(output).toContain("until guard_js");
      expect(output).toContain("body {");
    });
  });
});
