import type {
  WorkflowNode,
  JobNode,
  AnyJobNode,
  AnyJobDeclNode,
  AgentJobNode,
  MatrixJobNode,
  StepNode,
  AgentTaskNode,
  GuardJsStepNode,
  ShellStepNode,
  UsesBlockStepNode,
  CheckoutStepNode,
  ExpressionNode,
  PromptValue,
  CycleNode,
  SchemaTypeNode,
  SchemaObjectNode,
  TypeDeclarationNode,
  TypeExpressionNode,
  TypeFieldNode,
  JobFragmentInstantiationNode,
  StepsFragmentSpreadNode,
  ParamArgumentNode,
  JobFragmentNode,
  StepsFragmentNode,
  RunStepNode,
  UsesStepNode,
} from "../ast/types.js";
import { isConcreteJob, isFragmentInstantiation } from "../ast/types.js";
import type { TypeRegistry } from "../semantics/type-registry.js";
import type { FragmentRegistry } from "../semantics/fragment-registry.js";
import type {
  WorkflowIR,
  TriggerIR,
  JobIR,
  StepIR,
  ShellStepIR,
  UsesWithStepIR,
  ClaudeCodeStepIR,
  UploadArtifactStepIR,
  DownloadArtifactStepIR,
  ScriptStepIR,
  WorkflowDispatchInputIR,
  ConcurrencyIR,
  MatrixStrategyIR,
} from "./yaml-ir.js";

export type JsonSchema =
  | { type: "string" }
  | { type: "integer" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "null" }
  | { type: "array"; items: JsonSchema }
  | {
      type: "object";
      properties: Record<string, JsonSchema>;
      required: string[];
      additionalProperties: false;
    }
  | { oneOf: JsonSchema[] }
  | { enum: string[] };

function schemaTypeToJsonSchema(schemaType: SchemaTypeNode): JsonSchema {
  switch (schemaType.kind) {
    case "primitive":
      switch (schemaType.type) {
        case "string":
          return { type: "string" };
        case "int":
          return { type: "integer" };
        case "float":
          return { type: "number" };
        case "bool":
          return { type: "boolean" };
      }
      break;
    case "null":
      return { type: "null" };
    case "array":
      return {
        type: "array",
        items: schemaTypeToJsonSchema(schemaType.elementType),
      };
    case "object":
      return inlineSchemaToJsonSchema(schemaType);
    case "stringLiteral":
      return { enum: [schemaType.value] };
    case "union": {
      const allStringLiterals = schemaType.types.every(
        (t) => t.kind === "stringLiteral"
      );
      if (allStringLiterals) {
        const enumValues = schemaType.types.map((t) => {
          if (t.kind === "stringLiteral") {
            return t.value;
          }
          throw new Error("Expected string literal in union");
        });
        return { enum: enumValues };
      }
      return {
        oneOf: schemaType.types.map((t) => schemaTypeToJsonSchema(t)),
      };
    }
  }
  throw new Error(`Unknown schema type: ${(schemaType as SchemaTypeNode).kind}`);
}

export function inlineSchemaToJsonSchema(schema: SchemaObjectNode): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of schema.fields) {
    properties[field.name] = schemaTypeToJsonSchema(field.type);
    required.push(field.name);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function typeExpressionToJsonSchema(
  typeExpr: TypeExpressionNode,
  registry?: TypeRegistry
): JsonSchema {
  switch (typeExpr.kind) {
    case "primitive_type":
      switch (typeExpr.type) {
        case "string":
          return { type: "string" };
        case "int":
          return { type: "integer" };
        case "float":
          return { type: "number" };
        case "bool":
          return { type: "boolean" };
        case "json":
          return { type: "object", properties: {}, required: [], additionalProperties: false };
        case "path":
          return { type: "string" };
        default:
          throw new Error(`Unknown primitive type: ${typeExpr.type}`);
      }
    case "null_type":
      return { type: "null" };
    case "array_type":
      return {
        type: "array",
        items: typeExpressionToJsonSchema(typeExpr.elementType, registry),
      };
    case "object_type": {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const field of typeExpr.fields) {
        properties[field.name] = typeExpressionToJsonSchema(field.type, registry);
        required.push(field.name);
      }
      return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      };
    }
    case "string_literal_type":
      return { enum: [typeExpr.value] };
    case "union_type": {
      const allStringLiterals = typeExpr.members.every(
        (m) => m.kind === "string_literal_type"
      );
      if (allStringLiterals) {
        const enumValues = typeExpr.members.map((m) => {
          if (m.kind === "string_literal_type") {
            return m.value;
          }
          throw new Error("Expected string literal in union");
        });
        return { enum: enumValues };
      }
      return {
        oneOf: typeExpr.members.map((m) => typeExpressionToJsonSchema(m, registry)),
      };
    }
    case "type_reference": {
      if (registry) {
        const resolvedType = registry.resolve(typeExpr.name);
        if (resolvedType) {
          return typeDeclarationToJsonSchema(resolvedType, registry);
        }
      }
      return { $ref: typeExpr.name } as unknown as JsonSchema;
    }
  }
  throw new Error(`Unknown type expression: ${(typeExpr as TypeExpressionNode).kind}`);
}

export function typeDeclarationToJsonSchema(
  type: TypeDeclarationNode,
  registry?: TypeRegistry
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of type.fields) {
    properties[field.name] = typeExpressionToJsonSchema(field.type, registry);
    required.push(field.name);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export function serializeExpression(expr: ExpressionNode): string {
  switch (expr.kind) {
    case "binary": {
      const left = serializeExpression(expr.left);
      const right = serializeExpression(expr.right);
      return `${left} ${expr.operator} ${right}`;
    }
    case "property": {
      return expr.path.join(".");
    }
    case "string": {
      return `'${expr.value}'`;
    }
    case "boolean": {
      return expr.value ? "true" : "false";
    }
    case "number": {
      return String(expr.value);
    }
  }
}

function resolvePromptValue(prompt: PromptValue): string {
  switch (prompt.kind) {
    case "literal":
      return prompt.value;
    case "file":
      return `\${{ file('${prompt.path}') }}`;
    case "template":
      return prompt.content;
  }
}

export function generateMatrixFingerprint(
  axes: Record<string, readonly (string | number)[]>
): string {
  const sortedKeys = Object.keys(axes).sort();
  return sortedKeys.map((key) => `\${{ matrix.${key} }}`).join("-");
}

interface MatrixContext {
  axes: Record<string, readonly (string | number)[]>;
}

function transformAgentTask(
  task: AgentTaskNode,
  workflowName: string,
  jobName: string,
  matrixContext?: MatrixContext,
  registry?: TypeRegistry
): StepIR[] {
  const steps: StepIR[] = [];

  let prompt = task.taskDescription;
  if (task.prompt) {
    prompt = resolvePromptValue(task.prompt);
  }

  const withConfig: {
    prompt: string;
    allowed_tools?: string;
    disallowed_tools?: string;
    max_turns?: number;
    model?: string;
    output_schema?: object;
  } = {
    prompt,
  };

  if (task.tools?.allowed && task.tools.allowed.length > 0) {
    withConfig.allowed_tools = JSON.stringify([...task.tools.allowed]);
  }

  if (task.tools?.disallowed && task.tools.disallowed.length > 0) {
    withConfig.disallowed_tools = JSON.stringify([...task.tools.disallowed]);
  }

  if (task.maxTurns !== undefined) {
    withConfig.max_turns = task.maxTurns;
  }

  if (task.model) {
    withConfig.model = task.model;
  }

  if (task.outputSchema) {
    if (typeof task.outputSchema === "string") {
      const isFilePath = task.outputSchema.endsWith(".json");
      if (!isFilePath && registry) {
        const resolvedType = registry.resolve(task.outputSchema);
        if (resolvedType) {
          withConfig.output_schema = typeDeclarationToJsonSchema(resolvedType, registry);
        } else {
          withConfig.output_schema = { $ref: task.outputSchema };
        }
      } else {
        withConfig.output_schema = { $ref: task.outputSchema };
      }
    } else {
      withConfig.output_schema = inlineSchemaToJsonSchema(task.outputSchema);
    }
  }

  const claudeStep: ClaudeCodeStepIR = {
    kind: "claude_code",
    name: `${jobName}-task`,
    uses: "anthropics/claude-code-action@v1",
    with: withConfig,
  };

  steps.push(claudeStep);

  if (task.outputArtifact) {
    let artifactName = task.outputArtifact;
    if (matrixContext) {
      const fingerprint = generateMatrixFingerprint(matrixContext.axes);
      artifactName = `${task.outputArtifact}-${fingerprint}`;
    }
    const artifactStep: UploadArtifactStepIR = {
      kind: "upload_artifact",
      name: `Upload ${task.outputArtifact}`,
      uses: "actions/upload-artifact@v4",
      with: {
        name: artifactName,
        path: task.outputArtifact,
      },
    };
    steps.push(artifactStep);
  }

  return steps;
}

const GUARD_HELPERS = `
const guards = {
  get event() { return context.event; },
  get ref() { return context.ref; },
  get inputs() { return context.inputs; },
  get actor() { return context.event?.sender?.login || ''; },
  hasLabel(name) {
    const labels = context.event?.issue?.labels || context.event?.pull_request?.labels || [];
    return labels.some(l => l.name === name);
  },
  hasAnyLabel(...names) {
    return names.some(n => this.hasLabel(n));
  },
  hasAllLabels(...names) {
    return names.every(n => this.hasLabel(n));
  },
  isBranch(name) {
    return context.ref === 'refs/heads/' + name;
  },
  isDefaultBranch() {
    return this.isBranch(context.event?.repository?.default_branch || 'main');
  },
  isPullRequest() {
    return !!context.event?.pull_request;
  },
  isIssue() {
    return !!context.event?.issue && !context.event?.pull_request;
  },
  isDraft() {
    return context.event?.pull_request?.draft === true;
  },
  isAction(action) {
    return context.event?.action === action;
  }
};
`.trim();

export function stripCommonIndent(content: string): string {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  if (nonEmptyLines.length === 0) return content.trim();

  const minIndent = Math.min(
    ...nonEmptyLines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    })
  );

  return lines.map(line => line.slice(minIndent)).join('\n').trim();
}

function transformShellStep(step: ShellStepNode): StepIR[] {
  const strippedContent = stripCommonIndent(step.content);

  const shellStep: ShellStepIR = {
    kind: "shell",
    run: strippedContent,
    multiline: step.multiline,
  };

  return [shellStep];
}

function transformUsesBlockStep(step: UsesBlockStepNode): StepIR[] {
  if (step.with && Object.keys(step.with).length > 0) {
    const usesWithStep: UsesWithStepIR = {
      kind: "uses_with",
      action: step.action,
      with: step.with,
    };
    return [usesWithStep];
  }

  return [{ kind: "uses", action: step.action }];
}

const CHECKOUT_PROPERTY_MAP: Record<string, string> = {
  fetch_depth: "fetch-depth",
  submodules: "submodules",
  ref: "ref",
  token: "token",
};

function transformCheckoutStep(step: CheckoutStepNode): StepIR[] {
  if (step.with && Object.keys(step.with).length > 0) {
    const mappedWith: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(step.with)) {
      const mappedKey = CHECKOUT_PROPERTY_MAP[key] ?? key;
      mappedWith[mappedKey] = value;
    }

    const usesWithStep: UsesWithStepIR = {
      kind: "uses_with",
      action: "actions/checkout@v4",
      with: mappedWith,
    };
    return [usesWithStep];
  }

  return [{ kind: "uses", action: "actions/checkout@v4" }];
}

function transformGuardJsStep(step: GuardJsStepNode): StepIR[] {
  const guardCode = step.code;

  const guardScript = `
const fs = require('fs');
const context = {
  event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
  ref: process.env.GITHUB_REF,
  inputs: JSON.parse(process.env.INPUTS || '{}')
};
${GUARD_HELPERS}
const result = (function() { ${guardCode} })();
console.log('Guard result:', result);
fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + result + '\\n');
`.trim();

  const scriptStep: ScriptStepIR = {
    kind: "script",
    name: "Evaluate guard",
    id: step.id,
    run: `node -e "${guardScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
    shell: "bash",
    env: {
      INPUTS: "${{ toJson(inputs) }}",
    },
  };

  return [scriptStep];
}

function transformStep(
  step: StepNode,
  workflowName: string,
  jobName: string,
  matrixContext?: MatrixContext,
  registry?: TypeRegistry
): StepIR[] {
  switch (step.kind) {
    case "run":
      return [{ kind: "run", command: step.command }];
    case "uses":
      return [{ kind: "uses", action: step.action }];
    case "shell":
      return transformShellStep(step);
    case "uses_block":
      return transformUsesBlockStep(step);
    case "checkout":
      return transformCheckoutStep(step);
    case "agent_task":
      return transformAgentTask(step, workflowName, jobName, matrixContext, registry);
    case "guard_js_step":
      return transformGuardJsStep(step);
    case "steps_fragment_spread":
      return [];
  }
}

function collectGuardJsOutputs(
  steps: readonly StepNode[]
): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const step of steps) {
    if (step.kind === "guard_js_step") {
      outputs[`${step.id}_result`] = `\${{ steps.${step.id}.outputs.result }}`;
    }
  }
  return outputs;
}

function assignStepIds(steps: StepIR[]): { steps: StepIR[]; lastStepId: string | undefined } {
  let stepIndex = 0;
  const stepsWithIds: StepIR[] = [];
  let lastStepId: string | undefined;

  for (const step of steps) {
    const stepId = step.id ?? `step_${stepIndex}`;
    lastStepId = stepId;
    stepsWithIds.push({ ...step, id: stepId } as StepIR);
    stepIndex++;
  }

  return { steps: stepsWithIds, lastStepId };
}

function transformRegularJob(
  job: JobNode,
  workflowName: string,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): JobIR {
  const rawSteps = transformStepsWithFragments(
    job.steps,
    fragmentRegistry,
    workflowName,
    job.name,
    undefined,
    registry
  );

  const hasUserOutputs = job.outputs.length > 0;
  const { steps, lastStepId } = hasUserOutputs
    ? assignStepIds(rawSteps)
    : { steps: rawSteps, lastStepId: undefined };

  const result: JobIR = {
    runsOn: job.runsOn ?? "ubuntu-latest",
    steps,
  };

  if (job.needs.length > 0) {
    (result as { needs: readonly string[] }).needs = job.needs;
  }

  if (job.condition) {
    (result as { if: string }).if = serializeExpression(job.condition);
  }

  const guardOutputs = collectGuardJsOutputs(job.steps);
  const userOutputs: Record<string, string> = {};
  for (const output of job.outputs) {
    const stepId = lastStepId ?? "step_0";
    userOutputs[output.name] = `\${{ steps.${stepId}.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformAgentJob(
  job: AgentJobNode,
  workflowName: string,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): JobIR {
  const rawSteps = transformStepsWithFragments(
    job.steps,
    fragmentRegistry,
    workflowName,
    job.name,
    undefined,
    registry
  );

  const hasUserOutputs = job.outputs.length > 0;
  const { steps, lastStepId } = hasUserOutputs
    ? assignStepIds(rawSteps)
    : { steps: rawSteps, lastStepId: undefined };

  const result: JobIR = {
    runsOn: job.runsOn ?? "ubuntu-latest",
    steps,
  };

  if (job.needs.length > 0) {
    (result as { needs: readonly string[] }).needs = job.needs;
  }

  const guardOutputs = collectGuardJsOutputs(job.steps);
  const userOutputs: Record<string, string> = {};
  for (const output of job.outputs) {
    const stepId = lastStepId ?? "step_0";
    userOutputs[output.name] = `\${{ steps.${stepId}.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformMatrixJob(
  job: MatrixJobNode,
  workflowName: string,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): JobIR {
  const matrixContext: MatrixContext = { axes: job.axes };
  const rawSteps = transformStepsWithFragments(
    job.steps,
    fragmentRegistry,
    workflowName,
    job.name,
    matrixContext,
    registry
  );

  const hasUserOutputs = job.outputs.length > 0;
  const { steps, lastStepId } = hasUserOutputs
    ? assignStepIds(rawSteps)
    : { steps: rawSteps, lastStepId: undefined };

  const strategy: MatrixStrategyIR = {
    matrix: job.axes,
    ...(job.include ? { include: job.include } : {}),
    ...(job.exclude ? { exclude: job.exclude } : {}),
    ...(job.maxParallel !== undefined ? { "max-parallel": job.maxParallel } : {}),
    ...(job.failFast !== undefined ? { "fail-fast": job.failFast } : {}),
  };

  const result: JobIR = {
    runsOn: job.runsOn ?? "ubuntu-latest",
    steps,
    strategy,
  };

  if (job.needs.length > 0) {
    (result as { needs: readonly string[] }).needs = job.needs;
  }

  if (job.condition) {
    (result as { if: string }).if = serializeExpression(job.condition);
  }

  const guardOutputs = collectGuardJsOutputs(job.steps);
  const userOutputs: Record<string, string> = {};
  for (const output of job.outputs) {
    const stepId = lastStepId ?? "step_0";
    userOutputs[output.name] = `\${{ steps.${stepId}.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformJob(
  job: AnyJobNode,
  workflowName: string,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): JobIR {
  if (job.kind === "agent_job") {
    return transformAgentJob(job, workflowName, registry, fragmentRegistry);
  }
  if (job.kind === "matrix_job") {
    return transformMatrixJob(job, workflowName, registry, fragmentRegistry);
  }
  return transformRegularJob(job, workflowName, registry, fragmentRegistry);
}

function transformCycleBodyJob(
  job: AnyJobNode,
  workflowName: string,
  cycleName: string,
  hydrateJobName: string,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): JobIR {
  const baseJob = transformJob(job, workflowName, registry, fragmentRegistry);

  const cycleJobNeeds = [...(baseJob.needs ?? [])].map((need) => {
    const bodyJobNames = [];
    for (const j of [job]) {
      if (j.needs.includes(need)) {
        return `${cycleName}_body_${need}`;
      }
    }
    return need;
  });

  if (!cycleJobNeeds.includes(hydrateJobName)) {
    cycleJobNeeds.unshift(hydrateJobName);
  }

  return {
    ...baseJob,
    needs: cycleJobNeeds,
  };
}

export function transformCycle(
  cycle: CycleNode,
  workflow: WorkflowNode,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): Map<string, JobIR> {
  const jobs = new Map<string, JobIR>();
  const cycleName = cycle.name;
  const stateArtifactName = `${cycleName}-state`;
  const keyName = cycle.key ?? "phase";

  const hydrateJobName = `${cycleName}_hydrate`;
  jobs.set(hydrateJobName, createHydrateJob(cycleName, stateArtifactName, keyName));

  const bodyJobNames: string[] = [];
  for (const bodyJob of cycle.body.jobs) {
    if (!isConcreteJob(bodyJob)) continue;

    const jobName = `${cycleName}_body_${bodyJob.name}`;
    bodyJobNames.push(jobName);

    const transformedJob = transformCycleBodyJob(
      bodyJob,
      workflow.name,
      cycleName,
      hydrateJobName,
      registry,
      fragmentRegistry
    );

    const needsWithCyclePrefix = (bodyJob.needs ?? []).map((need: string) => {
      const isInCycleBody = cycle.body.jobs.some((j) => j.name === need);
      return isInCycleBody ? `${cycleName}_body_${need}` : need;
    });

    const finalNeeds = needsWithCyclePrefix.length > 0
      ? [hydrateJobName, ...needsWithCyclePrefix]
      : [hydrateJobName];

    jobs.set(jobName, {
      ...transformedJob,
      needs: finalNeeds,
    });
  }

  const decideJobName = `${cycleName}_decide`;
  const lastBodyJob = bodyJobNames[bodyJobNames.length - 1];
  jobs.set(
    decideJobName,
    createDecideJob(cycleName, lastBodyJob, stateArtifactName, keyName, cycle)
  );

  const dispatchJobName = `${cycleName}_dispatch`;
  jobs.set(
    dispatchJobName,
    createDispatchJob(cycleName, decideJobName, workflow.name, keyName, cycle.maxIters)
  );

  return jobs;
}

function createHydrateJob(
  cycleName: string,
  stateArtifactName: string,
  keyName: string
): JobIR {
  const downloadStep: DownloadArtifactStepIR = {
    kind: "download_artifact",
    name: "Download cycle state",
    if: `github.event.inputs.${keyName} != '0' && github.event.inputs.${keyName} != ''`,
    uses: "actions/download-artifact@v4",
    with: {
      name: stateArtifactName,
      path: ".cycle-state",
      "run-id": `\${{ github.event.inputs.run_id }}`,
      "github-token": `\${{ secrets.GITHUB_TOKEN }}`,
    },
  };

  const initStateStep: ScriptStepIR = {
    kind: "script",
    name: "Initialize cycle state",
    id: "init_state",
    run: `
PHASE=\${{ github.event.inputs.${keyName} || '0' }}
if [ -f .cycle-state/state.json ]; then
  echo "Loaded state from artifact"
  cat .cycle-state/state.json
else
  echo '{"${keyName}": '$PHASE'}' > state.json
  mkdir -p .cycle-state
  cp state.json .cycle-state/state.json
fi
echo "phase=$PHASE" >> $GITHUB_OUTPUT
`.trim(),
    shell: "bash",
  };

  return {
    runsOn: "ubuntu-latest",
    outputs: {
      phase: "${{ steps.init_state.outputs.phase }}",
    },
    steps: [downloadStep, initStateStep],
  };
}

function createDecideJob(
  cycleName: string,
  lastBodyJob: string,
  stateArtifactName: string,
  keyName: string,
  cycle: CycleNode
): JobIR {
  const guardCode = cycle.until?.code ?? "return false;";
  const maxIters = cycle.maxIters;

  const guardScript = `
const fs = require('fs');
let state = {};
if (fs.existsSync('.cycle-state/state.json')) {
  state = JSON.parse(fs.readFileSync('.cycle-state/state.json', 'utf8'));
}
const phase = parseInt(process.env.PHASE || '0', 10);
const maxIters = ${maxIters ?? "null"};
const context = { ...state, ${keyName}: phase };
const guardResult = (function() { ${guardCode} })();
console.log('Guard result:', guardResult);
let terminationReason = 'continue';
let shouldContinue = true;
if (guardResult) {
  terminationReason = 'guard_satisfied';
  shouldContinue = false;
} else if (maxIters !== null && phase >= maxIters - 1) {
  terminationReason = 'max_iterations';
  shouldContinue = false;
}
console.log('Termination reason:', terminationReason);
fs.writeFileSync('.cycle-state/continue.txt', shouldContinue ? 'true' : 'false');
fs.writeFileSync('.cycle-state/termination_reason.txt', terminationReason);
fs.writeFileSync('.cycle-state/state.json', JSON.stringify({ ...context, quality_score: context.quality_score || 0 }));
`.trim();

  const evalGuardStep: ScriptStepIR = {
    kind: "script",
    name: "Evaluate guard condition",
    id: "eval_guard",
    run: `node -e "${guardScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"
CONTINUE=$(cat .cycle-state/continue.txt)
TERMINATION_REASON=$(cat .cycle-state/termination_reason.txt)
echo "continue=$CONTINUE" >> $GITHUB_OUTPUT
echo "termination_reason=$TERMINATION_REASON" >> $GITHUB_OUTPUT`,
    shell: "bash",
    env: {
      PHASE: `\${{ needs.${cycleName}_hydrate.outputs.phase }}`,
    },
  };

  const uploadStateStep: UploadArtifactStepIR = {
    kind: "upload_artifact",
    name: "Upload cycle state",
    uses: "actions/upload-artifact@v4",
    with: {
      name: stateArtifactName,
      path: ".cycle-state",
    },
  };

  return {
    runsOn: "ubuntu-latest",
    needs: [lastBodyJob],
    outputs: {
      continue: "${{ steps.eval_guard.outputs.continue }}",
      termination_reason: "${{ steps.eval_guard.outputs.termination_reason }}",
    },
    steps: [evalGuardStep, uploadStateStep],
  };
}

function createDispatchJob(
  cycleName: string,
  decideJobName: string,
  workflowName: string,
  keyName: string,
  maxIters: number | null
): JobIR {
  const maxItersCheck = maxIters
    ? ` && \${{ needs.${cycleName}_hydrate.outputs.phase }} < ${maxIters}`
    : "";

  const dispatchScript = [
    `NEXT_PHASE=$(( \${{ needs.${cycleName}_hydrate.outputs.phase }} + 1 ))`,
    'gh workflow run "${{ github.workflow }}" \\',
    '  --ref "${{ github.ref }}" \\',
    `  -f ${keyName}=$NEXT_PHASE \\`,
    '  -f run_id=${{ github.run_id }}',
    'echo "Dispatched iteration $NEXT_PHASE"',
  ].join("\n");

  const dispatchStep: ScriptStepIR = {
    kind: "script",
    name: "Dispatch next iteration",
    run: dispatchScript,
    shell: "bash",
    env: {
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
  };

  return {
    runsOn: "ubuntu-latest",
    needs: [decideJobName, `${cycleName}_hydrate`],
    if: `needs.${decideJobName}.outputs.continue == 'true'${maxItersCheck}`,
    steps: [dispatchStep],
  };
}

function transformTrigger(trigger: WorkflowNode["trigger"]): TriggerIR {
  return {
    events: trigger?.events ?? [],
  };
}

function mergeTriggerWithDispatch(
  trigger: WorkflowNode["trigger"],
  cycles: readonly CycleNode[]
): TriggerIR {
  const baseTrigger = transformTrigger(trigger);

  const inputs: WorkflowDispatchInputIR[] = [];

  for (const cycle of cycles) {
    const keyName = cycle.key ?? "phase";

    inputs.push({
      name: keyName,
      description: `Current iteration phase for cycle ${cycle.name}`,
      required: false,
      default: "0",
    });

    inputs.push({
      name: "run_id",
      description: "Run ID for artifact retrieval",
      required: false,
      default: "",
    });
  }

  const uniqueInputs = inputs.filter(
    (input, index, self) => self.findIndex((i) => i.name === input.name) === index
  );

  return {
    events: baseTrigger.events,
    workflowDispatch: {
      inputs: uniqueInputs,
    },
  };
}

function generateConcurrency(cycles: readonly CycleNode[]): ConcurrencyIR | undefined {
  if (cycles.length === 0) return undefined;

  const cycle = cycles[0];
  const group = cycle.key
    ? `\${{ inputs._cycle_key || '${cycle.key}' }}`
    : `\${{ github.workflow }}-\${{ inputs._cycle_phase || 'bootstrap' }}`;

  return {
    group,
    "cancel-in-progress": false,
  };
}

/**
 * Substitute parameter references in a string with their argument values.
 * Parameters are referenced as ${{ params.X }} in fragment bodies.
 */
export function substituteParams(
  content: string,
  args: Map<string, string>
): string {
  return content.replace(/\$\{\{\s*params\.(\w+)\s*\}\}/g, (match, paramName) => {
    const value = args.get(paramName);
    return value !== undefined ? value : match;
  });
}

/**
 * Serialize an expression node to a string value for parameter substitution.
 */
function expressionToString(expr: ExpressionNode): string {
  switch (expr.kind) {
    case "string":
      return expr.value;
    case "boolean":
      return expr.value ? "true" : "false";
    case "number":
      return String(expr.value);
    case "property":
      return `\${{ ${expr.path.join(".")} }}`;
    case "binary":
      return serializeExpression(expr);
  }
}

/**
 * Build a map of parameter name to stringified value from arguments.
 */
function buildParamMap(args: readonly ParamArgumentNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const arg of args) {
    map.set(arg.name, expressionToString(arg.value));
  }
  return map;
}

/**
 * Clone a step with parameter substitution applied.
 */
function cloneStepWithParams(step: StepNode, paramMap: Map<string, string>): StepNode {
  switch (step.kind) {
    case "run": {
      const runStep: RunStepNode = {
        kind: "run",
        command: substituteParams(step.command, paramMap),
        span: step.span,
      };
      return runStep;
    }
    case "uses": {
      const usesStep: UsesStepNode = {
        kind: "uses",
        action: substituteParams(step.action, paramMap),
        span: step.span,
      };
      return usesStep;
    }
    case "shell": {
      const shellStep: ShellStepNode = {
        kind: "shell",
        content: substituteParams(step.content, paramMap),
        multiline: step.multiline,
        span: step.span,
      };
      return shellStep;
    }
    case "uses_block": {
      const withConfig = step.with
        ? substituteParamsInObject(step.with, paramMap)
        : undefined;
      const usesBlockStep: UsesBlockStepNode = {
        kind: "uses_block",
        action: substituteParams(step.action, paramMap),
        ...(withConfig ? { with: withConfig } : {}),
        span: step.span,
      };
      return usesBlockStep;
    }
    case "agent_task": {
      const clonedTask: AgentTaskNode = {
        ...step,
        taskDescription: substituteParams(step.taskDescription, paramMap),
        prompt: step.prompt ? clonePromptWithParams(step.prompt, paramMap) : undefined,
        systemPrompt: step.systemPrompt ? clonePromptWithParams(step.systemPrompt, paramMap) : undefined,
      };
      return clonedTask;
    }
    case "guard_js_step": {
      const guardStep: GuardJsStepNode = {
        kind: "guard_js_step",
        id: substituteParams(step.id, paramMap),
        code: substituteParams(step.code, paramMap),
        span: step.span,
      };
      return guardStep;
    }
    case "checkout": {
      const withConfig = step.with
        ? substituteParamsInObject(step.with, paramMap)
        : undefined;
      const checkoutStep: CheckoutStepNode = {
        kind: "checkout",
        ...(withConfig ? { with: withConfig } : {}),
        span: step.span,
      };
      return checkoutStep;
    }
    case "steps_fragment_spread":
      return step;
  }
}

/**
 * Clone a PromptValue with parameter substitution applied.
 */
function clonePromptWithParams(prompt: PromptValue, paramMap: Map<string, string>): PromptValue {
  switch (prompt.kind) {
    case "literal":
      return { kind: "literal", value: substituteParams(prompt.value, paramMap) };
    case "file":
      return { kind: "file", path: substituteParams(prompt.path, paramMap) };
    case "template":
      return { kind: "template", content: substituteParams(prompt.content, paramMap) };
  }
}

/**
 * Substitute parameters in an object recursively.
 */
function substituteParamsInObject(
  obj: Record<string, unknown>,
  paramMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = substituteParams(value, paramMap);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? substituteParams(item, paramMap)
          : typeof item === "object" && item !== null
          ? substituteParamsInObject(item as Record<string, unknown>, paramMap)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = substituteParamsInObject(value as Record<string, unknown>, paramMap);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Expand a job fragment instantiation into a regular job.
 */
function expandJobFragmentInstantiation(
  node: JobFragmentInstantiationNode,
  fragmentRegistry: FragmentRegistry,
  workflowName: string,
  registry?: TypeRegistry
): JobIR | null {
  const fragment = fragmentRegistry.getJobFragment(node.fragmentName);
  if (!fragment) {
    return null;
  }

  const paramMap = buildParamMap(node.arguments);

  for (const param of fragment.params) {
    if (param.defaultValue && !paramMap.has(param.name)) {
      paramMap.set(param.name, expressionToString(param.defaultValue));
    }
  }

  const clonedSteps = fragment.steps.map((step) => cloneStepWithParams(step, paramMap));

  const expandedJob: JobNode = {
    kind: "job",
    name: node.name,
    runsOn: fragment.runsOn,
    needs: fragment.needs,
    condition: fragment.condition,
    outputs: fragment.outputs,
    steps: clonedSteps,
    span: node.span,
  };

  return transformRegularJob(expandedJob, workflowName, registry);
}

/**
 * Expand a steps fragment spread into a list of steps.
 */
function expandStepsFragmentSpread(
  node: StepsFragmentSpreadNode,
  fragmentRegistry: FragmentRegistry
): StepNode[] {
  const fragment = fragmentRegistry.getStepsFragment(node.fragmentName);
  if (!fragment) {
    return [];
  }

  const paramMap = buildParamMap(node.arguments);

  for (const param of fragment.params) {
    if (param.defaultValue && !paramMap.has(param.name)) {
      paramMap.set(param.name, expressionToString(param.defaultValue));
    }
  }

  return fragment.steps.map((step) => cloneStepWithParams(step, paramMap));
}

/**
 * Transform steps, expanding any steps fragment spreads.
 */
function transformStepsWithFragments(
  steps: readonly StepNode[],
  fragmentRegistry: FragmentRegistry | undefined,
  workflowName: string,
  jobName: string,
  matrixContext?: MatrixContext,
  registry?: TypeRegistry
): StepIR[] {
  const result: StepIR[] = [];

  for (const step of steps) {
    if (step.kind === "steps_fragment_spread" && fragmentRegistry) {
      const expandedSteps = expandStepsFragmentSpread(step, fragmentRegistry);
      for (const expandedStep of expandedSteps) {
        const transformed = transformStep(expandedStep, workflowName, jobName, matrixContext, registry);
        result.push(...transformed);
      }
    } else {
      const transformed = transformStep(step, workflowName, jobName, matrixContext, registry);
      result.push(...transformed);
    }
  }

  return result;
}

/**
 * Transform a job declaration (either concrete or fragment instantiation).
 */
function transformJobDecl(
  job: AnyJobDeclNode,
  workflowName: string,
  fragmentRegistry: FragmentRegistry | undefined,
  registry?: TypeRegistry
): { name: string; ir: JobIR } | null {
  if (isFragmentInstantiation(job)) {
    if (!fragmentRegistry) {
      return null;
    }
    const ir = expandJobFragmentInstantiation(job, fragmentRegistry, workflowName, registry);
    if (!ir) {
      return null;
    }
    return { name: job.name, ir };
  }

  return { name: job.name, ir: transformJob(job, workflowName, registry, fragmentRegistry) };
}

export function transform(
  ast: WorkflowNode,
  registry?: TypeRegistry,
  fragmentRegistry?: FragmentRegistry
): WorkflowIR {
  const jobs = new Map<string, JobIR>();

  for (const job of ast.jobs) {
    const result = transformJobDecl(job, ast.name, fragmentRegistry, registry);
    if (result) {
      jobs.set(result.name, result.ir);
    }
  }

  for (const cycle of ast.cycles) {
    const cycleJobs = transformCycle(cycle, ast, registry, fragmentRegistry);
    for (const [name, jobIR] of cycleJobs) {
      jobs.set(name, jobIR);
    }
  }

  const trigger =
    ast.cycles.length > 0
      ? mergeTriggerWithDispatch(ast.trigger, ast.cycles)
      : transformTrigger(ast.trigger);

  return {
    name: ast.name,
    on: trigger,
    jobs,
    concurrency: generateConcurrency(ast.cycles),
  };
}
