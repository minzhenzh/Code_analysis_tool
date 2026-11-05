// astUtils.ts
// Small helpers for working with tree-sitter nodes, shared by all detectors.

import Parser from "tree-sitter";

// tree-sitter counts rows from 0; editors count lines from 1. We report 1-based.
export function startLine(node: Parser.SyntaxNode): number {
  return node.startPosition.row + 1;
}

export function isComment(node: Parser.SyntaxNode): boolean {
  return node.type === "line_comment" || node.type === "block_comment";
}

// Walk up the tree (node -> parent -> parent ...) until we reach the method or
// constructor that contains `node`, and return its name.
export function enclosingMethodName(node: Parser.SyntaxNode): string {
  let current = node.parent;
  while (current !== null) {
    if (current.type === "method_declaration" || current.type === "constructor_declaration") {
      const name = current.childForFieldName("name");
      return name !== null ? name.text : "<unknown>";
    }
    current = current.parent;
  }
  return "<none>"; // e.g. code in a static initializer block, outside any method
}
