// logAndThrow.ts
// Detector for "Log and Throw" (paper, Table I):
//   "The handler logs some information and propagates the exception."
//
// Rule: FLAG a catch block whose body contains (anywhere inside it, also nested in
// if/for/blocks) BOTH a logging call AND a throw statement, unless the two are in
// opposite branches of the same if/else (then the handler logs OR throws, never both):
//   if (swallow) { LOG.warn(...); } else { throw e; }     -> NO FLAG
//   LOG.error(...); if (strict) { throw e; }               -> FLAG (both can happen)
//
// Tree shape we rely on (see `node dist/printAst.js fixtures/LogAndThrow.java`):
//   catch_clause                      <- one per catch block (the denominator)
//   ├── catch_formal_parameter        (IOException e)
//   └── body: block                   <- we only search inside here
//       ├── expression_statement
//       │   └── method_invocation     <- a logging call?
//       │       ├── object: identifier "LOG"
//       │       └── name: identifier "error"
//       └── throw_statement           <- a throw
//
// What counts as a "logging call" (the paper does not define it; our decision):
//   1. Logger calls: the object looks like a logger AND the method is a logging method,
//      e.g. LOG.error(...), logger.log(Level.WARNING, ...), this.logger.warn(...).
//   2. Console printing: System.out / System.err .print / .println / .printf, and
//      printStackTrace() (e.g. e.printStackTrace()).

import Parser from "tree-sitter";
import { DetectorResult, Finding } from "../types";
import { enclosingMethodName, startLine } from "../astUtils";

// Methods of the common Java logging libraries:
//   SLF4J / Log4j / Commons Logging: trace debug info warn error fatal
//   java.util.logging (used by Guava): log severe warning info config fine finer finest
const LOGGING_METHODS = new Set([
  "trace", "debug", "info", "warn", "error", "fatal",
  "log", "severe", "warning", "config", "fine", "finer", "finest",
]);

const PRINT_METHODS = new Set(["print", "println", "printf"]);

// A logger variable is usually named LOG, LOGGER, logger, log, or something ending in
// "log"/"logger" (auditLog, sLogger). Also matches getLogger() in getLogger().info(...).
function looksLikeLogger(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith("log") || lower.endsWith("logger");
}

// The name of the thing a method is called on:
//   LOG.error()              object is identifier "LOG"            -> "LOG"
//   this.logger.warn()       object is field_access this.logger    -> "logger" (its last part)
//   getLogger().info()       object is method_invocation getLogger -> "getLogger"
function objectName(object: Parser.SyntaxNode): string {
  if (object.type === "field_access") {
    const field = object.childForFieldName("field");
    return field !== null ? field.text : object.text;
  }
  if (object.type === "method_invocation") {
    const name = object.childForFieldName("name");
    return name !== null ? name.text : object.text;
  }
  return object.text;
}

export function isLoggingCall(call: Parser.SyntaxNode): boolean {
  const nameNode = call.childForFieldName("name");
  if (nameNode === null) {
    return false;
  }
  const method = nameNode.text;
  const object = call.childForFieldName("object"); // null for a plain call like read()

  // e.printStackTrace() prints the exception to the console.
  if (method === "printStackTrace") {
    return true;
  }
  if (object === null) {
    return false;
  }
  // System.out.println(...) / System.err.println(...)
  if (PRINT_METHODS.has(method) && (object.text === "System.out" || object.text === "System.err")) {
    return true;
  }
  // LOG.error(...), logger.log(...), ...
  return LOGGING_METHODS.has(method) && looksLikeLogger(objectName(object));
}

export function detectLogAndThrow(tree: Parser.Tree, filePath: string): DetectorResult {
  const findings: Finding[] = [];
  const catchClauses = tree.rootNode.descendantsOfType("catch_clause");

  for (const catchClause of catchClauses) {
    const body = catchClause.childForFieldName("body");
    if (body === null) {
      continue; // only happens for broken code
    }

    // descendantsOfType searches the whole subtree, so a throw inside an `if`
    // in the catch body is found too.
    const logCalls = body.descendantsOfType("method_invocation").filter(isLoggingCall);
    const throwStatements = body.descendantsOfType("throw_statement");

    // Find a log call and a throw that can both happen in the same run of the handler.
    const pair = findLogAndThrowPair(logCalls, throwStatements);
    if (pair !== null) {
      const callee = pair.log.text.split("(")[0]; // "LOG.error(...)" -> "LOG.error"
      findings.push({
        antiPattern: "Log and Throw",
        file: filePath,
        line: startLine(catchClause),
        method: enclosingMethodName(catchClause),
        detail: `logs with ${callee} (line ${startLine(pair.log)}), throws at line ${startLine(pair.throwStatement)}`,
      });
    }
  }

  // Every catch block counts toward the denominator, flagged or not.
  return { findings: findings, total: catchClauses.length };
}

// Return the first (log call, throw) pair that is NOT in opposite if/else branches,
// or null if there is none (also when there are no log calls or no throws).
function findLogAndThrowPair(
  logCalls: Parser.SyntaxNode[],
  throwStatements: Parser.SyntaxNode[],
): { log: Parser.SyntaxNode; throwStatement: Parser.SyntaxNode } | null {
  for (const log of logCalls) {
    for (const throwStatement of throwStatements) {
      if (!inOppositeBranches(log, throwStatement)) {
        return { log: log, throwStatement: throwStatement };
      }
    }
  }
  return null;
}

// Is node `inner` inside node `outer` (or the same node)? Compares character positions.
function contains(outer: Parser.SyntaxNode, inner: Parser.SyntaxNode): boolean {
  return outer.startIndex <= inner.startIndex && inner.endIndex <= outer.endIndex;
}

// True if a and b sit in opposite branches of the same if/else:
//   if_statement                 <- the closest node containing both a and b
//   ├── consequence: ... a ...   (the "then" part)
//   └── alternative: ... b ...   (the "else" part)
function inOppositeBranches(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
  // Walk up from a until we reach the closest ancestor that also contains b.
  let common = a.parent;
  while (common !== null && !contains(common, b)) {
    common = common.parent;
  }
  if (common === null || common.type !== "if_statement") {
    return false;
  }
  const consequence = common.childForFieldName("consequence");
  const alternative = common.childForFieldName("alternative");
  if (consequence === null || alternative === null) {
    return false; // an `if` without `else`
  }
  return (contains(consequence, a) && contains(alternative, b)) ||
    (contains(alternative, a) && contains(consequence, b));
}
