export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface ImportDeclarationNode {
  readonly kind: "import_declaration";
  readonly items: readonly ImportItemNode[];
  readonly path: string;
  readonly span: Span;
}

export interface ImportItemNode {
  readonly kind: "import_item";
  readonly name: string;
  readonly alias?: string;
  readonly span: Span;
}

export type OutputType = 'string' | 'int' | 'float' | 'bool' | 'json' | 'path';

export interface OutputDeclaration {
  readonly name: string;
  readonly type: OutputType | string;
  readonly typeReference?: string;
  readonly span: Span;
}

export interface WorkflowNode {
  readonly kind: "workflow";
  readonly name: string;
  readonly trigger: TriggerNode | null;
  readonly jobs: readonly AnyJobDeclNode[];
  readonly cycles: readonly CycleNode[];
  readonly span: Span;
}

export interface WorkPipeFileNode {
  readonly kind: "file";
  readonly imports: readonly ImportDeclarationNode[];
  readonly types: readonly TypeDeclarationNode[];
  readonly jobFragments: readonly JobFragmentNode[];
  readonly stepsFragments: readonly StepsFragmentNode[];
  readonly workflows: readonly WorkflowNode[];
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

export type StepNode =
  | RunStepNode
  | ShellStepNode
  | UsesStepNode
  | UsesBlockStepNode
  | AgentTaskNode
  | GuardJsStepNode
  | StepsFragmentSpreadNode
  | CheckoutStepNode;

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

export interface ShellStepNode {
  readonly kind: "shell";
  readonly content: string;
  readonly multiline: boolean;
  readonly span: Span;
}

export interface UsesBlockStepNode {
  readonly kind: "uses_block";
  readonly action: string;
  readonly with?: Record<string, unknown>;
  readonly span: Span;
}

export interface CheckoutStepNode {
  readonly kind: "checkout";
  readonly with?: Record<string, unknown>;
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
  | BooleanLiteralNode
  | NumericLiteralNode;

export interface BinaryExpressionNode {
  readonly kind: "binary";
  readonly operator: "==" | "!=" | "<" | ">" | "<=" | ">=" | "+" | "-" | "*" | "/";
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

export interface NumericLiteralNode {
  readonly kind: "number";
  readonly value: number;
  readonly isFloat: boolean;
  readonly span: Span;
}

// Matrix combination type for include/exclude
export type MatrixCombination = Record<string, string | number | boolean>;

// Matrix job node
export interface MatrixJobNode {
  readonly kind: "matrix_job";
  readonly name: string;
  readonly axes: Record<string, readonly (string | number)[]>;
  readonly include?: readonly MatrixCombination[];
  readonly exclude?: readonly MatrixCombination[];
  readonly maxParallel?: number;
  readonly failFast?: boolean;
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly condition: ExpressionNode | null;
  readonly outputs: readonly OutputDeclaration[];
  readonly steps: readonly StepNode[];
  readonly span: Span;
}

// Union for all concrete job types (jobs with steps, not fragment instantiations)
export type AnyJobNode = JobNode | AgentJobNode | MatrixJobNode;

// Union for all job declarations including fragment instantiations (used during parsing)
export type AnyJobDeclNode = AnyJobNode | JobFragmentInstantiationNode;

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
  readonly jobs: readonly AnyJobDeclNode[];
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

export interface TypeDeclarationNode {
  readonly kind: "type_declaration";
  readonly name: string;
  readonly fields: readonly TypeFieldNode[];
  readonly span: Span;
}

export interface TypeFieldNode {
  readonly kind: "type_field";
  readonly name: string;
  readonly type: TypeExpressionNode;
  readonly span: Span;
}

export type TypeExpressionNode =
  | PrimitiveTypeNode
  | TypeReferenceNode
  | ArrayTypeNode
  | ObjectTypeNode
  | UnionTypeNode
  | StringLiteralTypeNode
  | NullTypeNode;

export interface PrimitiveTypeNode {
  readonly kind: "primitive_type";
  readonly type: "string" | "int" | "float" | "bool" | "json" | "path";
  readonly span: Span;
}

export interface TypeReferenceNode {
  readonly kind: "type_reference";
  readonly name: string;
  readonly span: Span;
}

export interface ArrayTypeNode {
  readonly kind: "array_type";
  readonly elementType: TypeExpressionNode;
  readonly span: Span;
}

export interface ObjectTypeNode {
  readonly kind: "object_type";
  readonly fields: readonly TypeFieldNode[];
  readonly span: Span;
}

export interface UnionTypeNode {
  readonly kind: "union_type";
  readonly members: readonly TypeExpressionNode[];
  readonly span: Span;
}

export interface StringLiteralTypeNode {
  readonly kind: "string_literal_type";
  readonly value: string;
  readonly span: Span;
}

export interface NullTypeNode {
  readonly kind: "null_type";
  readonly span: Span;
}

export interface ParamDeclarationNode {
  readonly kind: "param_declaration";
  readonly name: string;
  readonly type: TypeExpressionNode;
  readonly defaultValue: ExpressionNode | null;
  readonly span: Span;
}

export interface JobFragmentNode {
  readonly kind: "job_fragment";
  readonly name: string;
  readonly params: readonly ParamDeclarationNode[];
  readonly runsOn: string | null;
  readonly needs: readonly string[];
  readonly condition: ExpressionNode | null;
  readonly outputs: readonly OutputDeclaration[];
  readonly steps: readonly StepNode[];
  readonly span: Span;
}

export interface StepsFragmentNode {
  readonly kind: "steps_fragment";
  readonly name: string;
  readonly params: readonly ParamDeclarationNode[];
  readonly steps: readonly StepNode[];
  readonly span: Span;
}

export interface ParamArgumentNode {
  readonly kind: "param_argument";
  readonly name: string;
  readonly value: ExpressionNode;
  readonly span: Span;
}

export interface JobFragmentInstantiationNode {
  readonly kind: "job_fragment_instantiation";
  readonly name: string;
  readonly fragmentName: string;
  readonly arguments: readonly ParamArgumentNode[];
  readonly span: Span;
}

export interface StepsFragmentSpreadNode {
  readonly kind: "steps_fragment_spread";
  readonly fragmentName: string;
  readonly arguments: readonly ParamArgumentNode[];
  readonly span: Span;
}

export function isConcreteJob(job: AnyJobDeclNode): job is AnyJobNode {
  return job.kind !== "job_fragment_instantiation";
}

export function isFragmentInstantiation(job: AnyJobDeclNode): job is JobFragmentInstantiationNode {
  return job.kind === "job_fragment_instantiation";
}
