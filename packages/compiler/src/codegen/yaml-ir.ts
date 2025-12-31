export interface ConcurrencyIR {
  readonly group: string;
  readonly "cancel-in-progress": boolean;
}

export interface WorkflowIR {
  readonly name: string;
  readonly on: TriggerIR;
  readonly jobs: Map<string, JobIR>;
  readonly concurrency?: ConcurrencyIR;
}

export interface WorkflowDispatchInputIR {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  readonly default?: string;
}

export interface TriggerIR {
  readonly events: readonly string[];
  readonly workflowDispatch?: {
    readonly inputs: readonly WorkflowDispatchInputIR[];
  };
}

export interface JobIR {
  readonly runsOn: string;
  readonly needs?: readonly string[];
  readonly if?: string;
  readonly outputs?: Record<string, string>;
  readonly steps: readonly StepIR[];
}

export type StepIR =
  | RunStepIR
  | UsesStepIR
  | ClaudeCodeStepIR
  | UploadArtifactStepIR
  | DownloadArtifactStepIR
  | ScriptStepIR;

export interface RunStepIR {
  readonly kind: "run";
  readonly command: string;
}

export interface UsesStepIR {
  readonly kind: "uses";
  readonly action: string;
}

export interface ClaudeCodeStepIR {
  readonly kind: "claude_code";
  readonly name: string;
  readonly uses: "anthropics/claude-code-action@v1";
  readonly with: {
    readonly prompt: string;
    readonly allowed_tools?: string;
    readonly disallowed_tools?: string;
    readonly max_turns?: number;
    readonly model?: string;
    readonly output_schema?: object;
  };
}

export interface UploadArtifactStepIR {
  readonly kind: "upload_artifact";
  readonly name: string;
  readonly uses: "actions/upload-artifact@v4";
  readonly with: {
    readonly name: string;
    readonly path: string;
  };
}

export interface DownloadArtifactStepIR {
  readonly kind: "download_artifact";
  readonly name: string;
  readonly id?: string;
  readonly if?: string;
  readonly uses: "actions/download-artifact@v4";
  readonly with: {
    readonly name: string;
    readonly path: string;
    readonly "run-id"?: string;
    readonly "github-token"?: string;
  };
}

export interface ScriptStepIR {
  readonly kind: "script";
  readonly name: string;
  readonly id?: string;
  readonly if?: string;
  readonly run: string;
  readonly shell?: string;
  readonly env?: Record<string, string>;
}
