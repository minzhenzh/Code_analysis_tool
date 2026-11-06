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

// The short name of a type node, which is how we compare exception types:
//   IOException               -> "IOException"
//   java.io.IOException       -> "IOException"   (drop the package)
//   java.util.AbstractList<T> -> "AbstractList"  (drop the generic part)
export function simpleTypeName(typeNode: Parser.SyntaxNode): string {
  const withoutGenerics = typeNode.text.split("<")[0];
  const parts = withoutGenerics.split(".");
  return parts[parts.length - 1].trim();
}

// The exception type of `throw new X(...)`, or null for other forms such as `throw e;`.
export function thrownTypeName(throwStatement: Parser.SyntaxNode): string | null {
  const thrown = throwStatement.namedChildren.find((child) => !isComment(child));
  if (thrown !== undefined && thrown.type === "object_creation_expression") {
    const type = thrown.childForFieldName("type");
    return type !== null ? simpleTypeName(type) : null;
  }
  return null;
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
