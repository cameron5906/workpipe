/**
 * Tests for the Fragment System Phase 2 (Same-file Resolution) and Phase 3 (Cross-file Imports).
 *
 * Tests cover:
 * - Fragment registry operations
 * - Job fragment expansion
 * - Steps fragment expansion
 * - Parameter substitution
 * - Error diagnostics (WP9001, WP9002, WP9005)
 * - Cross-file fragment imports
 */

import { describe, it, expect } from "vitest";
import {
  createFragmentRegistry,
  buildFragmentRegistry,
  createFragmentNotFoundDiagnostic,
  createMissingParamDiagnostic,
  createUnknownParamDiagnostic,
  FRAGMENT_DIAGNOSTICS,
  type FragmentRegistry,
} from "../semantics/fragment-registry.js";
import { substituteParams } from "../codegen/transform.js";
import { compile, compileWithImports, createImportContext } from "../compile.js";
import { createMemoryFileResolver } from "../imports/file-resolver.js";
import type {
  JobFragmentNode,
  StepsFragmentNode,
  WorkPipeFileNode,
  Span,
} from "../ast/types.js";

const defaultSpan: Span = { start: 0, end: 10 };

function makeJobFragment(
  name: string,
  steps: JobFragmentNode["steps"] = [],
  params: JobFragmentNode["params"] = []
): JobFragmentNode {
  return {
    kind: "job_fragment",
    name,
    params,
    runsOn: "ubuntu-latest",
    needs: [],
    condition: null,
    outputs: [],
    steps,
    span: defaultSpan,
  };
}

function makeStepsFragment(
  name: string,
  steps: StepsFragmentNode["steps"] = [],
  params: StepsFragmentNode["params"] = []
): StepsFragmentNode {
  return {
    kind: "steps_fragment",
    name,
    params,
    steps,
    span: defaultSpan,
  };
}

describe("FragmentRegistry", () => {
  describe("createFragmentRegistry", () => {
    it("creates an empty registry", () => {
      const registry = createFragmentRegistry();
      expect(registry.getJobFragmentNames()).toEqual([]);
      expect(registry.getStepsFragmentNames()).toEqual([]);
    });
  });

  describe("registerJobFragment", () => {
    it("registers a job fragment successfully", () => {
      const registry = createFragmentRegistry();
      const fragment = makeJobFragment("test_fragment");

      const error = registry.registerJobFragment(fragment);

      expect(error).toBeNull();
      expect(registry.hasJobFragment("test_fragment")).toBe(true);
      expect(registry.getJobFragment("test_fragment")).toBe(fragment);
    });

    it("returns error for duplicate job fragment name (WP9005)", () => {
      const registry = createFragmentRegistry();
      const fragment1 = makeJobFragment("test_fragment");
      const fragment2 = makeJobFragment("test_fragment");

      registry.registerJobFragment(fragment1);
      const error = registry.registerJobFragment(fragment2);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("WP9005");
      expect(error?.message).toContain("Duplicate job fragment name");
    });

    it("returns error when job fragment name conflicts with steps fragment (WP9005)", () => {
      const registry = createFragmentRegistry();
      const stepsFragment = makeStepsFragment("shared_name");
      const jobFragment = makeJobFragment("shared_name");

      registry.registerStepsFragment(stepsFragment);
      const error = registry.registerJobFragment(jobFragment);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("WP9005");
      expect(error?.message).toContain("conflicts with an existing steps fragment");
    });
  });

  describe("registerStepsFragment", () => {
    it("registers a steps fragment successfully", () => {
      const registry = createFragmentRegistry();
      const fragment = makeStepsFragment("test_steps");

      const error = registry.registerStepsFragment(fragment);

      expect(error).toBeNull();
      expect(registry.hasStepsFragment("test_steps")).toBe(true);
      expect(registry.getStepsFragment("test_steps")).toBe(fragment);
    });

    it("returns error for duplicate steps fragment name (WP9005)", () => {
      const registry = createFragmentRegistry();
      const fragment1 = makeStepsFragment("test_steps");
      const fragment2 = makeStepsFragment("test_steps");

      registry.registerStepsFragment(fragment1);
      const error = registry.registerStepsFragment(fragment2);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("WP9005");
      expect(error?.message).toContain("Duplicate steps fragment name");
    });

    it("returns error when steps fragment name conflicts with job fragment (WP9005)", () => {
      const registry = createFragmentRegistry();
      const jobFragment = makeJobFragment("shared_name");
      const stepsFragment = makeStepsFragment("shared_name");

      registry.registerJobFragment(jobFragment);
      const error = registry.registerStepsFragment(stepsFragment);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("WP9005");
      expect(error?.message).toContain("conflicts with an existing job fragment");
    });
  });

  describe("getJobFragment", () => {
    it("returns undefined for non-existent fragment", () => {
      const registry = createFragmentRegistry();
      expect(registry.getJobFragment("nonexistent")).toBeUndefined();
    });
  });

  describe("getStepsFragment", () => {
    it("returns undefined for non-existent fragment", () => {
      const registry = createFragmentRegistry();
      expect(registry.getStepsFragment("nonexistent")).toBeUndefined();
    });
  });

  describe("getJobFragmentNames", () => {
    it("returns all registered job fragment names", () => {
      const registry = createFragmentRegistry();
      registry.registerJobFragment(makeJobFragment("alpha"));
      registry.registerJobFragment(makeJobFragment("beta"));
      registry.registerJobFragment(makeJobFragment("gamma"));

      const names = registry.getJobFragmentNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("alpha");
      expect(names).toContain("beta");
      expect(names).toContain("gamma");
    });
  });

  describe("getStepsFragmentNames", () => {
    it("returns all registered steps fragment names", () => {
      const registry = createFragmentRegistry();
      registry.registerStepsFragment(makeStepsFragment("step1"));
      registry.registerStepsFragment(makeStepsFragment("step2"));

      const names = registry.getStepsFragmentNames();
      expect(names).toHaveLength(2);
      expect(names).toContain("step1");
      expect(names).toContain("step2");
    });
  });
});

describe("buildFragmentRegistry", () => {
  it("builds registry from file AST with job and steps fragments", () => {
    const fileAST: WorkPipeFileNode = {
      kind: "file",
      imports: [],
      types: [],
      jobFragments: [makeJobFragment("job1"), makeJobFragment("job2")],
      stepsFragments: [makeStepsFragment("steps1")],
      workflows: [],
      span: defaultSpan,
    };

    const { registry, diagnostics } = buildFragmentRegistry(fileAST);

    expect(diagnostics).toHaveLength(0);
    expect(registry.hasJobFragment("job1")).toBe(true);
    expect(registry.hasJobFragment("job2")).toBe(true);
    expect(registry.hasStepsFragment("steps1")).toBe(true);
  });

  it("collects diagnostics for duplicate fragments", () => {
    const fileAST: WorkPipeFileNode = {
      kind: "file",
      imports: [],
      types: [],
      jobFragments: [makeJobFragment("dupe"), makeJobFragment("dupe")],
      stepsFragments: [],
      workflows: [],
      span: defaultSpan,
    };

    const { diagnostics } = buildFragmentRegistry(fileAST);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("WP9005");
  });
});

describe("Fragment diagnostic helpers", () => {
  describe("createFragmentNotFoundDiagnostic", () => {
    it("creates WP9001 diagnostic for job fragment", () => {
      const diag = createFragmentNotFoundDiagnostic(
        "missing_fragment",
        defaultSpan,
        "job",
        ["existing1", "existing2"]
      );

      expect(diag.code).toBe("WP9001");
      expect(diag.message).toContain("Job fragment 'missing_fragment' not found");
      expect(diag.hint).toContain("existing1");
    });

    it("creates WP9001 diagnostic for steps fragment", () => {
      const diag = createFragmentNotFoundDiagnostic(
        "missing_steps",
        defaultSpan,
        "steps",
        []
      );

      expect(diag.code).toBe("WP9001");
      expect(diag.message).toContain("Steps fragment 'missing_steps' not found");
      expect(diag.hint).toContain("No steps fragments are defined");
    });
  });

  describe("createMissingParamDiagnostic", () => {
    it("creates WP9002 diagnostic", () => {
      const diag = createMissingParamDiagnostic(
        "my_fragment",
        "required_param",
        defaultSpan
      );

      expect(diag.code).toBe("WP9002");
      expect(diag.message).toContain("Missing required parameter 'required_param'");
      expect(diag.hint).toContain("required_param = <value>");
    });
  });

  describe("createUnknownParamDiagnostic", () => {
    it("creates WP9003 diagnostic with available params", () => {
      const diag = createUnknownParamDiagnostic(
        "my_fragment",
        "unknown_param",
        defaultSpan,
        ["param1", "param2"]
      );

      expect(diag.code).toBe("WP9003");
      expect(diag.message).toContain("Unknown parameter 'unknown_param'");
      expect(diag.hint).toContain("param1");
    });
  });
});

describe("substituteParams", () => {
  it("substitutes simple parameter references", () => {
    const args = new Map([["name", "world"]]);
    const result = substituteParams("Hello ${{ params.name }}!", args);
    expect(result).toBe("Hello world!");
  });

  it("substitutes multiple parameter references", () => {
    const args = new Map([
      ["greeting", "Hello"],
      ["target", "world"],
    ]);
    const result = substituteParams("${{ params.greeting }} ${{ params.target }}!", args);
    expect(result).toBe("Hello world!");
  });

  it("leaves unmatched parameters untouched", () => {
    const args = new Map([["known", "value"]]);
    const result = substituteParams("${{ params.known }} and ${{ params.unknown }}", args);
    expect(result).toBe("value and ${{ params.unknown }}");
  });

  it("handles whitespace variations in parameter references", () => {
    const args = new Map([["name", "test"]]);
    expect(substituteParams("${{params.name}}", args)).toBe("test");
    expect(substituteParams("${{  params.name  }}", args)).toBe("test");
    expect(substituteParams("${{ params.name }}", args)).toBe("test");
  });

  it("handles empty args map", () => {
    const args = new Map<string, string>();
    const result = substituteParams("No ${{ params.subs }} here", args);
    expect(result).toBe("No ${{ params.subs }} here");
  });

  it("handles strings with no parameter references", () => {
    const args = new Map([["name", "value"]]);
    const result = substituteParams("No params here", args);
    expect(result).toBe("No params here");
  });
});

describe("Fragment expansion in compilation", () => {
  describe("Job fragment instantiation", () => {
    it("expands a simple job fragment without parameters", () => {
      const source = `
job_fragment checkout_job {
  runs_on: ubuntu-latest
  steps {
    shell { echo hello }
  }
}

workflow test {
  on: push

  job build = checkout_job {}
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("build:");
        expect(result.value).toContain("echo hello");
      }
    });

    it("expands a job fragment with parameters", () => {
      const source = `
job_fragment greet_job {
  params {
    message: string
  }
  runs_on: ubuntu-latest
  steps {
    shell { echo \${{ params.message }} }
  }
}

workflow test {
  on: push

  job greet = greet_job {
    message: "hello world"
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("greet:");
        expect(result.value).toContain("echo hello world");
      }
    });

    it("handles job fragment with default parameter values", () => {
      const source = `
job_fragment greet_job {
  params {
    message: string = "default greeting"
  }
  runs_on: ubuntu-latest
  steps {
    shell { echo \${{ params.message }} }
  }
}

workflow test {
  on: push

  job greet = greet_job {}
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("echo default greeting");
      }
    });
  });

  describe("Steps fragment spread", () => {
    it("expands a simple steps fragment", () => {
      const source = `
steps_fragment setup_steps {
  shell { npm install }
  shell { npm run build }
}

workflow test {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      ...setup_steps {}
      shell { npm test }
    }
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("npm install");
        expect(result.value).toContain("npm run build");
        expect(result.value).toContain("npm test");
      }
    });

    it("expands a steps fragment with parameters", () => {
      const source = `
steps_fragment npm_cmd {
  params {
    cmd: string
  }
  shell { npm run \${{ params.cmd }} }
}

workflow test {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      ...npm_cmd { cmd: "lint" }
      ...npm_cmd { cmd: "test" }
    }
  }
}
`;
      const result = compile(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain("npm run lint");
        expect(result.value).toContain("npm run test");
      }
    });
  });

  describe("Error handling", () => {
    it("reports error for duplicate fragment names (WP9005)", () => {
      const source = `
job_fragment my_fragment {
  runs_on: ubuntu-latest
  steps {
    shell { echo first }
  }
}

job_fragment my_fragment {
  runs_on: ubuntu-latest
  steps {
    shell { echo second }
  }
}

workflow test {
  on: push

  job build = my_fragment {}
}
`;
      const result = compile(source);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some((d) => d.code === "WP9005")).toBe(true);
    });
  });
});

describe("FragmentRegistry importFragments", () => {
  it("imports a job fragment from another registry", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();
    const fragment = makeJobFragment("shared_job");

    sourceRegistry.registerJobFragment(fragment);

    const diagnostics = targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "shared_job" }],
      "./fragments.workpipe"
    );

    expect(diagnostics).toHaveLength(0);
    expect(targetRegistry.hasJobFragment("shared_job")).toBe(true);
    expect(targetRegistry.getJobFragment("shared_job")).toBe(fragment);
  });

  it("imports a steps fragment from another registry", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();
    const fragment = makeStepsFragment("shared_steps");

    sourceRegistry.registerStepsFragment(fragment);

    const diagnostics = targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "shared_steps" }],
      "./fragments.workpipe"
    );

    expect(diagnostics).toHaveLength(0);
    expect(targetRegistry.hasStepsFragment("shared_steps")).toBe(true);
    expect(targetRegistry.getStepsFragment("shared_steps")).toBe(fragment);
  });

  it("supports alias when importing fragments", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();
    const fragment = makeJobFragment("original_name");

    sourceRegistry.registerJobFragment(fragment);

    const diagnostics = targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "original_name", alias: "aliased_name" }],
      "./fragments.workpipe"
    );

    expect(diagnostics).toHaveLength(0);
    expect(targetRegistry.hasJobFragment("aliased_name")).toBe(true);
    expect(targetRegistry.hasJobFragment("original_name")).toBe(false);
  });

  it("tracks provenance of imported fragments", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();
    const fragment = makeJobFragment("tracked_fragment");

    sourceRegistry.registerJobFragment(fragment);
    targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "tracked_fragment" }],
      "./source.workpipe"
    );

    expect(targetRegistry.getFragmentProvenance("tracked_fragment")).toBe("./source.workpipe");
    expect(targetRegistry.isExportable("tracked_fragment")).toBe(false);
  });

  it("marks locally defined fragments as exportable", () => {
    const registry = createFragmentRegistry();
    const fragment = makeJobFragment("local_fragment");

    registry.registerJobFragment(fragment);

    expect(registry.isExportable("local_fragment")).toBe(true);
    expect(registry.getFragmentProvenance("local_fragment")).toBeUndefined();
  });

  it("returns error for name collision (WP7005)", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();
    sourceRegistry.registerJobFragment(makeJobFragment("duplicate"));
    targetRegistry.registerJobFragment(makeJobFragment("duplicate"));

    const diagnostics = targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "duplicate" }],
      "./source.workpipe"
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("WP7005");
    expect(diagnostics[0].message).toContain("Name collision");
  });

  it("returns error when importing non-exportable fragment (WP7003)", () => {
    const originalRegistry = createFragmentRegistry();
    const intermediateRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();

    originalRegistry.registerJobFragment(makeJobFragment("nested_fragment"));
    intermediateRegistry.importFragments(
      originalRegistry,
      [{ name: "nested_fragment" }],
      "./original.workpipe"
    );

    const diagnostics = targetRegistry.importFragments(
      intermediateRegistry,
      [{ name: "nested_fragment" }],
      "./intermediate.workpipe"
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe("WP7003");
    expect(diagnostics[0].message).toContain("not exportable");
  });

  it("silently ignores imports that do not exist in source registry", () => {
    const sourceRegistry = createFragmentRegistry();
    const targetRegistry = createFragmentRegistry();

    const diagnostics = targetRegistry.importFragments(
      sourceRegistry,
      [{ name: "nonexistent" }],
      "./source.workpipe"
    );

    expect(diagnostics).toHaveLength(0);
    expect(targetRegistry.hasJobFragment("nonexistent")).toBe(false);
    expect(targetRegistry.hasStepsFragment("nonexistent")).toBe(false);
  });
});

describe("Cross-file fragment imports (compileWithImports)", () => {
  it("imports job_fragment from another file and uses it", async () => {
    const files: Record<string, string> = {
      "/project/fragments.workpipe": `
job_fragment checkout_job {
  runs_on: ubuntu-latest
  steps {
    shell { git checkout }
  }
}
`,
      "/project/main.workpipe": `
import { checkout_job } from "./fragments.workpipe"

workflow build {
  on: push

  job checkout = checkout_job {}
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("checkout:");
      expect(result.value).toContain("git checkout");
    }
  });

  it("imports steps_fragment from another file and uses it", async () => {
    const files: Record<string, string> = {
      "/project/fragments.workpipe": `
steps_fragment setup_steps {
  shell { npm install }
  shell { npm run build }
}
`,
      "/project/main.workpipe": `
import { setup_steps } from "./fragments.workpipe"

workflow build {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps {
      ...setup_steps {}
      shell { npm test }
    }
  }
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("npm install");
      expect(result.value).toContain("npm run build");
      expect(result.value).toContain("npm test");
    }
  });

  it("imports fragment with parameters from another file", async () => {
    const files: Record<string, string> = {
      "/project/fragments.workpipe": `
job_fragment greet_job {
  params {
    message: string
  }
  runs_on: ubuntu-latest
  steps {
    shell { echo \${{ params.message }} }
  }
}
`,
      "/project/main.workpipe": `
import { greet_job } from "./fragments.workpipe"

workflow build {
  on: push

  job greet = greet_job {
    message: "hello from import"
  }
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("greet:");
      expect(result.value).toContain("echo hello from import");
    }
  });

  it("imports both types and fragments from the same file", async () => {
    const files: Record<string, string> = {
      "/project/shared.workpipe": `
type BuildInfo {
  version: string
}

job_fragment build_job {
  runs_on: ubuntu-latest
  steps {
    shell { npm run build }
  }
}
`,
      "/project/main.workpipe": `
import { BuildInfo, build_job } from "./shared.workpipe"

workflow build {
  on: push

  job build = build_job {}
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("build:");
      expect(result.value).toContain("npm run build");
    }
  });

  it("reports error when imported fragment conflicts with local fragment (WP7005)", async () => {
    const files: Record<string, string> = {
      "/project/fragments.workpipe": `
job_fragment my_job {
  runs_on: ubuntu-latest
  steps {
    shell { echo from import }
  }
}
`,
      "/project/main.workpipe": `
import { my_job } from "./fragments.workpipe"

job_fragment my_job {
  runs_on: ubuntu-latest
  steps {
    shell { echo local }
  }
}

workflow build {
  on: push

  job build = my_job {}
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(false);
    const collisionError = result.diagnostics.find((d) => d.code === "WP7005");
    expect(collisionError).toBeDefined();
    expect(collisionError?.message).toContain("Name collision");
  });

  it("imports fragment using alias to avoid collision", async () => {
    const files: Record<string, string> = {
      "/project/fragments.workpipe": `
job_fragment build_job {
  runs_on: ubuntu-latest
  steps {
    shell { echo from import }
  }
}
`,
      "/project/main.workpipe": `
import { build_job as imported_build_job } from "./fragments.workpipe"

job_fragment build_job {
  runs_on: ubuntu-latest
  steps {
    shell { echo local }
  }
}

workflow build {
  on: push

  job imported = imported_build_job {}
  job local = build_job {}
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("imported:");
      expect(result.value).toContain("echo from import");
      expect(result.value).toContain("local:");
      expect(result.value).toContain("echo local");
    }
  });

  it("imports fragment and uses it alongside transitive dependency", async () => {
    const files: Record<string, string> = {
      "/project/base.workpipe": `
steps_fragment base_steps {
  shell { echo base step }
}
`,
      "/project/main.workpipe": `
import { base_steps } from "./base.workpipe"

workflow build {
  on: push

  job test {
    runs_on: ubuntu-latest
    steps {
      ...base_steps {}
      shell { echo main step }
    }
  }
}
`,
    };

    const fileResolver = createMemoryFileResolver(files);
    const importContext = createImportContext(fileResolver, "/project");

    const result = await compileWithImports({
      source: files["/project/main.workpipe"],
      filePath: "/project/main.workpipe",
      importContext,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("test:");
      expect(result.value).toContain("echo base step");
      expect(result.value).toContain("echo main step");
    }
  });
});
