export type {
  WorkflowIR,
  TriggerIR,
  JobIR,
  StepIR,
  RunStepIR,
  ShellStepIR,
  UsesStepIR,
  UsesWithStepIR,
  ClaudeCodeStepIR,
  UploadArtifactStepIR,
  DownloadArtifactStepIR,
  ScriptStepIR,
  WorkflowDispatchInputIR,
} from "./yaml-ir.js";

export { transform, transformCycle, serializeExpression, inlineSchemaToJsonSchema, typeDeclarationToJsonSchema, generateMatrixFingerprint, stripCommonIndent, substituteParams } from "./transform.js";
export type { JsonSchema } from "./transform.js";
export { emit } from "./emit.js";
