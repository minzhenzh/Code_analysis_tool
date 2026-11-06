// unreachableHandler.ts
// Detector for "Unreachable Handler" (paper, Table I):
//   "The handler does not catch any possible exception from the try block."
//
// Rule: FLAG a catch block if NONE of its caught types is related to ANY exception the
// try block can possibly throw. Two types are related if one is the other or a subclass
// of it (in either direction):
//   - try throws FileNotFoundException, catch (IOException)  -> related (catch is the parent)
//   - try calls a method declaring IOException, catch (FileNotFoundException)
//                                                            -> related (the method may throw
//                                                               any IOException, incl. this child)
// catch (Exception) and catch (Throwable) are always counted as reachable.
//
// Tree-sitter has no type information, so "what can the try block throw" is approximated
// from what is written in the try block (its `body:` and, for try-with-resources, its
// `resources:`):
//   1. `throw new X(...)`                         -> X
//      `throw e;`                                 -> the declared type of variable e
//   2. a method call  foo(...) / x.foo(...)       -> what the repo index and JDK table say
//                                                    about methods NAMED foo
//   3. `new Foo(...)`                             -> what Foo's constructors may throw
//   4. operations that throw without a call:
//        a / b, a % b      -> ArithmeticException (division by zero)
//        a[i]              -> ArrayIndexOutOfBoundsException, NullPointerException
//        (Foo) x           -> ClassCastException
//        x.foo(), x.field  -> NullPointerException (x may be null)
//        assert ...        -> AssertionError
//   5. try-with-resources closes its resources    -> what close() may throw

import Parser from "tree-sitter";
import { DetectorResult, Finding } from "../types";
import { enclosingMethodName, isComment, simpleTypeName, startLine, thrownTypeName } from "../astUtils";
import { RepoIndex } from "../repoIndex";
import { JDK_CONSTRUCTOR_THROWS, JDK_METHOD_THROWS, JDK_SUPERCLASS } from "../jdkExceptions";

// Catching these catches everything, so they are always reachable.
const GENERIC_CATCH_TYPES = ["Exception", "Throwable"];

// What we found the try block can throw.
interface PossibleExceptions {
  types: string[];
  // true if the try block throws something whose type we could not work out,
  // e.g. `throw makeException();`. Then we cannot claim the handler is unreachable.
  hasUnknownThrow: boolean;
}

export function detectUnreachableHandler(tree: Parser.Tree, filePath: string, index: RepoIndex): DetectorResult {
  const findings: Finding[] = [];
  const catchClauses = tree.rootNode.descendantsOfType("catch_clause");

  for (const catchClause of catchClauses) {
    const caughtTypes = getCaughtTypes(catchClause);
    if (caughtTypes.some((type) => GENERIC_CATCH_TYPES.includes(type))) {
      continue; // catch (Exception e) is always reachable
    }

    // The catch's parent is the try_statement (or try_with_resources_statement).
    const tryStatement = catchClause.parent;
    if (tryStatement === null) {
      continue;
    }
    const possible = collectPossibleExceptions(tryStatement, index);
    if (possible.hasUnknownThrow) {
      continue;
    }

    const reachable = caughtTypes.some((caught) =>
      possible.types.some((thrown) => areRelated(caught, thrown, index)),
    );
    if (!reachable) {
      const canThrow = possible.types.length > 0 ? possible.types.join(", ") : "nothing the tool can find";
      findings.push({
        antiPattern: "Unreachable Handler",
        file: filePath,
        line: startLine(catchClause),
        method: enclosingMethodName(catchClause),
        detail: `catches ${caughtTypes.join(" | ")}; try block can throw: ${canThrow}`,
      });
    }
  }

  return { findings: findings, total: catchClauses.length };
}

// catch (IOException e)                      -> ["IOException"]
// catch (IOException | SQLException e)       -> ["IOException", "SQLException"]
function getCaughtTypes(catchClause: Parser.SyntaxNode): string[] {
  const types: string[] = [];
  for (const catchType of catchClause.descendantsOfType("catch_type")) {
    for (const type of catchType.namedChildren) {
      if (!isComment(type)) {
        types.push(simpleTypeName(type));
      }
    }
  }
  return types;
}

function collectPossibleExceptions(tryStatement: Parser.SyntaxNode, index: RepoIndex): PossibleExceptions {
  const result: PossibleExceptions = { types: [], hasUnknownThrow: false };
  const add = (types: string[]) => {
    for (const type of types) {
      if (!result.types.includes(type)) {
        result.types.push(type);
      }
    }
  };

  // Only the try part: its body and (try-with-resources) its resources. Not the catches.
  const regions: Parser.SyntaxNode[] = [];
  for (const field of ["body", "resources"]) {
    const region = tryStatement.childForFieldName(field);
    if (region !== null) {
      regions.push(region);
    }
  }

  for (const region of regions) {
    // 1. throw statements
    for (const throwStatement of region.descendantsOfType("throw_statement")) {
      const created = thrownTypeName(throwStatement); // throw new X(...) -> "X"
      const variableTypes = created === null ? variableTypeOfThrow(throwStatement) : null; // throw e;
      if (created !== null) {
        add([created]);
      } else if (variableTypes !== null) {
        add(variableTypes);
      } else {
        result.hasUnknownThrow = true;
      }
    }

    // 2. method calls
    for (const call of region.descendantsOfType("method_invocation")) {
      const name = call.childForFieldName("name");
      if (name !== null) {
        add(index.methodThrows.get(name.text) ?? []);
        add(JDK_METHOD_THROWS.get(name.text) ?? []);
      }
      if (canBeNull(call.childForFieldName("object"))) {
        add(["NullPointerException"]);
      }
    }

    // 3. constructor calls: new Foo(...)
    for (const creation of region.descendantsOfType("object_creation_expression")) {
      const type = creation.childForFieldName("type");
      if (type !== null) {
        const className = simpleTypeName(type);
        add(index.methodThrows.get(className) ?? []); // constructors are indexed by class name
        add(JDK_CONSTRUCTOR_THROWS.get(className) ?? []);
      }
    }

    // 4. operations that can throw without any call
    for (const binary of region.descendantsOfType("binary_expression")) {
      const operator = binary.childForFieldName("operator");
      if (operator !== null && (operator.type === "/" || operator.type === "%")) {
        add(["ArithmeticException"]);
      }
    }
    if (region.descendantsOfType("array_access").length > 0) {
      add(["ArrayIndexOutOfBoundsException", "NullPointerException"]);
    }
    if (region.descendantsOfType("cast_expression").length > 0) {
      add(["ClassCastException"]);
    }
    for (const fieldAccess of region.descendantsOfType("field_access")) {
      if (canBeNull(fieldAccess.childForFieldName("object"))) {
        add(["NullPointerException"]);
      }
    }
    if (region.descendantsOfType("assert_statement").length > 0) {
      add(["AssertionError"]);
    }
  }

  // 5. try-with-resources calls close() on each resource at the end
  if (tryStatement.type === "try_with_resources_statement") {
    add(index.methodThrows.get("close") ?? []);
    add(JDK_METHOD_THROWS.get("close") ?? []);
  }

  return result;
}

// `x.foo()` / `x.field` can throw NullPointerException if x is null.
// `foo()` (no object), `this.foo()` and `super.foo()` cannot.
function canBeNull(object: Parser.SyntaxNode | null): boolean {
  return object !== null && object.type !== "this" && object.type !== "super";
}

// For `throw e;`: find where the variable e is declared in the same method and return its
// type(s). e can be a catch parameter (possibly a multi-catch), a method parameter, or a
// local variable. Returns null if we cannot find it.
function variableTypeOfThrow(throwStatement: Parser.SyntaxNode): string[] | null {
  const thrown = throwStatement.namedChildren.find((child) => !isComment(child));
  if (thrown === undefined || thrown.type !== "identifier") {
    return null; // e.g. throw makeException();
  }
  const variable = thrown.text;

  // Search the enclosing method (or the whole file if there is none).
  let scope: Parser.SyntaxNode = throwStatement;
  while (scope.parent !== null && scope.type !== "method_declaration" && scope.type !== "constructor_declaration") {
    scope = scope.parent;
  }

  for (const param of scope.descendantsOfType("catch_formal_parameter")) {
    if (param.childForFieldName("name")?.text === variable) {
      return getCaughtTypes(param.parent!); // `!` tells TypeScript: this parent is never null
    }
  }
  for (const declaration of scope.descendantsOfType(["formal_parameter", "local_variable_declaration"])) {
    const type = declaration.childForFieldName("type");
    // formal_parameter has a `name:` field; local_variable_declaration has `declarator:`s with names.
    const names = declaration.type === "formal_parameter"
      ? [declaration.childForFieldName("name")?.text]
      : declaration.descendantsOfType("variable_declarator").map((d) => d.childForFieldName("name")?.text);
    if (type !== null && names.includes(variable)) {
      return [simpleTypeName(type)];
    }
  }
  return null;
}

// Is `a` the same as `b`, or a subclass of it?
function isSubtype(a: string, b: string, index: RepoIndex): boolean {
  let current: string | undefined = a;
  // Follow the "extends" chain upwards. The step limit protects against a loop in broken code.
  for (let steps = 0; current !== undefined && steps < 50; steps++) {
    if (current === b) {
      return true;
    }
    // The repo's own classes first, then the JDK table.
    current = index.superclassOf.get(current) ?? JDK_SUPERCLASS.get(current);
  }
  return false;
}

function areRelated(caught: string, thrown: string, index: RepoIndex): boolean {
  return isSubtype(thrown, caught, index) || isSubtype(caught, thrown, index);
}
