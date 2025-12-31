import { LRParser } from "@lezer/lr";
import type { Tree, TreeCursor } from "@lezer/common";
import { parser as generatedParser } from "./grammar.js";

export const parser: LRParser = generatedParser;

export * from "./grammar.terms.js";

export function parse(source: string): Tree {
  return parser.parse(source);
}

export function printTree(source: string): string {
  const tree = parser.parse(source);
  const lines: string[] = [];

  function visit(cursor: TreeCursor, depth: number) {
    const indent = "  ".repeat(depth);
    const text = source.slice(cursor.from, cursor.to);
    const preview = text.length > 40 ? text.slice(0, 40) + "..." : text;
    lines.push(`${indent}${cursor.name} [${cursor.from}-${cursor.to}]`);

    if (cursor.firstChild()) {
      do {
        visit(cursor, depth + 1);
      } while (cursor.nextSibling());
      cursor.parent();
    }
  }

  const cursor = tree.cursor();
  visit(cursor, 0);

  return lines.join("\n");
}

export function hasErrors(tree: Tree): boolean {
  let foundError = false;
  tree.cursor().iterate((node) => {
    if (node.type.isError) {
      foundError = true;
      return false;
    }
  });
  return foundError;
}

export function getErrors(source: string): Array<{ from: number; to: number; message: string }> {
  const tree = parser.parse(source);
  const errors: Array<{ from: number; to: number; message: string }> = [];

  tree.cursor().iterate((node) => {
    if (node.type.isError) {
      errors.push({
        from: node.from,
        to: node.to,
        message: `Syntax error at position ${node.from}`,
      });
    }
  });

  return errors;
}
