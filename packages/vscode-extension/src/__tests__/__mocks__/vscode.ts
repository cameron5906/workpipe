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
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
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
