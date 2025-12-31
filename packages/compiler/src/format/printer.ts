import { parse } from "@workpipe/lang";
import type { Tree, TreeCursor } from "@lezer/common";
import * as terms from "@workpipe/lang";

const {
  Workflow,
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
  String: StringTerm,
  Number: NumberTerm,
  Boolean: BooleanTerm,
  CycleDecl,
  CycleBody,
  CycleProperty,
  MaxItersProperty,
  KeyProperty,
  UntilProperty,
  GuardJs,
  TripleQuotedString,
  BodyBlock,
  LineComment,
  BlockComment,
} = terms;

export interface FormatOptions {
  indentSize?: number;
}

interface FormatterContext {
  source: string;
  indent: number;
  indentSize: number;
  output: string[];
}

function getText(cursor: TreeCursor, source: string): string {
  return source.slice(cursor.from, cursor.to);
}

function emitIndent(ctx: FormatterContext): void {
  ctx.output.push(" ".repeat(ctx.indent * ctx.indentSize));
}

function emitNewline(ctx: FormatterContext): void {
  ctx.output.push("\n");
}

function emitBlankLine(ctx: FormatterContext): void {
  ctx.output.push("\n");
}

function formatComment(cursor: TreeCursor, ctx: FormatterContext): void {
  const text = getText(cursor, ctx.source);
  emitIndent(ctx);
  ctx.output.push(text);
  emitNewline(ctx);
}

function formatIdentifier(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatString(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatNumber(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatBoolean(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatTripleQuotedString(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatExpression(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatRunnerSpec(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatEventName(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(getText(cursor, ctx.source));
}

function formatEventList(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("[");
  if (cursor.firstChild()) {
    let first = true;
    do {
      if (cursor.type.id === EventName) {
        if (!first) ctx.output.push(", ");
        formatEventName(cursor, ctx);
        first = false;
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  ctx.output.push("]");
}

function formatTriggerSpec(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;
  do {
    if (cursor.type.id === EventName) {
      formatEventName(cursor, ctx);
    } else if (cursor.type.id === EventList) {
      formatEventList(cursor, ctx);
    }
  } while (cursor.nextSibling());
  cursor.parent();
}

function formatOnClause(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("on: ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === TriggerSpec) {
        formatTriggerSpec(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  emitNewline(ctx);
}

function formatStringList(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("[");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StringListItems) {
        if (cursor.firstChild()) {
          let first = true;
          do {
            if (cursor.type.id === StringTerm) {
              if (!first) ctx.output.push(", ");
              formatString(cursor, ctx);
              first = false;
            }
          } while (cursor.nextSibling());
          cursor.parent();
        }
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  ctx.output.push("]");
}

function formatStringListOrAll(cursor: TreeCursor, ctx: FormatterContext): void {
  const text = getText(cursor, ctx.source).trim();
  if (text === "*") {
    ctx.output.push("*");
  } else if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StringList) {
        formatStringList(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

function formatToolsBlockProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  const propType = cursor.type.id;

  if (propType === AllowedProperty) {
    emitIndent(ctx);
    ctx.output.push("allowed: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringListOrAll) {
          formatStringListOrAll(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === DisallowedProperty) {
    emitIndent(ctx);
    ctx.output.push("disallowed: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringList) {
          formatStringList(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === StrictProperty) {
    emitIndent(ctx);
    ctx.output.push("strict: ");
    const strictText = getText(cursor, ctx.source);
    if (strictText.includes("true")) {
      ctx.output.push("true");
    } else if (strictText.includes("false")) {
      ctx.output.push("false");
    }
    emitNewline(ctx);
  }

  cursor.parent();
}

function formatToolsBlock(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("{");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === ToolsBlockProperty) {
        formatToolsBlockProperty(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
}

function formatToolsProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("tools: ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === ToolsBlock) {
        formatToolsBlock(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  emitNewline(ctx);
}

function formatMcpBlockProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  const propType = cursor.type.id;

  if (propType === ConfigFileProperty) {
    emitIndent(ctx);
    ctx.output.push("config_file: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          formatString(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === AllowedProperty) {
    emitIndent(ctx);
    ctx.output.push("allowed: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringListOrAll) {
          formatStringListOrAll(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === DisallowedProperty) {
    emitIndent(ctx);
    ctx.output.push("disallowed: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringList) {
          formatStringList(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  }

  cursor.parent();
}

function formatMcpBlock(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("{");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === McpBlockProperty) {
        formatMcpBlockProperty(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
}

function formatMcpProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("mcp: ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === McpBlock) {
        formatMcpBlock(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  emitNewline(ctx);
}

function formatPromptValue(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  do {
    if (cursor.type.id === StringTerm) {
      formatString(cursor, ctx);
    } else if (cursor.type.id === FileReference) {
      ctx.output.push("file(");
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            formatString(cursor, ctx);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
      ctx.output.push(")");
    } else if (cursor.type.id === TemplateReference) {
      ctx.output.push("template(");
      if (cursor.firstChild()) {
        do {
          if (cursor.type.id === StringTerm) {
            formatString(cursor, ctx);
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }
      ctx.output.push(")");
    } else if (cursor.type.id === PromptValueTerm) {
      formatPromptValue(cursor, ctx);
    }
  } while (cursor.nextSibling());

  cursor.parent();
}

function formatConsumesItem(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);

  let name = "";
  let sourceRef = "";

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        name = getText(cursor, ctx.source);
      } else if (cursor.type.id === StringTerm) {
        sourceRef = getText(cursor, ctx.source);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.output.push(`${name}: from(${sourceRef})`);
  emitNewline(ctx);
}

function formatConsumesBlock(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("{");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === ConsumesItem) {
        formatConsumesItem(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
}

function formatConsumesProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("consumes: ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === ConsumesBlock) {
        formatConsumesBlock(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  emitNewline(ctx);
}

function formatAgentTaskProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  const propType = cursor.type.id;

  if (propType === ModelProperty) {
    emitIndent(ctx);
    ctx.output.push("model: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          formatString(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === MaxTurnsProperty) {
    emitIndent(ctx);
    ctx.output.push("max_turns: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === NumberTerm) {
          formatNumber(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === ToolsProperty) {
    formatToolsProperty(cursor, ctx);
  } else if (propType === McpProperty) {
    formatMcpProperty(cursor, ctx);
  } else if (propType === SystemPromptProperty) {
    emitIndent(ctx);
    ctx.output.push("system_prompt: ");
    formatPromptValue(cursor, ctx);
    emitNewline(ctx);
  } else if (propType === PromptProperty) {
    emitIndent(ctx);
    ctx.output.push("prompt: ");
    formatPromptValue(cursor, ctx);
    emitNewline(ctx);
  } else if (propType === OutputSchemaProperty) {
    emitIndent(ctx);
    ctx.output.push("output_schema: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          formatString(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === OutputArtifactProperty) {
    emitIndent(ctx);
    ctx.output.push("output_artifact: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          formatString(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === ConsumesProperty) {
    formatConsumesProperty(cursor, ctx);
  }

  cursor.parent();
}

function formatAgentTaskBody(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(" {");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === AgentTaskProperty) {
        formatAgentTaskProperty(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
}

function formatAgentTaskStep(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("agent_task(");

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StringTerm) {
        formatString(cursor, ctx);
      } else if (cursor.type.id === AgentTaskBody) {
        ctx.output.push(")");
        formatAgentTaskBody(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

function formatRunStep(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("run(");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StringTerm) {
        formatString(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  ctx.output.push(")");
}

function formatUsesStep(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("uses(");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StringTerm) {
        formatString(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  ctx.output.push(")");
}

function formatStep(cursor: TreeCursor, ctx: FormatterContext): void {
  if (cursor.type.id === Step) {
    if (cursor.firstChild()) {
      formatStep(cursor, ctx);
      cursor.parent();
    }
    return;
  }

  if (cursor.type.id === RunStep) {
    formatRunStep(cursor, ctx);
  } else if (cursor.type.id === UsesStep) {
    formatUsesStep(cursor, ctx);
  } else if (cursor.type.id === AgentTaskStep) {
    formatAgentTaskStep(cursor, ctx);
  }
}

function formatStepList(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("[");

  if (cursor.firstChild()) {
    const steps: { from: number; to: number }[] = [];
    do {
      if (cursor.type.id === Step) {
        steps.push({ from: cursor.from, to: cursor.to });
      }
    } while (cursor.nextSibling());
    cursor.parent();

    if (steps.length > 0) {
      emitNewline(ctx);
      ctx.indent++;

      if (cursor.firstChild()) {
        let first = true;
        do {
          if (cursor.type.id === Step) {
            if (!first) {
              ctx.output.push(",");
              emitNewline(ctx);
            }
            emitIndent(ctx);
            formatStep(cursor, ctx);
            first = false;
          }
        } while (cursor.nextSibling());
        cursor.parent();
      }

      emitNewline(ctx);
      ctx.indent--;
      emitIndent(ctx);
    }
  }

  ctx.output.push("]");
}

function formatStepsProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("steps: ");
  let foundStepList = false;
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === StepList) {
        formatStepList(cursor, ctx);
        foundStepList = true;
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  if (!foundStepList) {
    ctx.output.push("[]");
  }
  emitNewline(ctx);
}

function formatIdentifierList(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("[");
  if (cursor.firstChild()) {
    let first = true;
    do {
      if (cursor.type.id === Identifier) {
        if (!first) ctx.output.push(", ");
        formatIdentifier(cursor, ctx);
        first = false;
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
  ctx.output.push("]");
}

function formatNeedsSpec(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;
  do {
    if (cursor.type.id === Identifier) {
      formatIdentifier(cursor, ctx);
    } else if (cursor.type.id === IdentifierList) {
      formatIdentifierList(cursor, ctx);
    }
  } while (cursor.nextSibling());
  cursor.parent();
}

function formatJobProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  const propType = cursor.type.id;

  if (propType === RunsOnProperty) {
    emitIndent(ctx);
    ctx.output.push("runs_on: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === RunnerSpec) {
          formatRunnerSpec(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === NeedsProperty) {
    emitIndent(ctx);
    ctx.output.push("needs: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === NeedsSpec) {
          formatNeedsSpec(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === IfProperty) {
    emitIndent(ctx);
    ctx.output.push("if: ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === Expression || cursor.type.id === ComparisonExpr) {
          formatExpression(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === StepsProperty) {
    formatStepsProperty(cursor, ctx);
  }

  cursor.parent();
}

function formatJobBody(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(" {");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === JobProperty) {
        formatJobProperty(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
}

function formatJobDecl(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("job ");

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        formatIdentifier(cursor, ctx);
      } else if (cursor.type.id === JobBody) {
        formatJobBody(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  emitNewline(ctx);
}

function formatAfterClause(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push(" after ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        formatIdentifier(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

function formatAgentJobDecl(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("agent_job ");

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        formatIdentifier(cursor, ctx);
      } else if (cursor.type.id === AfterClause) {
        formatAfterClause(cursor, ctx);
      } else if (cursor.type.id === JobBody) {
        formatJobBody(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  emitNewline(ctx);
}

function formatGuardJs(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("guard_js ");
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === TripleQuotedString) {
        formatTripleQuotedString(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

function formatCycleProperty(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  const propType = cursor.type.id;

  if (propType === MaxItersProperty) {
    emitIndent(ctx);
    ctx.output.push("max_iters = ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === NumberTerm) {
          formatNumber(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === KeyProperty) {
    emitIndent(ctx);
    ctx.output.push("key = ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === StringTerm) {
          formatString(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  } else if (propType === UntilProperty) {
    emitIndent(ctx);
    ctx.output.push("until ");
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === GuardJs) {
          formatGuardJs(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
    emitNewline(ctx);
  }

  cursor.parent();
}

function formatBodyBlock(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("body {");
  emitNewline(ctx);
  ctx.indent++;

  if (cursor.firstChild()) {
    let isFirst = true;
    do {
      if (cursor.type.id === JobDecl) {
        if (!isFirst) emitBlankLine(ctx);
        formatJobDecl(cursor, ctx);
        isFirst = false;
      } else if (cursor.type.id === AgentJobDecl) {
        if (!isFirst) emitBlankLine(ctx);
        formatAgentJobDecl(cursor, ctx);
        isFirst = false;
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  ctx.indent--;
  emitIndent(ctx);
  ctx.output.push("}");
  emitNewline(ctx);
}

function formatCycleBody(cursor: TreeCursor, ctx: FormatterContext): void {
  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === CycleProperty) {
        formatCycleProperty(cursor, ctx);
      } else if (cursor.type.id === BodyBlock) {
        emitBlankLine(ctx);
        formatBodyBlock(cursor, ctx);
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

function formatCycleDecl(cursor: TreeCursor, ctx: FormatterContext): void {
  emitIndent(ctx);
  ctx.output.push("cycle ");

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        formatIdentifier(cursor, ctx);
      } else if (cursor.type.id === CycleBody) {
        ctx.output.push(" {");
        emitNewline(ctx);
        ctx.indent++;
        formatCycleBody(cursor, ctx);
        ctx.indent--;
        emitIndent(ctx);
        ctx.output.push("}");
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  emitNewline(ctx);
}

function formatWorkflowBody(cursor: TreeCursor, ctx: FormatterContext): void {
  if (!cursor.firstChild()) return;

  let isFirst = true;
  let hadOnClause = false;

  do {
    const nodeType = cursor.type.id;

    if (nodeType === LineComment || nodeType === BlockComment) {
      formatComment(cursor, ctx);
    } else if (nodeType === OnClause) {
      formatOnClause(cursor, ctx);
      hadOnClause = true;
      isFirst = false;
    } else if (nodeType === JobDecl) {
      if (!isFirst || hadOnClause) emitBlankLine(ctx);
      formatJobDecl(cursor, ctx);
      isFirst = false;
    } else if (nodeType === AgentJobDecl) {
      if (!isFirst || hadOnClause) emitBlankLine(ctx);
      formatAgentJobDecl(cursor, ctx);
      isFirst = false;
    } else if (nodeType === CycleDecl) {
      if (!isFirst || hadOnClause) emitBlankLine(ctx);
      formatCycleDecl(cursor, ctx);
      isFirst = false;
    }
  } while (cursor.nextSibling());

  cursor.parent();
}

function formatWorkflowDecl(cursor: TreeCursor, ctx: FormatterContext): void {
  ctx.output.push("workflow ");

  if (cursor.firstChild()) {
    do {
      if (cursor.type.id === Identifier) {
        formatIdentifier(cursor, ctx);
      } else if (cursor.type.id === WorkflowBody) {
        ctx.output.push(" {");
        emitNewline(ctx);
        ctx.indent++;
        formatWorkflowBody(cursor, ctx);
        ctx.indent--;
        ctx.output.push("}");
      }
    } while (cursor.nextSibling());
    cursor.parent();
  }

  emitNewline(ctx);
}

function formatTree(tree: Tree, source: string, options?: FormatOptions): string {
  const ctx: FormatterContext = {
    source,
    indent: 0,
    indentSize: options?.indentSize ?? 2,
    output: [],
  };

  const cursor = tree.cursor();

  if (cursor.type.id === Workflow) {
    if (cursor.firstChild()) {
      do {
        if (cursor.type.id === LineComment || cursor.type.id === BlockComment) {
          formatComment(cursor, ctx);
        } else if (cursor.type.id === WorkflowDecl) {
          formatWorkflowDecl(cursor, ctx);
        }
      } while (cursor.nextSibling());
      cursor.parent();
    }
  }

  let result = ctx.output.join("");

  if (!result.endsWith("\n")) {
    result += "\n";
  }

  return result;
}

export function format(source: string, options?: FormatOptions): string {
  const tree = parse(source);
  return formatTree(tree, source, options);
}
