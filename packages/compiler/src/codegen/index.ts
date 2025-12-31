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

export { transform, transformCycle, serializeExpression } from "./transform.js";
export { emit } from "./emit.js";
