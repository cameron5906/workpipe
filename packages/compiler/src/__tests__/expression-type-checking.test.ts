import { describe, it, expect } from "vitest";
import { compile } from "../index.js";
import {
  inferExpressionType,
  checkComparisonTypes,
  checkNumericOperation,
  isNumericType,
  areTypesCompatible,
  extractInterpolations,
  type TypeContext,
} from "../semantics/index.js";
import type { ExpressionNode, OutputDeclaration } from "../ast/types.js";

function createSpan(start: number = 0, end: number = 10) {
  return { start, end };
}

function createOutputDecl(
  name: string,
  type: "string" | "int" | "float" | "bool" | "json" | "path"
): OutputDeclaration {
  return { name, type, span: createSpan() };
}

function createContext(
  jobs: Record<string, OutputDeclaration[]>
): TypeContext {
  const jobOutputs = new Map<string, Map<string, OutputDeclaration>>();

  for (const [jobName, outputs] of Object.entries(jobs)) {
    const outputMap = new Map<string, OutputDeclaration>();
    for (const output of outputs) {
      outputMap.set(output.name, output);
    }
    jobOutputs.set(jobName, outputMap);
  }

  return { jobOutputs };
}

describe("inferExpressionType", () => {
  describe("literal types", () => {
    it("infers string type for string literals", () => {
      const expr: ExpressionNode = {
        kind: "string",
        value: "hello",
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("string");
    });

    it("infers bool type for boolean literals", () => {
      const exprTrue: ExpressionNode = {
        kind: "boolean",
        value: true,
        span: createSpan(),
      };
      const exprFalse: ExpressionNode = {
        kind: "boolean",
        value: false,
        span: createSpan(),
      };
      const context = createContext({});

      expect(inferExpressionType(exprTrue, context)).toBe("bool");
      expect(inferExpressionType(exprFalse, context)).toBe("bool");
    });

    it("infers int type for integer numeric literals", () => {
      const expr: ExpressionNode = {
        kind: "number",
        value: 42,
        isFloat: false,
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("int");
    });

    it("infers float type for floating-point numeric literals", () => {
      const expr: ExpressionNode = {
        kind: "number",
        value: 3.14,
        isFloat: true,
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("float");
    });
  });

  describe("property access types", () => {
    it("infers type from needs.job.outputs.name pattern", () => {
      const expr: ExpressionNode = {
        kind: "property",
        path: ["needs", "build", "outputs", "count"],
        span: createSpan(),
      };
      const context = createContext({
        build: [createOutputDecl("count", "int")],
      });

      const type = inferExpressionType(expr, context);

      expect(type).toBe("int");
    });

    it("returns unknown for non-existent job", () => {
      const expr: ExpressionNode = {
        kind: "property",
        path: ["needs", "nonexistent", "outputs", "count"],
        span: createSpan(),
      };
      const context = createContext({
        build: [createOutputDecl("count", "int")],
      });

      const type = inferExpressionType(expr, context);

      expect(type).toBe("unknown");
    });

    it("returns unknown for non-existent output", () => {
      const expr: ExpressionNode = {
        kind: "property",
        path: ["needs", "build", "outputs", "missing"],
        span: createSpan(),
      };
      const context = createContext({
        build: [createOutputDecl("count", "int")],
      });

      const type = inferExpressionType(expr, context);

      expect(type).toBe("unknown");
    });

    it("returns unknown for non-needs property path", () => {
      const expr: ExpressionNode = {
        kind: "property",
        path: ["env", "MY_VAR"],
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("unknown");
    });
  });

  describe("binary expression types", () => {
    it("infers bool type for comparison operations", () => {
      const operators: ("==" | "!=" | "<" | ">" | "<=" | ">=")[] = [
        "==",
        "!=",
        "<",
        ">",
        "<=",
        ">=",
      ];

      for (const operator of operators) {
        const expr: ExpressionNode = {
          kind: "binary",
          operator,
          left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
          right: { kind: "number", value: 2, isFloat: false, span: createSpan() },
          span: createSpan(),
        };
        const context = createContext({});

        const type = inferExpressionType(expr, context);

        expect(type).toBe("bool");
      }
    });

    it("infers int for int + int arithmetic", () => {
      const expr: ExpressionNode = {
        kind: "binary",
        operator: "+",
        left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
        right: { kind: "number", value: 2, isFloat: false, span: createSpan() },
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("int");
    });

    it("infers float when any operand is float", () => {
      const expr: ExpressionNode = {
        kind: "binary",
        operator: "*",
        left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
        right: { kind: "number", value: 2.5, isFloat: true, span: createSpan() },
        span: createSpan(),
      };
      const context = createContext({});

      const type = inferExpressionType(expr, context);

      expect(type).toBe("float");
    });
  });
});

describe("isNumericType", () => {
  it("returns true for int", () => {
    expect(isNumericType("int")).toBe(true);
  });

  it("returns true for float", () => {
    expect(isNumericType("float")).toBe(true);
  });

  it("returns false for string", () => {
    expect(isNumericType("string")).toBe(false);
  });

  it("returns false for bool", () => {
    expect(isNumericType("bool")).toBe(false);
  });

  it("returns false for unknown", () => {
    expect(isNumericType("unknown")).toBe(false);
  });
});

describe("areTypesCompatible", () => {
  it("returns true for same types", () => {
    expect(areTypesCompatible("string", "string")).toBe(true);
    expect(areTypesCompatible("int", "int")).toBe(true);
    expect(areTypesCompatible("bool", "bool")).toBe(true);
  });

  it("returns true for numeric type mixing", () => {
    expect(areTypesCompatible("int", "float")).toBe(true);
    expect(areTypesCompatible("float", "int")).toBe(true);
  });

  it("returns true when either type is unknown", () => {
    expect(areTypesCompatible("unknown", "string")).toBe(true);
    expect(areTypesCompatible("int", "unknown")).toBe(true);
  });

  it("returns false for incompatible types", () => {
    expect(areTypesCompatible("string", "int")).toBe(false);
    expect(areTypesCompatible("bool", "float")).toBe(false);
    expect(areTypesCompatible("json", "string")).toBe(false);
  });
});

describe("checkComparisonTypes (WP2012)", () => {
  it("returns null for compatible types in equality comparison", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "==",
      left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
      right: { kind: "number", value: 2, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).toBeNull();
  });

  it("returns WP2012 error for string vs int comparison", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "==",
      left: { kind: "string", value: "hello", span: createSpan() },
      right: { kind: "number", value: 42, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2012");
    expect(diagnostic!.severity).toBe("error");
    expect(diagnostic!.message).toContain("string");
    expect(diagnostic!.message).toContain("int");
  });

  it("returns WP2012 error for < operator on string type", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "<",
      left: { kind: "string", value: "abc", span: createSpan() },
      right: { kind: "number", value: 5, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2012");
    expect(diagnostic!.message).toContain("string");
    expect(diagnostic!.message).toContain("int");
  });

  it("returns null for < operator on numeric types", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "<",
      left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
      right: { kind: "number", value: 2.5, isFloat: true, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).toBeNull();
  });

  it("returns null when one type is unknown", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "==",
      left: { kind: "property", path: ["env", "VAR"], span: createSpan() },
      right: { kind: "number", value: 42, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).toBeNull();
  });

  it("detects type mismatch from job output references", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "==",
      left: {
        kind: "property",
        path: ["needs", "build", "outputs", "count"],
        span: createSpan(),
      },
      right: { kind: "string", value: "hello", span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({
      build: [createOutputDecl("count", "int")],
    });

    const diagnostic = checkComparisonTypes(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2012");
    expect(diagnostic!.message).toContain("int");
    expect(diagnostic!.message).toContain("string");
  });
});

describe("checkNumericOperation (WP2013)", () => {
  it("returns null for numeric operands", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "+",
      left: { kind: "number", value: 1, isFloat: false, span: createSpan() },
      right: { kind: "number", value: 2, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkNumericOperation(expr, context);

    expect(diagnostic).toBeNull();
  });

  it("returns WP2013 warning for string in arithmetic", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "+",
      left: { kind: "string", value: "hello", span: createSpan() },
      right: { kind: "number", value: 2, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkNumericOperation(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2013");
    expect(diagnostic!.severity).toBe("warning");
    expect(diagnostic!.message).toContain("string");
  });

  it("returns WP2013 warning for bool in arithmetic", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "*",
      left: { kind: "number", value: 5, isFloat: false, span: createSpan() },
      right: { kind: "boolean", value: true, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkNumericOperation(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2013");
    expect(diagnostic!.message).toContain("bool");
  });

  it("returns null when type is unknown", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "+",
      left: { kind: "property", path: ["env", "COUNT"], span: createSpan() },
      right: { kind: "number", value: 1, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({});

    const diagnostic = checkNumericOperation(expr, context);

    expect(diagnostic).toBeNull();
  });

  it("detects non-numeric from job output reference", () => {
    const expr: ExpressionNode & { kind: "binary" } = {
      kind: "binary",
      operator: "-",
      left: {
        kind: "property",
        path: ["needs", "build", "outputs", "name"],
        span: createSpan(),
      },
      right: { kind: "number", value: 1, isFloat: false, span: createSpan() },
      span: createSpan(),
    };
    const context = createContext({
      build: [createOutputDecl("name", "string")],
    });

    const diagnostic = checkNumericOperation(expr, context);

    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.code).toBe("WP2013");
    expect(diagnostic!.message).toContain("string");
  });
});

describe("extractInterpolations", () => {
  it("extracts single interpolation", () => {
    const text = 'echo "${{ needs.build.outputs.version }}"';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("property");
    if (results[0].expression.kind === "property") {
      expect(results[0].expression.path).toEqual([
        "needs",
        "build",
        "outputs",
        "version",
      ]);
    }
  });

  it("extracts multiple interpolations", () => {
    const text = 'echo "${{ needs.a.outputs.x }} and ${{ needs.b.outputs.y }}"';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(2);
  });

  it("extracts comparison expression", () => {
    const text = '${{ needs.build.outputs.count > 10 }}';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("binary");
    if (results[0].expression.kind === "binary") {
      expect(results[0].expression.operator).toBe(">");
    }
  });

  it("extracts equality comparison with string", () => {
    const text = "${{ needs.build.outputs.status == 'success' }}";
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("binary");
    if (results[0].expression.kind === "binary") {
      expect(results[0].expression.operator).toBe("==");
      expect(results[0].expression.right.kind).toBe("string");
    }
  });

  it("extracts arithmetic expression", () => {
    const text = '${{ needs.build.outputs.count + 1 }}';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("binary");
    if (results[0].expression.kind === "binary") {
      expect(results[0].expression.operator).toBe("+");
    }
  });

  it("extracts boolean literals", () => {
    const text = '${{ true }}';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("boolean");
    if (results[0].expression.kind === "boolean") {
      expect(results[0].expression.value).toBe(true);
    }
  });

  it("extracts numeric literals", () => {
    const text = '${{ 42 }}';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("number");
    if (results[0].expression.kind === "number") {
      expect(results[0].expression.value).toBe(42);
      expect(results[0].expression.isFloat).toBe(false);
    }
  });

  it("extracts float literals", () => {
    const text = '${{ 3.14 }}';
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(1);
    expect(results[0].expression.kind).toBe("number");
    if (results[0].expression.kind === "number") {
      expect(results[0].expression.value).toBe(3.14);
      expect(results[0].expression.isFloat).toBe(true);
    }
  });

  it("returns empty array for text without interpolations", () => {
    const text = "echo hello world";
    const span = createSpan(0, text.length);

    const results = extractInterpolations(text, span);

    expect(results).toHaveLength(0);
  });
});

describe("compile integration with expression type checking", () => {
  it("reports WP2012 for type mismatch in step expression", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          count: int
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("if $\{{ needs.build.outputs.count == 'hello' }}; then echo yes; fi")]
      }
    }`;

    const result = compile(source);

    const errors = result.diagnostics.filter((d) => d.code === "WP2012");
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].message).toContain("int");
    expect(errors[0].message).toContain("string");
  });

  it("reports WP2012 for numeric comparison on string type", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          name: string
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("if $\{{ needs.build.outputs.name > 10 }}; then echo yes; fi")]
      }
    }`;

    const result = compile(source);

    const errors = result.diagnostics.filter((d) => d.code === "WP2012");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("string");
    expect(errors[0].message).toContain("int");
  });

  it("reports WP2013 warning for arithmetic on non-numeric type", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          name: string
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("echo $\{{ needs.build.outputs.name + 1 }}")]
      }
    }`;

    const result = compile(source);

    const warnings = result.diagnostics.filter((d) => d.code === "WP2013");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].message).toContain("string");
  });

  it("compiles successfully with valid type usage", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          count: int
          name: string
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [
          run("if $\{{ needs.build.outputs.count > 10 }}; then echo yes; fi"),
          run("echo $\{{ needs.build.outputs.name == 'test' }}")
        ]
      }
    }`;

    const result = compile(source);

    const typeErrors = result.diagnostics.filter(
      (d) => d.code === "WP2012" || d.code === "WP2013"
    );
    expect(typeErrors).toHaveLength(0);
  });

  it("does not report errors for unknown types (backwards compatibility)", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("echo $\{{ needs.build.outputs.anything > 10 }}")]
      }
    }`;

    const result = compile(source);

    const typeErrors = result.diagnostics.filter(
      (d) => d.code === "WP2012" || d.code === "WP2013"
    );
    expect(typeErrors).toHaveLength(0);
  });

  it("handles float type correctly in comparisons", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          score: float
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("if $\{{ needs.build.outputs.score >= 0.5 }}; then echo pass; fi")]
      }
    }`;

    const result = compile(source);

    const typeErrors = result.diagnostics.filter(
      (d) => d.code === "WP2012" || d.code === "WP2013"
    );
    expect(typeErrors).toHaveLength(0);
  });

  it("handles bool type correctly", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          success: bool
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("if $\{{ needs.build.outputs.success == true }}; then echo pass; fi")]
      }
    }`;

    const result = compile(source);

    const typeErrors = result.diagnostics.filter(
      (d) => d.code === "WP2012" || d.code === "WP2013"
    );
    expect(typeErrors).toHaveLength(0);
  });

  it("detects bool vs int mismatch", () => {
    const source = `workflow test {
      on: push
      job build {
        runs_on: ubuntu-latest
        outputs: {
          success: bool
        }
        steps: [run("echo hello")]
      }
      job deploy {
        runs_on: ubuntu-latest
        needs: [build]
        steps: [run("if $\{{ needs.build.outputs.success == 42 }}; then echo pass; fi")]
      }
    }`;

    const result = compile(source);

    const errors = result.diagnostics.filter((d) => d.code === "WP2012");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("bool");
    expect(errors[0].message).toContain("int");
  });
});
