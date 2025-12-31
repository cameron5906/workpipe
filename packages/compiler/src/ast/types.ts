export interface Span {
  readonly start: number;
  readonly end: number;
}

export type OutputType = 'string' | 'int' | 'float' | 'bool' | 'json' | 'path';

export interface OutputDeclaration {
  readonly name: string;
  readonly type: OutputType;
  readonly span: Span;
}

export interface WorkflowNode {
  readonly kind: "workflow";
  readonly name: string;
  readonly trigger: TriggerNode | null;
  readonly jobs: readonly AnyJobNode[];
  readonly cycles: readonly CycleNode[];
  readonly span: Span;
}

export interface TriggerNode {
  readonly kind: "trigger";
  readonly events: readonly string[];
  readonly span: Span;
}

export interface JobNode {
  readonly kind: "job";
  readonly name: string;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly condition: ExpressionNode | null;
  readonly outputs: readonly OutputDeclaration[];
  readonly steps: readonly StepNode[];
  readonly span: Span;
}

export type StepNode = RunStepNode | UsesStepNode | AgentTaskNode | GuardJsStepNode;

export interface RunStepNode {
  readonly kind: "run";
  readonly command: string;
  readonly span: Span;
}

export interface UsesStepNode {
  readonly kind: "uses";
  readonly action: string;
  readonly span: Span;
}

export interface GuardJsStepNode {
  readonly kind: "guard_js_step";
  readonly id: string;
  readonly code: string;
  readonly span: Span;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | PropertyAccessNode
  | StringLiteralNode
  | BooleanLiteralNode;

export interface BinaryExpressionNode {
  readonly kind: "binary";
  readonly operator: "==" | "!=";
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
  readonly span: Span;
}

export interface PropertyAccessNode {
  readonly kind: "property";
  readonly path: readonly string[];
  readonly span: Span;
}

export interface StringLiteralNode {
  readonly kind: "string";
  readonly value: string;
  readonly span: Span;
}

export interface BooleanLiteralNode {
  readonly kind: "boolean";
  readonly value: boolean;
  readonly span: Span;
}

// Matrix job node
export interface MatrixJobNode {
  readonly kind: "matrix_job";
  readonly name: string;
  readonly axes: Record<string, readonly (string | number)[]>;
  readonly maxParallel?: number;
  readonly failFast?: boolean;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly condition: ExpressionNode | null;
  readonly outputs: readonly OutputDeclaration[];
  readonly steps: readonly StepNode[];
  readonly span: Span;
}

// Union for all job types
export type AnyJobNode = JobNode | AgentJobNode | MatrixJobNode;

// Agent job node
export interface AgentJobNode {
  readonly kind: "agent_job";
  readonly name: string;
  readonly after?: string;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly outputs: readonly OutputDeclaration[];
  readonly steps: readonly StepNode[];
  readonly consumes: readonly ConsumeNode[];
  readonly span: Span;
}

// Agent task step node
export interface AgentTaskNode {
  readonly kind: "agent_task";
  readonly taskDescription: string;
  readonly model?: string;
  readonly maxTurns?: number;
  readonly tools?: ToolsConfig;
  readonly mcp?: McpConfig;
  readonly systemPrompt?: PromptValue;
  readonly prompt?: PromptValue;
  readonly outputSchema?: string | SchemaObjectNode;
  readonly outputArtifact?: string;
  readonly consumes: readonly ConsumeNode[];
  readonly span: Span;
}

// Tools configuration
export interface ToolsConfig {
  readonly allowed?: readonly string[];
  readonly disallowed?: readonly string[];
  readonly strict?: boolean;
}

// MCP configuration
export interface McpConfig {
  readonly configFile?: string;
  readonly allowed?: readonly string[];
  readonly disallowed?: readonly string[];
}

// Prompt value variants
export type PromptValue =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "template"; readonly content: string };

// Consume declaration
export interface ConsumeNode {
  readonly kind: "consume";
  readonly name: string;
  readonly source: string;
  readonly span: Span;
}

// Cycle node
export interface CycleNode {
  readonly kind: "cycle";
  readonly name: string;
  readonly maxIters: number | null;
  readonly key: string | null;
  readonly until: GuardJsNode | null;
  readonly body: CycleBodyNode;
  readonly span: Span;
}

// Cycle body node
export interface CycleBodyNode {
  readonly kind: "cycle_body";
  readonly jobs: readonly AnyJobNode[];
  readonly span: Span;
}

// Guard JS node
export interface GuardJsNode {
  readonly kind: "guard_js";
  readonly code: string;
  readonly span: Span;
}

// Schema type can be a primitive, array, object, union, or string literal
export type SchemaTypeNode =
  | SchemaPrimitiveNode
  | SchemaArrayNode
  | SchemaObjectNode
  | SchemaUnionNode
  | SchemaStringLiteralNode
  | SchemaNullNode;

export interface SchemaPrimitiveNode {
  readonly kind: "primitive";
  readonly type: "string" | "int" | "float" | "bool";
  readonly span: Span;
}

export interface SchemaArrayNode {
  readonly kind: "array";
  readonly elementType: SchemaTypeNode;
  readonly span: Span;
}

export interface SchemaObjectNode {
  readonly kind: "object";
  readonly fields: readonly SchemaFieldNode[];
  readonly span: Span;
}

export interface SchemaFieldNode {
  readonly name: string;
  readonly type: SchemaTypeNode;
  readonly span: Span;
}

export interface SchemaUnionNode {
  readonly kind: "union";
  readonly types: readonly SchemaTypeNode[];
  readonly span: Span;
}

export interface SchemaStringLiteralNode {
  readonly kind: "stringLiteral";
  readonly value: string;
  readonly span: Span;
}

export interface SchemaNullNode {
  readonly kind: "null";
  readonly span: Span;
}
