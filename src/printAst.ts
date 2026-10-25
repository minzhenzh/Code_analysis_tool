// printAst.ts
// Stage 1 helper: parse one Java file and print its syntax tree.
// We use it to SEE which tree-sitter node types each Java construct becomes,
// before writing a detector that searches for those node types.
//
// Usage:
//   node dist/printAst.js <file.java>                 named nodes only
//   node dist/printAst.js <file.java> --all           also keywords/punctuation
//   node dist/printAst.js <file.java> --lines 14-15   only nodes overlapping lines 14..15
//   node dist/printAst.js <file.java> --no-comments   hide // and /* */ comment nodes
//   node dist/printAst.js <file.java> > out/ast.txt   save the output to a file instead
//
// Example output:
//   catch_clause  (lines 18-21)
//   ├── catch_formal_parameter  (line 18)
//   │   ├── catch_type
//   │   │   └── type_identifier "IOException"
//   │   └── name: identifier "e"
//   └── body: block  (lines 18-21)

import Parser from "tree-sitter";
import { parseJavaFile } from "./parser";

// An `interface` describes the shape of an object (like a JSDoc @typedef).
interface PrintOptions {
  showAnonymous: boolean; // print keywords/punctuation such as "throws", "{", ","
  showComments: boolean;  // print line_comment / block_comment nodes
  firstLine: number;      // only print nodes that overlap this line range (1-based)
  lastLine: number;
}

// tree-sitter counts rows from 0; editors count lines from 1. We print 1-based.
function startLine(node: Parser.SyntaxNode): number {
  return node.startPosition.row + 1;
}

function endLine(node: Parser.SyntaxNode): number {
  // A node that ends at column 0 really ends with the previous line's newline.
  if (node.endPosition.column === 0 && node.endPosition.row > node.startPosition.row) {
    return node.endPosition.row;
  }
  return node.endPosition.row + 1;
}

// "line 19" or "lines 18-21"
function lineLabel(node: Parser.SyntaxNode): string {
  const start = startLine(node);
  const end = endLine(node);
  return start === end ? `line ${start}` : `lines ${start}-${end}`;
}

// Decide whether a node should appear in the output.
function isVisible(node: Parser.SyntaxNode, opts: PrintOptions): boolean {
  // Anonymous nodes are the literal tokens of the grammar (keywords, symbols).
  // They carry no extra information beyond their text, so hide them by default.
  if (!node.isNamed && !opts.showAnonymous) {
    return false;
  }
  if (!opts.showComments && (node.type === "line_comment" || node.type === "block_comment")) {
    return false;
  }
  // Hide nodes completely outside the requested line range.
  return endLine(node) >= opts.firstLine && startLine(node) <= opts.lastLine;
}

// Build the one-line description of a node, e.g.
//   name: identifier "LOG"  (line 19)
function describe(node: Parser.SyntaxNode, fieldName: string | null, parentLabel: string): string {
  // Fields are named "slots" in the parent, e.g. a method_declaration has a
  // `name:` field and a `body:` field. Detectors will use these names.
  const field = fieldName ? fieldName + ": " : "";
  const type = node.isNamed ? node.type : JSON.stringify(node.type);

  // For small nodes with no named children also show the source text,
  // e.g. an identifier's name, or "public" for a modifiers node.
  const showText = node.isNamed && node.namedChildCount === 0 && startLine(node) === endLine(node);
  const text = showText ? " " + JSON.stringify(node.text) : "";

  // Only print the position when it differs from the parent's, so we don't
  // repeat "line 19" on every node of line 19.
  const label = lineLabel(node);
  const position = label !== parentLabel ? `  (${label})` : "";

  return field + type + text + position;
}

// Recursively print the children of `node`, drawing tree lines:
//   ├──  a child that has more siblings after it
//   └──  the last child
//   │    a "still going" line for an ancestor that has more siblings below
// `prefix` holds the vertical lines inherited from the ancestors.
function printChildren(node: Parser.SyntaxNode, prefix: string, opts: PrintOptions): void {
  // First collect the visible children, so we know which one is last.
  // Each entry remembers the child and its field name (or null).
  const visible: { child: Parser.SyntaxNode; field: string | null }[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child !== null && isVisible(child, opts)) {
      visible.push({ child: child, field: node.fieldNameForChild(i) });
    }
  }

  for (let i = 0; i < visible.length; i++) {
    const isLast = i === visible.length - 1;
    const { child, field } = visible[i];
    console.log(prefix + (isLast ? "└── " : "├── ") + describe(child, field, lineLabel(node)));
    printChildren(child, prefix + (isLast ? "    " : "│   "), opts);
  }
}

function main(): void {
  // process.argv = ["node", "dist/printAst.js", <file>, ...flags]
  const args = process.argv.slice(2);
  const opts: PrintOptions = { showAnonymous: false, showComments: true, firstLine: 1, lastLine: Infinity };
  let filePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      opts.showAnonymous = true;
    } else if (args[i] === "--no-comments") {
      opts.showComments = false;
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
    console.error("Usage: node dist/printAst.js <file.java> [--all] [--no-comments] [--lines FROM-TO]");
    process.exit(1);
  }

  const tree = parseJavaFile(filePath);
  const root = tree.rootNode;
  console.log(describe(root, null, ""));
  printChildren(root, "", opts);

  // hasError is true if tree-sitter had to insert ERROR/MISSING nodes.
  // console.error goes to the terminal even when the output is saved to a file.
  if (root.hasError) {
    console.error("\nWarning: the file contains syntax errors (look for ERROR / MISSING nodes).");
  }
}

main();
