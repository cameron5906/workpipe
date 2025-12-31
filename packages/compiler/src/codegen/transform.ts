import type {
  WorkflowNode,
  JobNode,
  AnyJobNode,
  AgentJobNode,
  MatrixJobNode,
  StepNode,
  AgentTaskNode,
  GuardJsStepNode,
  ExpressionNode,
  PromptValue,
  CycleNode,
  SchemaTypeNode,
  SchemaObjectNode,
  TypeDeclarationNode,
  TypeExpressionNode,
  TypeFieldNode,
} from "../ast/types.js";
import type { TypeRegistry } from "../semantics/type-registry.js";
import type {
  WorkflowIR,
  TriggerIR,
  JobIR,
  StepIR,
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
    case "agent_task":
      return transformAgentTask(step, workflowName, jobName, matrixContext, registry);
    case "guard_js_step":
      return transformGuardJsStep(step);
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

function transformRegularJob(job: JobNode, workflowName: string, registry?: TypeRegistry): JobIR {
  const steps: StepIR[] = [];
  for (const step of job.steps) {
    const transformed = transformStep(step, workflowName, job.name, undefined, registry);
    steps.push(...transformed);
  }

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
    userOutputs[output.name] = `\${{ steps.set_outputs.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformAgentJob(job: AgentJobNode, workflowName: string, registry?: TypeRegistry): JobIR {
  const steps: StepIR[] = [];
  for (const step of job.steps) {
    const transformed = transformStep(step, workflowName, job.name, undefined, registry);
    steps.push(...transformed);
  }

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
    userOutputs[output.name] = `\${{ steps.set_outputs.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformMatrixJob(job: MatrixJobNode, workflowName: string, registry?: TypeRegistry): JobIR {
  const matrixContext: MatrixContext = { axes: job.axes };
  const steps: StepIR[] = [];
  for (const step of job.steps) {
    const transformed = transformStep(step, workflowName, job.name, matrixContext, registry);
    steps.push(...transformed);
  }

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
    userOutputs[output.name] = `\${{ steps.set_outputs.outputs.${output.name} }}`;
  }

  const mergedOutputs = { ...guardOutputs, ...userOutputs };
  if (Object.keys(mergedOutputs).length > 0) {
    (result as { outputs: Record<string, string> }).outputs = mergedOutputs;
  }

  return result;
}

function transformJob(job: AnyJobNode, workflowName: string, registry?: TypeRegistry): JobIR {
  if (job.kind === "agent_job") {
    return transformAgentJob(job, workflowName, registry);
  }
  if (job.kind === "matrix_job") {
    return transformMatrixJob(job, workflowName, registry);
  }
  return transformRegularJob(job, workflowName, registry);
}

function transformCycleBodyJob(
  job: AnyJobNode,
  workflowName: string,
  cycleName: string,
  hydrateJobName: string,
  registry?: TypeRegistry
): JobIR {
  const baseJob = transformJob(job, workflowName, registry);

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
  registry?: TypeRegistry
): Map<string, JobIR> {
  const jobs = new Map<string, JobIR>();
  const cycleName = cycle.name;
  const stateArtifactName = `${cycleName}-state`;
  const keyName = cycle.key ?? "phase";

  const hydrateJobName = `${cycleName}_hydrate`;
  jobs.set(hydrateJobName, createHydrateJob(cycleName, stateArtifactName, keyName));

  const bodyJobNames: string[] = [];
  for (const bodyJob of cycle.body.jobs) {
    const jobName = `${cycleName}_body_${bodyJob.name}`;
    bodyJobNames.push(jobName);

    const transformedJob = transformCycleBodyJob(
      bodyJob,
      workflow.name,
      cycleName,
      hydrateJobName,
      registry
    );

    const needsWithCyclePrefix = (bodyJob.needs ?? []).map((need) => {
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

export function transform(ast: WorkflowNode, registry?: TypeRegistry): WorkflowIR {
  const jobs = new Map<string, JobIR>();

  for (const job of ast.jobs) {
    jobs.set(job.name, transformJob(job, ast.name, registry));
  }

  for (const cycle of ast.cycles) {
    const cycleJobs = transformCycle(cycle, ast, registry);
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
