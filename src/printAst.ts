// printAst.ts
// Stage 1 helper: parse one Java file and print its syntax tree, indented.
// We use it to SEE which tree-sitter node types each Java construct becomes,
// before writing a detector that searches for those node types.
//
// Usage:
//   node dist/printAst.js <file.java>                 named nodes only
//   node dist/printAst.js <file.java> --all           also keywords/punctuation
//   node dist/printAst.js <file.java> --lines 14-15   only nodes overlapping lines 14..15

import Parser from "tree-sitter";
import { parseJavaFile } from "./parser";

// An `interface` describes the shape of an object (like a JSDoc @typedef).
interface PrintOptions {
  showAnonymous: boolean; // print keywords/punctuation such as "throws", "{", ","
  firstLine: number;      // only print nodes that overlap this line range (1-based)
  lastLine: number;
}

// tree-sitter counts rows from 0; editors count lines from 1. We print 1-based.
function lineOf(point: Parser.Point): number {
  return point.row + 1;
}

// Recursively print `node` and its children.
// `fieldName: string | null` is a union type: either a string or null.
function printNode(node: Parser.SyntaxNode, fieldName: string | null, depth: number, opts: PrintOptions): void {
  const start = lineOf(node.startPosition);
  // A node that ends at column 0 really ends with the previous line's newline.
  const end = node.endPosition.column === 0 && node.endPosition.row > node.startPosition.row
    ? node.endPosition.row
    : lineOf(node.endPosition);

  // Skip whole subtrees that are outside the requested line range.
  if (end < opts.firstLine || start > opts.lastLine) {
    return;
  }

  // Anonymous nodes are the literal tokens of the grammar (keywords, symbols).
  // They carry no extra information beyond their text, so hide them by default.
  if (node.isNamed || opts.showAnonymous) {
    const indent = "  ".repeat(depth);
    // Fields are named "slots" in the parent, e.g. a method_declaration has a
    // `name:` field and a `body:` field. Detectors will use these names.
    const field = fieldName ? fieldName + ": " : "";
    const label = node.isNamed ? node.type : JSON.stringify(node.type);
    const range = start === end ? `[line ${start}]` : `[lines ${start}-${end}]`;
    // For small nodes with no named children also show the source text,
    // e.g. an identifier's name, or "public" for a modifiers node.
    const showText = node.isNamed && node.namedChildCount === 0 && start === end;
    const text = showText ? "  " + JSON.stringify(node.text) : "";
    console.log(`${indent}${field}${label} ${range}${text}`);
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child !== null) {
      printNode(child, node.fieldNameForChild(i), depth + 1, opts);
    }
  }
}

function main(): void {
  // process.argv = ["node", "dist/printAst.js", <file>, ...flags]
  const args = process.argv.slice(2);
  const opts: PrintOptions = { showAnonymous: false, firstLine: 1, lastLine: Infinity };
  let filePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      opts.showAnonymous = true;
    } else if (args[i] === "--lines") {
      // "14-15" -> [14, 15]; a single number "14" means just that line.
      const parts = args[i + 1].split("-").map(Number);
      opts.firstLine = parts[0];
      opts.lastLine = parts.length > 1 ? parts[1] : parts[0];
      i++; // skip the value we just consumed
    } else {
      filePath = args[i];
    }
  }

  if (filePath === null) {
    console.error("Usage: node dist/printAst.js <file.java> [--all] [--lines FROM-TO]");
    process.exit(1);
  }

  const tree = parseJavaFile(filePath);
  printNode(tree.rootNode, null, 0, opts);

  // hasError is true if tree-sitter had to insert ERROR/MISSING nodes.
  if (tree.rootNode.hasError) {
    console.error("\nWarning: the file contains syntax errors (look for ERROR / MISSING nodes).");
  }
}

main();
