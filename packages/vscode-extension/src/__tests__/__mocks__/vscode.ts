import { vi } from "vitest";

export const languages = {
  createDiagnosticCollection: vi.fn(() => {
    const store = new Map<Uri, Diagnostic[]>();
    return {
      set: vi.fn((uri: Uri, diagnostics: Diagnostic[]) => {
        store.set(uri, diagnostics);
      }),
      get: (uri: Uri) => store.get(uri),
      dispose: vi.fn(),
      clear: vi.fn(),
    };
  }),
  registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
  registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const workspace = {
  onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  textDocuments: [],
};

export const window = {
  activeTextEditor: undefined,
};

export class Range {
  public start: Position;
  public end: Position;

  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number
  );
  constructor(start: Position, end: Position);
  constructor(
    startOrLine: number | Position,
    startCharOrEnd: number | Position,
    endLine?: number,
    endCharacter?: number
  ) {
    if (typeof startOrLine === "number") {
      this.start = new Position(startOrLine, startCharOrEnd as number);
      this.end = new Position(endLine!, endCharacter!);
    } else {
      this.start = startOrLine;
      this.end = startCharOrEnd as Position;
    }
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Position) {
      return (
        positionOrRange.line >= this.start.line &&
        positionOrRange.line <= this.end.line &&
        positionOrRange.character >= this.start.character &&
        positionOrRange.character <= this.end.character
      );
    }
    return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
  }
}

export class Position {
  constructor(
    public line: number,
    public character: number
  ) {}
}

export class Diagnostic {
  public code: string | undefined;
  public source: string | undefined;

  constructor(
    public range: Range,
    public message: string,
    public severity: DiagnosticSeverity
  ) {}
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }

  static parse(value: string): Uri {
    return new Uri(value);
  }

  constructor(public path: string) {}

  toString(): string {
    return this.path;
  }
}

export class MarkdownString {
  public value: string = "";

  constructor(value?: string) {
    if (value) {
      this.value = value;
    }
  }

  appendMarkdown(value: string): this {
    this.value += value;
    return this;
  }

  appendCodeblock(code: string, language?: string): this {
    this.value += `\n\`\`\`${language || ""}\n${code}\n\`\`\`\n`;
    return this;
  }

  appendText(value: string): this {
    this.value += value;
    return this;
  }
}

export class Hover {
  constructor(
    public contents: MarkdownString | MarkdownString[] | string,
    public range?: Range
  ) {}
}

export class CodeAction {
  public diagnostics?: Diagnostic[];
  public isPreferred?: boolean;
  public edit?: WorkspaceEdit;

  constructor(
    public title: string,
    public kind?: CodeActionKind
  ) {}
}

export class CodeActionKind {
  static readonly Empty = new CodeActionKind("");
  static readonly QuickFix = new CodeActionKind("quickfix");
  static readonly Refactor = new CodeActionKind("refactor");
  static readonly RefactorExtract = new CodeActionKind("refactor.extract");
  static readonly RefactorInline = new CodeActionKind("refactor.inline");
  static readonly RefactorRewrite = new CodeActionKind("refactor.rewrite");
  static readonly Source = new CodeActionKind("source");
  static readonly SourceOrganizeImports = new CodeActionKind("source.organizeImports");

  constructor(public readonly value: string) {}
}

export class WorkspaceEdit {
  private edits: Array<{ uri: Uri; edit: TextEdit }> = [];

  insert(uri: Uri, position: Position, newText: string): void {
    this.edits.push({
      uri,
      edit: new TextEdit(new Range(position, position), newText),
    });
  }

  replace(uri: Uri, range: Range, newText: string): void {
    this.edits.push({
      uri,
      edit: new TextEdit(range, newText),
    });
  }

  delete(uri: Uri, range: Range): void {
    this.edits.push({
      uri,
      edit: new TextEdit(range, ""),
    });
  }

  entries(): Array<[Uri, TextEdit[]]> {
    const map = new Map<string, { uri: Uri; edits: TextEdit[] }>();
    for (const { uri, edit } of this.edits) {
      const key = uri.toString();
      if (!map.has(key)) {
        map.set(key, { uri, edits: [] });
      }
      map.get(key)!.edits.push(edit);
    }
    return Array.from(map.values()).map(({ uri, edits }) => [uri, edits]);
  }
}

export class TextEdit {
  constructor(
    public range: Range,
    public newText: string
  ) {}

  static insert(position: Position, newText: string): TextEdit {
    return new TextEdit(new Range(position, position), newText);
  }

  static replace(range: Range, newText: string): TextEdit {
    return new TextEdit(range, newText);
  }

  static delete(range: Range): TextEdit {
    return new TextEdit(range, "");
  }
}

export class CancellationTokenSource {
  public token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };

  cancel(): void {
    this.token.isCancellationRequested = true;
  }

  dispose(): void {}
}
