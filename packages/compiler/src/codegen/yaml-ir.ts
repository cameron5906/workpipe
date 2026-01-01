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

export type MatrixCombinationIR = Record<string, string | number | boolean>;

export interface MatrixStrategyIR {
  readonly matrix: Record<string, readonly (string | number)[]>;
  readonly include?: readonly MatrixCombinationIR[];
  readonly exclude?: readonly MatrixCombinationIR[];
  readonly "max-parallel"?: number;
  readonly "fail-fast"?: boolean;
}

export interface JobIR {
  readonly runsOn: string;
  readonly needs?: readonly string[];
  readonly if?: string;
  readonly outputs?: Record<string, string>;
  readonly strategy?: MatrixStrategyIR;
  readonly steps: readonly StepIR[];
}

export type StepIR =
  | RunStepIR
  | ShellStepIR
  | UsesStepIR
  | UsesWithStepIR
  | ClaudeCodeStepIR
  | UploadArtifactStepIR
  | DownloadArtifactStepIR
  | ScriptStepIR;

export interface RunStepIR {
  readonly kind: "run";
  readonly id?: string;
  readonly command: string;
}

export interface ShellStepIR {
  readonly kind: "shell";
  readonly id?: string;
  readonly run: string;
  readonly multiline: boolean;
}

export interface UsesStepIR {
  readonly kind: "uses";
  readonly id?: string;
  readonly action: string;
}

export interface UsesWithStepIR {
  readonly kind: "uses_with";
  readonly id?: string;
  readonly action: string;
  readonly with: Record<string, unknown>;
}

export interface ClaudeCodeStepIR {
  readonly kind: "claude_code";
  readonly id?: string;
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
  readonly id?: string;
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
