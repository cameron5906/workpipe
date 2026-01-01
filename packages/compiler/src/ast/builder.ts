import type { Tree, TreeCursor } from "@lezer/common";
import * as terms from "@workpipe/lang";

const {
  WorkflowDecl,
  Identifier,
  WorkflowBody,
  OnClause,
  TriggerSpec,
  EventName,
  EventList,
  JobDecl,
  JobBody,
  JobProperty,
  RunsOnProperty,
  RunnerSpec,
  NeedsProperty,
  NeedsSpec,
  IdentifierList,
  IfProperty,
  Expression,
  ComparisonExpr,
  PrimaryExpr,
  PropertyAccess,
  String: StringTerm,
  Boolean: BooleanTerm,
  ComparisonOp,
  OutputsProperty,
  OutputsBlock,
  OutputDecl,
  OutputType: OutputTypeTerm,
  TypeReference: TypeReferenceTerm,
  TypeName,
  StepsProperty,
  StepList,
  Step,
  RunStep,
  UsesStep,
  AgentJobDecl,
  AfterClause,
  AgentTaskStep,
  AgentTaskBody,
  AgentTaskProperty,
  ModelProperty,
  MaxTurnsProperty,
  ToolsProperty,
  ToolsBlock,
  ToolsBlockProperty,
  AllowedProperty,
  DisallowedProperty,
  StrictProperty,
  StringList,
  StringListItems,
  StringListOrAll,
  McpProperty,
  McpBlock,
  McpBlockProperty,
  ConfigFileProperty,
  SystemPromptProperty,
  PromptProperty,
  PromptValue: PromptValueTerm,
  FileReference,
  TemplateReference,
  OutputSchemaProperty,
  OutputArtifactProperty,
  ConsumesProperty,
  ConsumesBlock,
  ConsumesItem,
  Number: NumberTerm,
  CycleDecl,
  CycleBody,
  CycleProperty,
  MaxItersProperty,
  KeyProperty,
  UntilProperty,
  GuardJs,
  TripleQuotedString,
  BodyBlock,
  InlineSchema,
  SchemaField,
  SchemaType,
  UnionType,
  NonUnionSchemaType,
  ArrayType,
  ObjectType,
  SchemaPrimitiveType,
  NullType,
  StringLiteralType,
  GuardJsStep,
  MatrixModifier,
  AxesProperty,
  AxisDecl,
  AxisValueList,
  AxisValue,
  HyphenatedIdentifier,
  MaxParallelProperty,
  FailFastProperty,
  IncludeProperty,
  ExcludeProperty,
  MatrixCombinationList,
  MatrixCombination: MatrixCombinationTerm,
  MatrixCombinationEntryList,
  MatrixCombinationEntry,
  MatrixCombinationValue,
  TypeDecl,
  TypeDeclName,
  TypeField,
  ImportDecl,
  ImportList,
  ImportItem,
  ImportPath,
  StepsBlock,
  BlockStep,
  ShellStep,
  ShellBlock,
  shellContent,
  UsesBlockStep,
  UsesConfigBlock,
  UsesConfigProperty,
  WithProperty,
  ObjectLiteral,
  ObjectPropertyList,
  ObjectProperty,
  ObjectPropertyKey,
  ObjectValue,
  ArrayLiteral,
  ArrayItems,
  FragmentDecl,
  JobFragmentDecl,
  StepsFragmentDecl,
  ParamsBlock,
  ParamDecl,
  FragmentInstantiation,
  ParamAssignment,
  StepsFragmentSpread,
} = terms;

import type {
  WorkflowNode,
  WorkPipeFileNode,
  TriggerNode,
  JobNode,
  AnyJobDeclNode,
  AgentJobNode,
  MatrixJobNode,
  MatrixCombination,
  StepNode,
  RunStepNode,
  ShellStepNode,
  UsesStepNode,
  UsesBlockStepNode,
  AgentTaskNode,
  GuardJsStepNode,
  ToolsConfig,
  McpConfig,
  PromptValue,
  ConsumeNode,
  ExpressionNode,
  BinaryExpressionNode,
  PropertyAccessNode,
  StringLiteralNode,
  BooleanLiteralNode,
  Span,
  CycleNode,
  CycleBodyNode,
  GuardJsNode,
  OutputDeclaration,
  OutputType,
  SchemaTypeNode,
  SchemaPrimitiveNode,
  SchemaArrayNode,
  SchemaObjectNode,
  SchemaFieldNode,
  SchemaUnionNode,
  SchemaStringLiteralNode,
  SchemaNullNode,
  TypeDeclarationNode,
  TypeFieldNode,
  TypeExpressionNode,
  PrimitiveTypeNode,
  TypeReferenceNode,
  ArrayTypeNode,
  ObjectTypeNode,
  UnionTypeNode,
  StringLiteralTypeNode,
  NullTypeNode,
  ImportDeclarationNode,
  ImportItemNode,
  ParamDeclarationNode,
  JobFragmentNode,
  StepsFragmentNode,
  ParamArgumentNode,
  JobFragmentInstantiationNode,
  StepsFragmentSpreadNode,
} from "./types.js";

function span(cursor: TreeCursor): Span {
  return { start: cursor.from, end: cursor.to };
}

function getText(cursor: TreeCursor, source: string): string {
  return source.slice(cursor.from, cursor.to);
}

function unquoteTripleString(quoted: string): string {
  if (quoted.length < 6) return quoted;
  return quoted.slice(3, -3);
}

function unquoteString(quoted: string): string {
  if (quoted.length < 2) return quoted;

  const inner = quoted.slice(1, -1);

  let result = "";
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1];
      switch (next) {
        case '"':
          result += '"';
          break;
        case "\\":
          result += "\\";
          break;
        case "n":
          result += "\n";
          break;
        case "t":
          result += "\t";
          break;
        default:
          result += next;
      }
      i += 2;
    } else {
      result += inner[i];
      i++;
    }
  }

  return result;
}

function findChild(cursor: TreeCursor, nodeType: number): boolean {
  if (!cursor.firstChild()) return false;
  do {
    if (cursor.type.id === nodeType) return true;
  } while (cursor.nextSibling());
  cursor.parent();
  return false;
}

function collectChildren(cursor: TreeCursor, nodeType: number): Span[] {
  const spans: Span[] = [];
  if (!cursor.firstChild()) return spans;
  do {
    if (cursor.type.id === nodeType) {
      spans.push(span(cursor));
    }
  } while (cursor.nextSibling());
  cursor.parent();
  return spans;
}

function buildStringList(cursor: TreeCursor, source: string): string[] {
  const strings: string[] = [];
  if (!cursor.firstChild()) return strings;
  do {
    if (cursor.type.id === StringListItems) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            strings.push(unquoteString(getText(cursor, source)));
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();
  return strings;
}

function buildToolsConfig(cursor: TreeCursor, source: string): ToolsConfig {
  const config: {
    allowed?: string[];
    disallowed?: string[];
    strict?: boolean;
  } = {};

  if (!cursor.firstChild()) return config;
  do {
    if (cursor.type.id === ToolsBlock) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === ToolsBlockProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;
              if (propType === AllowedProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringListOrAll) {
                      const text = getText(cursor, source).trim();
                      if (text === "*") {
                        config.allowed = ["*"];
                      } else if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === StringList) {
                            config.allowed = buildStringList(cursor, source);
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === DisallowedProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringList) {
                      config.disallowed = buildStringList(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === StrictProperty) {
                const strictText = getText(cursor, source);
                if (strictText.includes("true")) {
                  config.strict = true;
                } else if (strictText.includes("false")) {
                  config.strict = false;
                }
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();

  return config;
}

function buildMcpConfig(cursor: TreeCursor, source: string): McpConfig {
  const config: {
    configFile?: string;
    allowed?: string[];
    disallowed?: string[];
  } = {};

  if (!cursor.firstChild()) return config;
  do {
    if (cursor.type.id === McpBlock) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === McpBlockProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;
              if (propType === ConfigFileProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringTerm) {
                      config.configFile = unquoteString(getText(cursor, source));
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === AllowedProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringListOrAll) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === StringList) {
                            config.allowed = buildStringList(cursor, source);
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === DisallowedProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringList) {
                      config.disallowed = buildStringList(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();

  return config;
}

function buildPromptValue(cursor: TreeCursor, source: string): PromptValue | null {
  if (!cursor.firstChild()) return null;

  let result: PromptValue | null = null;
  do {
    if (cursor.type.id === PromptValueTerm) {
      if (cursor.firstChild()) {
        const valueType = cursor.type.id;
        if (valueType === StringTerm) {
          result = {
            kind: "literal",
            value: unquoteString(getText(cursor, source)),
          };
        } else if (valueType === FileReference) {
          if (cursor.firstChild()) {
            do {
              if (cursor.type.id === StringTerm) {
                result = {
                  kind: "file",
                  path: unquoteString(getText(cursor, source)),
                };
              }
            } while (cursor.nextSibling());
            cursor.parent();
          }
        } else if (valueType === TemplateReference) {
          if (cursor.firstChild()) {
            do {
              if (cursor.type.id === StringTerm) {
                result = {
                  kind: "template",
                  content: unquoteString(getText(cursor, source)),
                };
              }
            } while (cursor.nextSibling());
            cursor.parent();
          }
        }
        cursor.parent();
      }
    } else if (cursor.type.id === StringTerm) {
      result = {
        kind: "literal",
        value: unquoteString(getText(cursor, source)),
      };
    } else if (cursor.type.id === FileReference) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            result = {
              kind: "file",
              path: unquoteString(getText(cursor, source)),
            };
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    } else if (cursor.type.id === TemplateReference) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            result = {
              kind: "template",
              content: unquoteString(getText(cursor, source)),
            };
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();

  return result;
}

function buildConsumes(cursor: TreeCursor, source: string): ConsumeNode[] {
  const consumes: ConsumeNode[] = [];

  if (!cursor.firstChild()) return consumes;
  do {
    if (cursor.type.id === ConsumesBlock) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === ConsumesItem) {
            const itemSpan = span(cursor);
            let name = "";
            let sourceRef = "";

            if (cursor.firstChild()) {
              do {
                if (cursor.type.id === Identifier) {
                  name = getText(cursor, source);
                } else if (cursor.type.id === StringTerm) {
                  sourceRef = unquoteString(getText(cursor, source));
                }
              } while (cursor.nextSibling());
              cursor.parent();
            }

            if (name && sourceRef) {
              consumes.push({
                kind: "consume",
                name,
                source: sourceRef,
                span: itemSpan,
              });
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();

  return consumes;
}

function buildSchemaType(cursor: TreeCursor, source: string): SchemaTypeNode | null {
  const nodeType = cursor.type.id;
  const nodeSpan = span(cursor);

  if (nodeType === SchemaType || nodeType === NonUnionSchemaType) {
    if (cursor.firstChild()) {
      const result = buildSchemaType(cursor, source);
      cursor.parent();
      return result;
    }
    return null;
  }

  if (nodeType === UnionType) {
    const types: SchemaTypeNode[] = [];
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === NonUnionSchemaType) {
          const t = buildSchemaType(cursor, source);
          if (t) types.push(t);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    if (types.length === 0) return null;
    const unionNode: SchemaUnionNode = {
      kind: "union",
      types,
      span: nodeSpan,
    };
    return unionNode;
  }

  if (nodeType === ArrayType) {
    if (cursor.firstChild()) {
      let elementType: SchemaTypeNode | null = null;
      do {
        if (cursor.type.id === SchemaType || cursor.type.id === NonUnionSchemaType ||
            cursor.type.id === UnionType || cursor.type.id === ArrayType ||
            cursor.type.id === ObjectType || cursor.type.id === SchemaPrimitiveType ||
            cursor.type.id === NullType || cursor.type.id === StringLiteralType) {
          elementType = buildSchemaType(cursor, source);
        }
      } while (cursor.nextSibling());
      cursor.parent();
      if (elementType) {
        const arrayNode: SchemaArrayNode = {
          kind: "array",
          elementType,
          span: nodeSpan,
        };
        return arrayNode;
      }
    }
    return null;
  }

  if (nodeType === ObjectType) {
    const fields: SchemaFieldNode[] = [];
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === SchemaField) {
          const field = buildSchemaField(cursor, source);
          if (field) fields.push(field);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    const objectNode: SchemaObjectNode = {
      kind: "object",
      fields,
      span: nodeSpan,
    };
    return objectNode;
  }

  if (nodeType === SchemaPrimitiveType) {
    const typeText = getText(cursor, source);
    if (typeText === "string" || typeText === "int" || typeText === "float" || typeText === "bool") {
      const primitiveNode: SchemaPrimitiveNode = {
        kind: "primitive",
        type: typeText,
        span: nodeSpan,
      };
      return primitiveNode;
    }
    return null;
  }

  if (nodeType === NullType || cursor.name === "NullType") {
    const nullNode: SchemaNullNode = {
      kind: "null",
      span: nodeSpan,
    };
    return nullNode;
  }

  if (nodeType === StringLiteralType) {
    if (cursor.firstChild()) {
      let value = "";
      do {
        if (cursor.type.id === StringTerm) {
          value = unquoteString(getText(cursor, source));
        }
      } while (cursor.nextSibling());
      cursor.parent();
      const stringLiteralNode: SchemaStringLiteralNode = {
        kind: "stringLiteral",
        value,
        span: nodeSpan,
      };
      return stringLiteralNode;
    }
    return null;
  }

  return null;
}

function buildSchemaField(cursor: TreeCursor, source: string): SchemaFieldNode | null {
  if (cursor.type.id !== SchemaField) return null;

  const fieldSpan = span(cursor);
  let name = "";
  let type: SchemaTypeNode | null = null;

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === Identifier) {
      name = getText(cursor, source);
    } else if (cursor.type.id === SchemaType || cursor.type.id === NonUnionSchemaType ||
               cursor.type.id === UnionType || cursor.type.id === ArrayType ||
               cursor.type.id === ObjectType || cursor.type.id === SchemaPrimitiveType ||
               cursor.type.id === NullType || cursor.type.id === StringLiteralType) {
      type = buildSchemaType(cursor, source);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name || !type) return null;

  return {
    name,
    type,
    span: fieldSpan,
  };
}

function buildInlineSchema(cursor: TreeCursor, source: string): SchemaObjectNode | null {
  if (cursor.type.id !== InlineSchema) return null;

  const schemaSpan = span(cursor);
  const fields: SchemaFieldNode[] = [];

  if (!cursor.firstChild()) {
    return { kind: "object", fields: [], span: schemaSpan };
  }

  do {
    if (cursor.type.id === SchemaField) {
      const field = buildSchemaField(cursor, source);
      if (field) fields.push(field);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "object",
    fields,
    span: schemaSpan,
  };
}

const PRIMITIVE_OUTPUT_TYPES = new Set(["string", "int", "float", "bool", "json", "path"]);

function isPrimitiveOutputType(name: string): name is OutputType {
  return PRIMITIVE_OUTPUT_TYPES.has(name);
}

function buildOutputs(cursor: TreeCursor, source: string): OutputDeclaration[] {
  const outputs: OutputDeclaration[] = [];

  if (!cursor.firstChild()) return outputs;
  do {
    if (cursor.type.id === OutputsBlock) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === OutputDecl) {
            const declSpan = span(cursor);
            let name = "";
            let outputType: OutputType | string = "string";
            let typeReference: string | undefined;

            if (cursor.firstChild()) {
              do {
                if (cursor.type.id === Identifier) {
                  name = getText(cursor, source);
                } else if (cursor.type.id === OutputTypeTerm) {
                  if (cursor.firstChild()) {
                    const typeText = getText(cursor, source);
                    if (isPrimitiveOutputType(typeText)) {
                      outputType = typeText;
                    } else {
                      outputType = typeText;
                      typeReference = typeText;
                    }
                    cursor.parent();
                  }
                } else if (cursor.type.id === TypeReferenceTerm) {
                  if (cursor.firstChild()) {
                    do {
                      if (cursor.type.id === TypeName) {
                        const typeText = getText(cursor, source);
                        if (isPrimitiveOutputType(typeText)) {
                          outputType = typeText;
                        } else {
                          outputType = typeText;
                          typeReference = typeText;
                        }
                      }
                    } while (cursor.nextSibling());
                    cursor.parent();
                  }
                } else if (cursor.name === "TypeName") {
                  const typeText = getText(cursor, source);
                  if (isPrimitiveOutputType(typeText)) {
                    outputType = typeText;
                  } else {
                    outputType = typeText;
                    typeReference = typeText;
                  }
                }
              } while (cursor.nextSibling());
              cursor.parent();
            }

            if (name) {
              outputs.push({
                name,
                type: outputType,
                ...(typeReference ? { typeReference } : {}),
                span: declSpan,
              });
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());
  cursor.parent();

  return outputs;
}

function buildAgentTask(cursor: TreeCursor, source: string): AgentTaskNode | null {
  if (cursor.type.id !== AgentTaskStep) return null;

  const taskSpan = span(cursor);
  let taskDescription = "";
  let model: string | undefined;
  let maxTurns: number | undefined;
  let tools: ToolsConfig | undefined;
  let mcpConfig: McpConfig | undefined;
  let systemPrompt: PromptValue | undefined;
  let promptValue: PromptValue | undefined;
  let outputSchema: string | SchemaObjectNode | undefined;
  let outputArtifact: string | undefined;
  const consumes: ConsumeNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === StringTerm) {
      taskDescription = unquoteString(getText(cursor, source));
    } else if (nodeType === AgentTaskBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === AgentTaskProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;

              if (propType === ModelProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringTerm) {
                      model = unquoteString(getText(cursor, source));
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === MaxTurnsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NumberTerm) {
                      maxTurns = parseInt(getText(cursor, source), 10);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === ToolsProperty) {
                tools = buildToolsConfig(cursor, source);
              } else if (propType === McpProperty) {
                mcpConfig = buildMcpConfig(cursor, source);
              } else if (propType === SystemPromptProperty) {
                systemPrompt = buildPromptValue(cursor, source) ?? undefined;
              } else if (propType === PromptProperty) {
                promptValue = buildPromptValue(cursor, source) ?? undefined;
              } else if (propType === OutputSchemaProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringTerm) {
                      outputSchema = unquoteString(getText(cursor, source));
                    } else if (cursor.type.id === InlineSchema) {
                      outputSchema = buildInlineSchema(cursor, source) ?? undefined;
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === OutputArtifactProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringTerm) {
                      outputArtifact = unquoteString(getText(cursor, source));
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === ConsumesProperty) {
                consumes.push(...buildConsumes(cursor, source));
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  const taskNode: AgentTaskNode = {
    kind: "agent_task",
    taskDescription,
    model,
    maxTurns,
    tools,
    mcp: mcpConfig,
    systemPrompt,
    prompt: promptValue,
    outputSchema,
    outputArtifact,
    consumes,
    span: taskSpan,
  };
  return taskNode;
}

function buildExpression(cursor: TreeCursor, source: string): ExpressionNode | null {
  const nodeType = cursor.type.id;

  if (nodeType === PrimaryExpr) {
    if (cursor.firstChild()) {
      const result = buildExpression(cursor, source);
      cursor.parent();
      return result;
    }
    return null;
  }

  if (nodeType === Expression || nodeType === ComparisonExpr) {
    if (!cursor.firstChild()) return null;

    const leftExpr = buildExpression(cursor, source);
    if (!leftExpr) {
      cursor.parent();
      return null;
    }

    if (!cursor.nextSibling()) {
      cursor.parent();
      return leftExpr;
    }

    if (cursor.type.id === ComparisonOp) {
      const operator = getText(cursor, source) as "==" | "!=";
      const opSpan = span(cursor);

      if (!cursor.nextSibling()) {
        cursor.parent();
        return leftExpr;
      }

      const rightExpr = buildExpression(cursor, source);
      cursor.parent();

      if (!rightExpr) return leftExpr;

      const binaryNode: BinaryExpressionNode = {
        kind: "binary",
        operator,
        left: leftExpr,
        right: rightExpr,
        span: { start: leftExpr.span.start, end: rightExpr.span.end },
      };
      return binaryNode;
    }

    cursor.parent();
    return leftExpr;
  }

  if (nodeType === PropertyAccess) {
    const nodeSpan = span(cursor);
    const fullText = getText(cursor, source);
    const path = fullText.split(".");

    const propNode: PropertyAccessNode = {
      kind: "property",
      path,
      span: nodeSpan,
    };
    return propNode;
  }

  if (nodeType === StringTerm) {
    const raw = getText(cursor, source);
    const strNode: StringLiteralNode = {
      kind: "string",
      value: unquoteString(raw),
      span: span(cursor),
    };
    return strNode;
  }

  if (nodeType === BooleanTerm) {
    const raw = getText(cursor, source);
    const boolNode: BooleanLiteralNode = {
      kind: "boolean",
      value: raw === "true",
      span: span(cursor),
    };
    return boolNode;
  }

  if (cursor.firstChild()) {
    const result = buildExpression(cursor, source);
    cursor.parent();
    return result;
  }

  return null;
}

function buildStep(cursor: TreeCursor, source: string): StepNode | null {
  const nodeType = cursor.type.id;

  if (nodeType === Step) {
    if (cursor.firstChild()) {
      const result = buildStep(cursor, source);
      cursor.parent();
      return result;
    }
    return null;
  }

  if (nodeType === RunStep) {
    const stepSpan = span(cursor);
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          const raw = getText(cursor, source);
          cursor.parent();
          const runNode: RunStepNode = {
            kind: "run",
            command: unquoteString(raw),
            span: stepSpan,
          };
          return runNode;
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    return null;
  }

  if (nodeType === UsesStep) {
    const stepSpan = span(cursor);
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          const raw = getText(cursor, source);
          cursor.parent();
          const usesNode: UsesStepNode = {
            kind: "uses",
            action: unquoteString(raw),
            span: stepSpan,
          };
          return usesNode;
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    return null;
  }

  if (nodeType === AgentTaskStep) {
    return buildAgentTask(cursor, source);
  }

  if (nodeType === GuardJsStep) {
    return buildGuardJsStep(cursor, source);
  }

  return null;
}

function buildGuardJsStep(cursor: TreeCursor, source: string): GuardJsStepNode | null {
  if (cursor.type.id !== GuardJsStep) return null;

  const stepSpan = span(cursor);
  let id = "";
  let code = "";

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === StringTerm) {
      id = unquoteString(getText(cursor, source));
    } else if (cursor.type.id === GuardJs) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === TripleQuotedString) {
            code = unquoteTripleString(getText(cursor, source));
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "guard_js_step",
    id,
    code,
    span: stepSpan,
  };
}

function extractShellContent(raw: string): { content: string; multiline: boolean } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return { content: raw, multiline: raw.includes("\n") };
  }

  const inner = trimmed.slice(1, -1);
  const hasNewlines = inner.includes("\n");

  if (hasNewlines) {
    return { content: inner, multiline: true };
  }

  return { content: inner.trim(), multiline: false };
}

function buildShellStep(cursor: TreeCursor, source: string): ShellStepNode | null {
  if (cursor.type.id !== ShellStep) return null;

  const stepSpan = span(cursor);
  let content = "";
  let multiline = false;

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === ShellBlock) {
      const rawContent = getText(cursor, source);
      const extracted = extractShellContent(rawContent);
      content = extracted.content;
      multiline = extracted.multiline;
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "shell",
    content,
    multiline,
    span: stepSpan,
  };
}

function buildObjectValue(cursor: TreeCursor, source: string): unknown {
  const nodeType = cursor.type.id;
  const nodeName = cursor.name;

  if (nodeType === StringTerm || nodeName === "String") {
    return unquoteString(getText(cursor, source));
  }

  if (nodeType === NumberTerm || nodeName === "Number") {
    const text = getText(cursor, source);
    return text.includes(".") ? parseFloat(text) : parseInt(text, 10);
  }

  if (nodeType === BooleanTerm || nodeName === "Boolean") {
    return getText(cursor, source) === "true";
  }

  if (nodeType === ObjectLiteral) {
    const obj: Record<string, unknown> = {};
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === ObjectPropertyList) {
          if (cursor.firstChild()) {
            do {
              if (cursor.type.id === ObjectProperty) {
                let key = "";
                let value: unknown = null;
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === ObjectPropertyKey) {
                      if (cursor.firstChild()) {
                        key = getText(cursor, source);
                        cursor.parent();
                      }
                    } else if (cursor.type.id === ObjectValue) {
                      if (cursor.firstChild()) {
                        value = buildObjectValue(cursor, source);
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
                if (key) {
                  obj[key] = value;
                }
              }
            } while (cursor.nextSibling());
            cursor.parent();
          }
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    return obj;
  }

  if (nodeType === ArrayLiteral) {
    const arr: unknown[] = [];
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === ArrayItems) {
          if (cursor.firstChild()) {
            do {
              if (cursor.type.id === ObjectValue) {
                if (cursor.firstChild()) {
                  arr.push(buildObjectValue(cursor, source));
                  cursor.parent();
                }
              }
            } while (cursor.nextSibling());
            cursor.parent();
          }
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    return arr;
  }

  if (nodeType === ObjectValue) {
    if (cursor.firstChild()) {
      const value = buildObjectValue(cursor, source);
      cursor.parent();
      return value;
    }
    return null;
  }

  return null;
}

function buildUsesBlockStep(cursor: TreeCursor, source: string): UsesBlockStepNode | null {
  if (cursor.type.id !== UsesBlockStep) return null;

  const stepSpan = span(cursor);
  let action = "";
  let withConfig: Record<string, unknown> | undefined;

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === StringTerm) {
      action = unquoteString(getText(cursor, source));
    } else if (cursor.type.id === UsesConfigBlock) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === UsesConfigProperty) {
            if (cursor.firstChild()) {
              if (cursor.type.id === WithProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === ObjectLiteral) {
                      const obj = buildObjectValue(cursor, source);
                      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
                        withConfig = obj as Record<string, unknown>;
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  const node: UsesBlockStepNode = {
    kind: "uses_block",
    action,
    span: stepSpan,
  };

  if (withConfig) {
    return { ...node, with: withConfig };
  }

  return node;
}

function buildBlockStep(cursor: TreeCursor, source: string): StepNode | null {
  const nodeType = cursor.type.id;

  if (nodeType === BlockStep) {
    if (cursor.firstChild()) {
      const result = buildBlockStep(cursor, source);
      cursor.parent();
      return result;
    }
    return null;
  }

  if (nodeType === ShellStep) {
    return buildShellStep(cursor, source);
  }

  if (nodeType === UsesBlockStep) {
    return buildUsesBlockStep(cursor, source);
  }

  if (nodeType === AgentTaskStep) {
    return buildAgentTask(cursor, source);
  }

  if (nodeType === GuardJsStep) {
    return buildGuardJsStep(cursor, source);
  }

  if (nodeType === StepsFragmentSpread) {
    return buildStepsFragmentSpread(cursor, source);
  }

  return null;
}

function buildStepsBlock(cursor: TreeCursor, source: string): StepNode[] {
  const steps: StepNode[] = [];

  if (!cursor.firstChild()) return steps;

  do {
    if (cursor.type.id === BlockStep) {
      const step = buildBlockStep(cursor, source);
      if (step) steps.push(step);
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return steps;
}

function buildAxisValues(cursor: TreeCursor, source: string): (string | number)[] {
  const values: (string | number)[] = [];

  if (!cursor.firstChild()) return values;

  do {
    if (cursor.type.id === AxisValue) {
      if (cursor.firstChild()) {
        const valueType = cursor.type.id;
        if (valueType === NumberTerm) {
          values.push(parseInt(getText(cursor, source), 10));
        } else if (valueType === StringTerm) {
          values.push(unquoteString(getText(cursor, source)));
        } else if (valueType === Identifier) {
          values.push(getText(cursor, source));
        } else if (valueType === HyphenatedIdentifier) {
          values.push(getText(cursor, source));
        }
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return values;
}

function buildAxes(cursor: TreeCursor, source: string): Record<string, (string | number)[]> {
  const axes: Record<string, (string | number)[]> = {};

  if (!cursor.firstChild()) return axes;

  do {
    if (cursor.type.id === AxisDecl) {
      let axisName = "";
      let axisValues: (string | number)[] = [];

      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === Identifier) {
            axisName = getText(cursor, source);
          } else if (cursor.type.id === AxisValueList) {
            axisValues = buildAxisValues(cursor, source);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }

      if (axisName) {
        axes[axisName] = axisValues;
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return axes;
}

function buildMatrixCombinationValue(cursor: TreeCursor, source: string): string | number | boolean {
  if (!cursor.firstChild()) return "";

  let value: string | number | boolean = "";

  do {
    const valueType = cursor.type.id;

    if (valueType === StringTerm) {
      value = unquoteString(getText(cursor, source));
      break;
    } else if (valueType === NumberTerm) {
      value = parseInt(getText(cursor, source), 10);
      break;
    } else if (valueType === BooleanTerm) {
      value = getText(cursor, source) === "true";
      break;
    } else if (valueType === HyphenatedIdentifier || valueType === Identifier) {
      value = getText(cursor, source);
      break;
    } else if (cursor.name === "Boolean") {
      value = getText(cursor, source) === "true";
      break;
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return value;
}

function buildMatrixCombination(cursor: TreeCursor, source: string): MatrixCombination {
  const combination: MatrixCombination = {};

  if (!cursor.firstChild()) return combination;

  do {
    if (cursor.type.id === MatrixCombinationEntryList) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === MatrixCombinationEntry) {
            let key = "";
            let value: string | number | boolean = "";

            if (cursor.firstChild()) {
              do {
                if (cursor.type.id === Identifier) {
                  key = getText(cursor, source);
                } else if (cursor.type.id === MatrixCombinationValue) {
                  value = buildMatrixCombinationValue(cursor, source);
                }
              } while (cursor.nextSibling());
              cursor.parent();
            }

            if (key) {
              combination[key] = value;
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return combination;
}

function buildMatrixCombinations(cursor: TreeCursor, source: string): MatrixCombination[] {
  const combinations: MatrixCombination[] = [];

  if (!cursor.firstChild()) return combinations;

  do {
    if (cursor.type.id === MatrixCombinationList) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === MatrixCombinationTerm) {
            combinations.push(buildMatrixCombination(cursor, source));
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return combinations;
}

function buildJob(cursor: TreeCursor, source: string): JobNode | MatrixJobNode | JobFragmentInstantiationNode | null {
  if (cursor.type.id !== JobDecl) return null;

  const jobSpan = span(cursor);
  let name = "";
  let isMatrix = false;
  let runsOn: string | null = null;
  const needs: string[] = [];
  let condition: ExpressionNode | null = null;
  const outputs: OutputDeclaration[] = [];
  const steps: StepNode[] = [];
  let axes: Record<string, (string | number)[]> = {};
  let include: MatrixCombination[] | undefined;
  let exclude: MatrixCombination[] | undefined;
  let maxParallel: number | undefined;
  let failFast: boolean | undefined;
  let fragmentInstantiation: { fragmentName: string; arguments: ParamArgumentNode[] } | null = null;

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === MatrixModifier) {
      isMatrix = true;
    } else if (nodeType === FragmentInstantiation) {
      fragmentInstantiation = buildFragmentInstantiation(cursor, source);
    } else if (nodeType === JobBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === JobProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;

              if (propType === RunsOnProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === RunnerSpec) {
                      runsOn = getText(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === NeedsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NeedsSpec) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Identifier) {
                            needs.push(getText(cursor, source));
                          } else if (cursor.type.id === IdentifierList) {
                            if (cursor.firstChild()) {
                              do {
                                if (cursor.type.id === Identifier) {
                                  needs.push(getText(cursor, source));
                                }
                              } while (cursor.nextSibling());
                              cursor.parent();
                            }
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === IfProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === Expression || cursor.type.id === ComparisonExpr) {
                      condition = buildExpression(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === OutputsProperty) {
                outputs.push(...buildOutputs(cursor, source));
              } else if (propType === StepsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StepList) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Step) {
                            const step = buildStep(cursor, source);
                            if (step) steps.push(step);
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === StepsBlock) {
                steps.push(...buildStepsBlock(cursor, source));
              } else if (propType === AxesProperty) {
                axes = buildAxes(cursor, source);
              } else if (propType === MaxParallelProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NumberTerm) {
                      maxParallel = parseInt(getText(cursor, source), 10);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === FailFastProperty) {
                const failFastText = getText(cursor, source);
                if (failFastText.includes("true")) {
                  failFast = true;
                } else if (failFastText.includes("false")) {
                  failFast = false;
                }
              } else if (propType === IncludeProperty) {
                include = buildMatrixCombinations(cursor, source);
              } else if (propType === ExcludeProperty) {
                exclude = buildMatrixCombinations(cursor, source);
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (fragmentInstantiation) {
    const fragmentInstNode: JobFragmentInstantiationNode = {
      kind: "job_fragment_instantiation",
      name,
      fragmentName: fragmentInstantiation.fragmentName,
      arguments: fragmentInstantiation.arguments,
      span: jobSpan,
    };
    return fragmentInstNode;
  }

  if (isMatrix) {
    const matrixJobNode: MatrixJobNode = {
      kind: "matrix_job",
      name,
      axes,
      ...(include && include.length > 0 ? { include } : {}),
      ...(exclude && exclude.length > 0 ? { exclude } : {}),
      maxParallel,
      failFast,
      runsOn,
      needs,
      condition,
      outputs,
      steps,
      span: jobSpan,
    };
    return matrixJobNode;
  }

  const jobNode: JobNode = {
    kind: "job",
    name,
    runsOn,
    needs,
    condition,
    outputs,
    steps,
    span: jobSpan,
  };
  return jobNode;
}

function buildAgentJob(cursor: TreeCursor, source: string): AgentJobNode | null {
  if (cursor.type.id !== AgentJobDecl) return null;

  const jobSpan = span(cursor);
  let name = "";
  let after: string | undefined;
  let runsOn: string | null = null;
  const needs: string[] = [];
  const outputs: OutputDeclaration[] = [];
  const steps: StepNode[] = [];
  const consumes: ConsumeNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === AfterClause) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === Identifier) {
            after = getText(cursor, source);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    } else if (nodeType === JobBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === JobProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;

              if (propType === RunsOnProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === RunnerSpec) {
                      runsOn = getText(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === NeedsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NeedsSpec) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Identifier) {
                            needs.push(getText(cursor, source));
                          } else if (cursor.type.id === IdentifierList) {
                            if (cursor.firstChild()) {
                              do {
                                if (cursor.type.id === Identifier) {
                                  needs.push(getText(cursor, source));
                                }
                              } while (cursor.nextSibling());
                              cursor.parent();
                            }
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === OutputsProperty) {
                outputs.push(...buildOutputs(cursor, source));
              } else if (propType === StepsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StepList) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Step) {
                            const step = buildStep(cursor, source);
                            if (step) steps.push(step);
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === StepsBlock) {
                steps.push(...buildStepsBlock(cursor, source));
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  const agentJobNode: AgentJobNode = {
    kind: "agent_job",
    name,
    after,
    runsOn,
    needs,
    outputs,
    steps,
    consumes,
    span: jobSpan,
  };
  return agentJobNode;
}

function buildGuardJs(cursor: TreeCursor, source: string): GuardJsNode | null {
  if (cursor.type.id !== GuardJs) return null;

  const guardSpan = span(cursor);
  let code = "";

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === TripleQuotedString) {
      code = unquoteTripleString(getText(cursor, source));
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "guard_js",
    code,
    span: guardSpan,
  };
}

function buildCycleBody(cursor: TreeCursor, source: string): CycleBodyNode {
  const bodySpan = span(cursor);
  const jobs: AnyJobDeclNode[] = [];

  if (!cursor.firstChild()) {
    return { kind: "cycle_body", jobs, span: bodySpan };
  }

  do {
    if (cursor.type.id === JobDecl) {
      const job = buildJob(cursor, source);
      if (job) jobs.push(job);
    } else if (cursor.type.id === AgentJobDecl) {
      const agentJob = buildAgentJob(cursor, source);
      if (agentJob) jobs.push(agentJob);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "cycle_body",
    jobs,
    span: bodySpan,
  };
}

function buildCycle(cursor: TreeCursor, source: string): CycleNode | null {
  if (cursor.type.id !== CycleDecl) return null;

  const cycleSpan = span(cursor);
  let name = "";
  let maxIters: number | null = null;
  let key: string | null = null;
  let until: GuardJsNode | null = null;
  let body: CycleBodyNode = { kind: "cycle_body", jobs: [], span: { start: 0, end: 0 } };

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === CycleBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === CycleProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;

              if (propType === MaxItersProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NumberTerm) {
                      maxIters = parseInt(getText(cursor, source), 10);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === KeyProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StringTerm) {
                      key = unquoteString(getText(cursor, source));
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === UntilProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === GuardJs) {
                      until = buildGuardJs(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              }
              cursor.parent();
            }
          } else if (cursor.type.id === BodyBlock) {
            body = buildCycleBody(cursor, source);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "cycle",
    name,
    maxIters,
    key,
    until,
    body,
    span: cycleSpan,
  };
}

function buildTrigger(cursor: TreeCursor, source: string): TriggerNode | null {
  if (cursor.type.id !== OnClause) return null;

  const triggerSpan = span(cursor);
  const events: string[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === TriggerSpec) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === EventName) {
            events.push(getText(cursor, source));
          } else if (cursor.type.id === EventList) {
            if (cursor.firstChild()) {
              do {
                if (cursor.type.id === EventName) {
                  events.push(getText(cursor, source));
                }
              } while (cursor.nextSibling());
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  const triggerNode: TriggerNode = {
    kind: "trigger",
    events,
    span: triggerSpan,
  };
  return triggerNode;
}

function buildTypeExpression(cursor: TreeCursor, source: string): TypeExpressionNode | null {
  const nodeType = cursor.type.id;
  const nodeSpan = span(cursor);

  if (nodeType === SchemaType || nodeType === NonUnionSchemaType) {
    if (cursor.firstChild()) {
      const result = buildTypeExpression(cursor, source);
      cursor.parent();
      return result;
    }
    return null;
  }

  if (nodeType === UnionType) {
    const members: TypeExpressionNode[] = [];
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === NonUnionSchemaType) {
          const t = buildTypeExpression(cursor, source);
          if (t) members.push(t);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    if (members.length === 0) return null;
    const unionNode: UnionTypeNode = {
      kind: "union_type",
      members,
      span: nodeSpan,
    };
    return unionNode;
  }

  if (nodeType === ArrayType) {
    if (cursor.firstChild()) {
      let elementType: TypeExpressionNode | null = null;
      do {
        if (cursor.type.id === SchemaType || cursor.type.id === NonUnionSchemaType ||
            cursor.type.id === UnionType || cursor.type.id === ArrayType ||
            cursor.type.id === ObjectType || cursor.type.id === SchemaPrimitiveType ||
            cursor.type.id === NullType || cursor.type.id === StringLiteralType) {
          elementType = buildTypeExpression(cursor, source);
        }
      } while (cursor.nextSibling());
      cursor.parent();
      if (elementType) {
        const arrayNode: ArrayTypeNode = {
          kind: "array_type",
          elementType,
          span: nodeSpan,
        };
        return arrayNode;
      }
    }
    return null;
  }

  if (nodeType === ObjectType) {
    const fields: TypeFieldNode[] = [];
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === SchemaField) {
          const field = buildTypeField(cursor, source);
          if (field) fields.push(field);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    const objectNode: ObjectTypeNode = {
      kind: "object_type",
      fields,
      span: nodeSpan,
    };
    return objectNode;
  }

  if (nodeType === SchemaPrimitiveType) {
    const typeText = getText(cursor, source);
    if (typeText === "string" || typeText === "int" || typeText === "float" ||
        typeText === "bool" || typeText === "json" || typeText === "path") {
      const primitiveNode: PrimitiveTypeNode = {
        kind: "primitive_type",
        type: typeText,
        span: nodeSpan,
      };
      return primitiveNode;
    }
    const typeRefNode: TypeReferenceNode = {
      kind: "type_reference",
      name: typeText,
      span: nodeSpan,
    };
    return typeRefNode;
  }

  if (nodeType === NullType || cursor.name === "NullType") {
    const nullNode: NullTypeNode = {
      kind: "null_type",
      span: nodeSpan,
    };
    return nullNode;
  }

  if (nodeType === StringLiteralType) {
    if (cursor.firstChild()) {
      let value = "";
      do {
        if (cursor.type.id === StringTerm) {
          value = unquoteString(getText(cursor, source));
        }
      } while (cursor.nextSibling());
      cursor.parent();
      const stringLiteralNode: StringLiteralTypeNode = {
        kind: "string_literal_type",
        value,
        span: nodeSpan,
      };
      return stringLiteralNode;
    }
    return null;
  }

  return null;
}

function buildTypeField(cursor: TreeCursor, source: string): TypeFieldNode | null {
  if (cursor.type.id !== SchemaField && cursor.type.id !== TypeField) return null;

  const fieldSpan = span(cursor);
  let name = "";
  let type: TypeExpressionNode | null = null;

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === Identifier) {
      name = getText(cursor, source);
    } else if (cursor.type.id === SchemaType || cursor.type.id === NonUnionSchemaType ||
               cursor.type.id === UnionType || cursor.type.id === ArrayType ||
               cursor.type.id === ObjectType || cursor.type.id === SchemaPrimitiveType ||
               cursor.type.id === NullType || cursor.type.id === StringLiteralType) {
      type = buildTypeExpression(cursor, source);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name || !type) return null;

  return {
    kind: "type_field",
    name,
    type,
    span: fieldSpan,
  };
}

function buildTypeDeclaration(cursor: TreeCursor, source: string): TypeDeclarationNode | null {
  if (cursor.type.id !== TypeDecl) return null;

  const declSpan = span(cursor);
  let name = "";
  const fields: TypeFieldNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === TypeDeclName) {
      name = getText(cursor, source);
    } else if (cursor.type.id === TypeField) {
      const field = buildTypeField(cursor, source);
      if (field) fields.push(field);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name) return null;

  return {
    kind: "type_declaration",
    name,
    fields,
    span: declSpan,
  };
}

function buildWorkflow(cursor: TreeCursor, source: string): WorkflowNode | null {
  if (cursor.type.id !== WorkflowDecl) return null;

  const workflowSpan = span(cursor);
  let name = "";
  let trigger: TriggerNode | null = null;
  const jobs: AnyJobDeclNode[] = [];
  const cycles: CycleNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === WorkflowBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === OnClause) {
            trigger = buildTrigger(cursor, source);
          } else if (cursor.type.id === JobDecl) {
            const job = buildJob(cursor, source);
            if (job) jobs.push(job);
          } else if (cursor.type.id === AgentJobDecl) {
            const agentJob = buildAgentJob(cursor, source);
            if (agentJob) jobs.push(agentJob);
          } else if (cursor.type.id === CycleDecl) {
            const cycle = buildCycle(cursor, source);
            if (cycle) cycles.push(cycle);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  return {
    kind: "workflow",
    name,
    trigger,
    jobs,
    cycles,
    span: workflowSpan,
  };
}

function buildImportItem(cursor: TreeCursor, source: string): ImportItemNode | null {
  if (cursor.type.id !== ImportItem) return null;

  const itemSpan = span(cursor);
  let name = "";
  let alias: string | undefined;

  if (!cursor.firstChild()) return null;

  let identifierIndex = 0;
  do {
    if (cursor.type.id === Identifier) {
      if (identifierIndex === 0) {
        name = getText(cursor, source);
      } else {
        alias = getText(cursor, source);
      }
      identifierIndex++;
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name) return null;

  return {
    kind: "import_item",
    name,
    ...(alias ? { alias } : {}),
    span: itemSpan,
  };
}

function buildImportDeclaration(cursor: TreeCursor, source: string): ImportDeclarationNode | null {
  if (cursor.type.id !== ImportDecl) return null;

  const declSpan = span(cursor);
  const items: ImportItemNode[] = [];
  let path = "";

  if (!cursor.firstChild()) return null;

  do {
    if (cursor.type.id === ImportList) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === ImportItem) {
            const item = buildImportItem(cursor, source);
            if (item) items.push(item);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    } else if (cursor.type.id === ImportPath) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            path = unquoteString(getText(cursor, source));
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (items.length === 0 || !path) return null;

  return {
    kind: "import_declaration",
    items,
    path,
    span: declSpan,
  };
}

function buildParamsBlock(cursor: TreeCursor, source: string): ParamDeclarationNode[] {
  const params: ParamDeclarationNode[] = [];

  if (!cursor.firstChild()) return params;

  do {
    if (cursor.type.id === ParamDecl) {
      const param = buildParamDeclaration(cursor, source);
      if (param) params.push(param);
    }
  } while (cursor.nextSibling());

  cursor.parent();
  return params;
}

function buildParamDeclaration(cursor: TreeCursor, source: string): ParamDeclarationNode | null {
  const declSpan = span(cursor);
  let name = "";
  let type: TypeExpressionNode | null = null;
  let defaultValue: ExpressionNode | null = null;

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === SchemaType) {
      const schemaType = buildSchemaType(cursor, source);
      if (schemaType) {
        type = schemaTypeToPrimitiveType(schemaType);
      }
    } else if (nodeType === Expression || nodeType === ComparisonExpr || nodeType === PrimaryExpr) {
      defaultValue = buildExpression(cursor, source);
    } else if (cursor.type.name === "Number") {
      defaultValue = buildExpression(cursor, source);
    } else if (cursor.type.name === "String") {
      defaultValue = buildExpression(cursor, source);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name || !type) return null;

  return {
    kind: "param_declaration",
    name,
    type,
    defaultValue,
    span: declSpan,
  };
}

function schemaTypeToPrimitiveType(schemaType: SchemaTypeNode): TypeExpressionNode {
  switch (schemaType.kind) {
    case "primitive":
      return {
        kind: "primitive_type",
        type: schemaType.type,
        span: schemaType.span,
      };
    case "array":
      return {
        kind: "array_type",
        elementType: schemaTypeToPrimitiveType(schemaType.elementType),
        span: schemaType.span,
      };
    case "object":
      return {
        kind: "object_type",
        fields: schemaType.fields.map(f => ({
          kind: "type_field" as const,
          name: f.name,
          type: schemaTypeToPrimitiveType(f.type),
          span: f.span,
        })),
        span: schemaType.span,
      };
    case "union":
      return {
        kind: "union_type",
        members: schemaType.types.map(t => schemaTypeToPrimitiveType(t)),
        span: schemaType.span,
      };
    case "stringLiteral":
      return {
        kind: "string_literal_type",
        value: schemaType.value,
        span: schemaType.span,
      };
    case "null":
      return {
        kind: "null_type",
        span: schemaType.span,
      };
  }
}

function buildFragmentInstantiation(cursor: TreeCursor, source: string): { fragmentName: string; arguments: ParamArgumentNode[] } | null {
  let fragmentName = "";
  const args: ParamArgumentNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      fragmentName = getText(cursor, source);
    } else if (nodeType === ParamAssignment) {
      const arg = buildParamAssignment(cursor, source);
      if (arg) args.push(arg);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!fragmentName) return null;

  return {
    fragmentName,
    arguments: args,
  };
}

function buildParamAssignment(cursor: TreeCursor, source: string): ParamArgumentNode | null {
  const argSpan = span(cursor);
  let name = "";
  let value: ExpressionNode | null = null;

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === Expression || nodeType === ComparisonExpr || nodeType === PrimaryExpr) {
      value = buildExpression(cursor, source);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name || !value) return null;

  return {
    kind: "param_argument",
    name,
    value,
    span: argSpan,
  };
}

function buildStepsFragmentSpread(cursor: TreeCursor, source: string): StepsFragmentSpreadNode | null {
  const spreadSpan = span(cursor);
  let fragmentName = "";
  const args: ParamArgumentNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      fragmentName = getText(cursor, source);
    } else if (nodeType === ParamAssignment) {
      const arg = buildParamAssignment(cursor, source);
      if (arg) args.push(arg);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!fragmentName) return null;

  return {
    kind: "steps_fragment_spread",
    fragmentName,
    arguments: args,
    span: spreadSpan,
  };
}

function buildJobFragment(cursor: TreeCursor, source: string): JobFragmentNode | null {
  const fragmentSpan = span(cursor);
  let name = "";
  let params: ParamDeclarationNode[] = [];
  let runsOn: string | null = null;
  const needs: string[] = [];
  let condition: ExpressionNode | null = null;
  const outputs: OutputDeclaration[] = [];
  const steps: StepNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === ParamsBlock) {
      params = buildParamsBlock(cursor, source);
    } else if (nodeType === JobBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === JobProperty) {
            if (cursor.firstChild()) {
              const propType = cursor.type.id;

              if (propType === RunsOnProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === RunnerSpec) {
                      runsOn = getText(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === NeedsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === NeedsSpec) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Identifier) {
                            needs.push(getText(cursor, source));
                          } else if (cursor.type.id === IdentifierList) {
                            if (cursor.firstChild()) {
                              do {
                                if (cursor.type.id === Identifier) {
                                  needs.push(getText(cursor, source));
                                }
                              } while (cursor.nextSibling());
                              cursor.parent();
                            }
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === IfProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === Expression || cursor.type.id === ComparisonExpr) {
                      condition = buildExpression(cursor, source);
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === OutputsProperty) {
                outputs.push(...buildOutputs(cursor, source));
              } else if (propType === StepsProperty) {
                if (cursor.firstChild()) {
                  do {
                    if (cursor.type.id === StepList) {
                      if (cursor.firstChild()) {
                        do {
                          if (cursor.type.id === Step) {
                            const step = buildStep(cursor, source);
                            if (step) steps.push(step);
                          }
                        } while (cursor.nextSibling());
                        cursor.parent();
                      }
                    }
                  } while (cursor.nextSibling());
                  cursor.parent();
                }
              } else if (propType === StepsBlock) {
                steps.push(...buildStepsBlock(cursor, source));
              }
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name) return null;

  return {
    kind: "job_fragment",
    name,
    params,
    runsOn,
    needs,
    condition,
    outputs,
    steps,
    span: fragmentSpan,
  };
}

function buildStepsFragment(cursor: TreeCursor, source: string): StepsFragmentNode | null {
  const fragmentSpan = span(cursor);
  let name = "";
  let params: ParamDeclarationNode[] = [];
  const steps: StepNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === ParamsBlock) {
      params = buildParamsBlock(cursor, source);
    } else if (nodeType === BlockStep) {
      const step = buildBlockStep(cursor, source);
      if (step) steps.push(step);
    }
  } while (cursor.nextSibling());

  cursor.parent();

  if (!name) return null;

  return {
    kind: "steps_fragment",
    name,
    params,
    steps,
    span: fragmentSpan,
  };
}

export function buildFileAST(tree: Tree, source: string): WorkPipeFileNode | null {
  const cursor = tree.cursor();
  const imports: ImportDeclarationNode[] = [];
  const types: TypeDeclarationNode[] = [];
  const jobFragments: JobFragmentNode[] = [];
  const stepsFragments: StepsFragmentNode[] = [];
  const workflows: WorkflowNode[] = [];
  const fileSpan = span(cursor);

  if (!cursor.firstChild()) {
    return { kind: "file", imports: [], types: [], jobFragments: [], stepsFragments: [], workflows: [], span: fileSpan };
  }

  do {
    if (cursor.type.id === ImportDecl) {
      const importDecl = buildImportDeclaration(cursor, source);
      if (importDecl) imports.push(importDecl);
    } else if (cursor.type.id === TypeDecl) {
      const typeDecl = buildTypeDeclaration(cursor, source);
      if (typeDecl) types.push(typeDecl);
    } else if (cursor.type.id === FragmentDecl) {
      if (cursor.firstChild()) {
        if (cursor.type.id === JobFragmentDecl) {
          const fragment = buildJobFragment(cursor, source);
          if (fragment) jobFragments.push(fragment);
        } else if (cursor.type.id === StepsFragmentDecl) {
          const fragment = buildStepsFragment(cursor, source);
          if (fragment) stepsFragments.push(fragment);
        }
        cursor.parent();
      }
    } else if (cursor.type.id === WorkflowDecl) {
      const workflow = buildWorkflow(cursor, source);
      if (workflow) workflows.push(workflow);
    }
  } while (cursor.nextSibling());

  return {
    kind: "file",
    imports,
    types,
    jobFragments,
    stepsFragments,
    workflows,
    span: fileSpan,
  };
}

export function buildAST(tree: Tree, source: string): WorkflowNode | null {
  const cursor = tree.cursor();

  if (!cursor.firstChild()) return null;

  while (cursor.type.id !== WorkflowDecl) {
    if (!cursor.nextSibling()) return null;
  }

  const workflowSpan = span(cursor);
  let name = "";
  let trigger: TriggerNode | null = null;
  const jobs: AnyJobDeclNode[] = [];
  const cycles: CycleNode[] = [];

  if (!cursor.firstChild()) return null;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === Identifier) {
      name = getText(cursor, source);
    } else if (nodeType === WorkflowBody) {
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === OnClause) {
            trigger = buildTrigger(cursor, source);
          } else if (cursor.type.id === JobDecl) {
            const job = buildJob(cursor, source);
            if (job) jobs.push(job);
          } else if (cursor.type.id === AgentJobDecl) {
            const agentJob = buildAgentJob(cursor, source);
            if (agentJob) jobs.push(agentJob);
          } else if (cursor.type.id === CycleDecl) {
            const cycle = buildCycle(cursor, source);
            if (cycle) cycles.push(cycle);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
    }
  } while (cursor.nextSibling());

  const workflowNode: WorkflowNode = {
    kind: "workflow",
    name,
    trigger,
    jobs,
    cycles,
    span: workflowSpan,
  };
  return workflowNode;
}
