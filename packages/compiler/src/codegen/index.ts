export type {
  WorkflowIR,
  TriggerIR,
  JobIR,
  StepIR,
  RunStepIR,
  UsesStepIR,
  ClaudeCodeStepIR,
  UploadArtifactStepIR,
  DownloadArtifactStepIR,
  ScriptStepIR,
  WorkflowDispatchInputIR,
} from "./yaml-ir.js";

export { transform, transformCycle, serializeExpression, inlineSchemaToJsonSchema } from "./transform.js";
export type { JsonSchema } from "./transform.js";
export { emit } from "./emit.js";
