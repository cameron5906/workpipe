export interface Position {
  readonly line: number;
  readonly column: number;
}

export class SourceMap {
  private readonly lineBreaks: readonly number[];
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
    this.lineBreaks = this.computeLineBreaks(source);
  }

  private computeLineBreaks(source: string): number[] {
    const breaks: number[] = [];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === "\n") {
        breaks.push(i);
      }
    }
    return breaks;
  }

  positionAt(offset: number): Position {
    if (offset < 0) {
      return { line: 1, column: 1 };
    }

    if (offset >= this.source.length) {
      offset = this.source.length;
    }

    const lineIndex = this.binarySearchLineIndex(offset);
    const lineStart = lineIndex === 0 ? 0 : this.lineBreaks[lineIndex - 1] + 1;

    return {
      line: lineIndex + 1,
      column: offset - lineStart + 1,
    };
  }

  private binarySearchLineIndex(offset: number): number {
    let low = 0;
    let high = this.lineBreaks.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineBreaks[mid] < offset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  getLine(lineNumber: number): string {
    if (lineNumber < 1) {
      return "";
    }

    const lineIndex = lineNumber - 1;
    const start = lineIndex === 0 ? 0 : this.lineBreaks[lineIndex - 1] + 1;
    const end =
      lineIndex < this.lineBreaks.length
        ? this.lineBreaks[lineIndex]
        : this.source.length;

    return this.source.slice(start, end);
  }

  get lineCount(): number {
    return this.lineBreaks.length + 1;
  }
}
