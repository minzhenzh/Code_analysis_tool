// throwsKitchenSink.ts
// Detector for "Throws Kitchen Sink" (paper, Table I):
//   "The throws clause propagates multiple exceptions."
//
// Rule: FLAG every throws clause that lists 2 or more exception types.
// This is purely syntactic: we only look at the declaration, never at the method body.
//
// Tree shape we rely on (see `node dist/printAst.js fixtures/ThrowsKitchenSink.java`):
//   method_declaration            (or constructor_declaration)
//   ├── name: identifier "load"
//   ├── throws                    <- one node per throws clause
//   │   ├── type_identifier "IOException"     <- one named child per exception type
//   │   └── type_identifier "SQLException"
//   └── body: block
//
// A fully qualified type (java.io.IOException) is ONE scoped_type_identifier child,
// so counting the DIRECT named children gives the right number of types.

import Parser from "tree-sitter";
import { DetectorResult, Finding } from "../types";
import { enclosingMethodName, isComment, startLine } from "../astUtils";

export function detectThrowsKitchenSink(tree: Parser.Tree, filePath: string): DetectorResult {
  const findings: Finding[] = [];

  // descendantsOfType("throws") returns BOTH the clause nodes (named) and the
  // `throws` keyword tokens inside them (anonymous, same type name).
  // We only want the clauses, so keep the named ones.
  const clauses = tree.rootNode.descendantsOfType("throws").filter((node) => node.isNamed);

  for (const clause of clauses) {
    // Each named child is one exception type. Skip comments, which are also
    // named nodes, e.g. `throws IOException, /* rare */ SQLException`.
    const types = clause.namedChildren.filter((child) => !isComment(child));

    if (types.length >= 2) {
      const typeNames = types.map((t) => t.text).join(", ");
      findings.push({
        antiPattern: "Throws Kitchen Sink",
        file: filePath,
        line: startLine(clause),
        method: enclosingMethodName(clause),
        detail: `throws ${types.length} types: ${typeNames}`,
      });
    }
  }

  // Every clause counts toward the denominator, flagged or not.
  return { findings: findings, total: clauses.length };
}
