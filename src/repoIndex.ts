// repoIndex.ts
// Pass 1 of the analysis: read ALL files of the repo once and remember two facts that
// the Unreachable Handler detector needs but cannot see inside a single try block:
//
//   1. superclassOf:  class name  -> the class it extends
//        class ConfigException extends RuntimeException  =>  "ConfigException" -> "RuntimeException"
//
//   2. methodThrows:  method name -> exceptions that method may throw, collected from
//        a) its `throws` clause                   void openFile() throws FileNotFoundException
//        b) `@throws X` / `@exception X` Javadoc   /** @throws IllegalArgumentException if ... */
//        c) `throw new X(...)` in its body          void loadConfig() { throw new ConfigException(); }
//      Constructors are stored under their class name, so `new Foo()` can be looked up too.
//
// Without type information we cannot tell which class a call like `x.close()` belongs to,
// so methods are keyed by NAME ONLY: all methods named "close" in the repo share one entry.

import Parser from "tree-sitter";
import { isComment, simpleTypeName, thrownTypeName } from "./astUtils";

export interface RepoIndex {
  superclassOf: Map<string, string>;
  methodThrows: Map<string, string[]>;
}

export function buildRepoIndex(trees: Parser.Tree[]): RepoIndex {
  const index: RepoIndex = { superclassOf: new Map(), methodThrows: new Map() };

  for (const tree of trees) {
    // 1. class X extends Y
    for (const cls of tree.rootNode.descendantsOfType("class_declaration")) {
      const name = cls.childForFieldName("name");
      const superclass = cls.childForFieldName("superclass"); // the `extends Y` part
      if (name !== null && superclass !== null && superclass.namedChildren.length > 0) {
        index.superclassOf.set(name.text, simpleTypeName(superclass.namedChildren[0]));
      }
    }

    // 2. what each method / constructor may throw
    const declarations = tree.rootNode.descendantsOfType(["method_declaration", "constructor_declaration"]);
    for (const decl of declarations) {
      const name = decl.childForFieldName("name");
      if (name === null) {
        continue;
      }
      const exceptions = [...declaredThrows(decl), ...javadocThrows(decl), ...bodyThrows(decl)];
      addExceptions(index, name.text, exceptions);
    }
  }
  return index;
}

// a) the types listed in the method's `throws` clause
function declaredThrows(decl: Parser.SyntaxNode): string[] {
  const clause = decl.namedChildren.find((child) => child.type === "throws");
  if (clause === undefined) {
    return [];
  }
  return clause.namedChildren.filter((child) => !isComment(child)).map(simpleTypeName);
}

// b) `@throws X` / `@exception X` tags in the Javadoc comment right before the method.
// tree-sitter keeps the comment as a block_comment node just before the declaration.
function javadocThrows(decl: Parser.SyntaxNode): string[] {
  const comment = decl.previousNamedSibling;
  if (comment === null || comment.type !== "block_comment" || !comment.text.startsWith("/**")) {
    return [];
  }
  const result: string[] = [];
  // A regular expression: "@throws" or "@exception", spaces, then the type name (letters, digits, _ and .)
  for (const match of comment.text.matchAll(/@(?:throws|exception)\s+([\w.]+)/g)) {
    const parts = match[1].split(".");
    result.push(parts[parts.length - 1]); // java.io.IOException -> IOException
  }
  return result;
}

// c) `throw new X(...)` statements anywhere in the method's body (one level only:
// we do not follow the calls this method makes).
function bodyThrows(decl: Parser.SyntaxNode): string[] {
  const body = decl.childForFieldName("body");
  if (body === null) {
    return []; // abstract / interface method
  }
  const result: string[] = [];
  for (const throwStatement of body.descendantsOfType("throw_statement")) {
    const type = thrownTypeName(throwStatement);
    if (type !== null) {
      result.push(type);
    }
  }
  return result;
}

// Add exceptions to a method name's entry, skipping duplicates.
function addExceptions(index: RepoIndex, methodName: string, exceptions: string[]): void {
  const existing = index.methodThrows.get(methodName) ?? []; // `??` = "use [] if missing"
  for (const exception of exceptions) {
    if (!existing.includes(exception)) {
      existing.push(exception);
    }
  }
  index.methodThrows.set(methodName, existing);
}
