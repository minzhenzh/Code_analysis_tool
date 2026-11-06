// Tests for the Log and Throw detector, run against fixtures/LogAndThrow.java.
// The expected results come from the FLAG / NO FLAG labels in that fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseJava, parseJavaFile } from "../parser";
import { detectLogAndThrow, isLoggingCall } from "../detectors/logAndThrow";

const fixture = path.join(__dirname, "..", "..", "fixtures", "LogAndThrow.java");
const result = detectLogAndThrow(parseJavaFile(fixture), fixture);
const flaggedMethods = result.findings.map((f) => f.method);

test("flags every method labelled FLAG", () => {
  assert.deepEqual(flaggedMethods, ["a", "b", "e", "julLogger", "conditionalThrow"]);
});

test("does not flag methods labelled NO FLAG", () => {
  for (const name of ["c", "d", "notALogCall", "eitherLogOrThrow"]) {
    assert.ok(!flaggedMethods.includes(name), `${name} should not be flagged`);
  }
});

test("counts every catch block as the denominator", () => {
  // a, b, c, d, e, julLogger, conditionalThrow, notALogCall, eitherLogOrThrow each have one catch
  assert.equal(result.total, 9);
});

// Run the detector on one catch body and return how many catch blocks were flagged.
function flagsInCatch(catchBody: string): number {
  const tree = parseJava(`class A { void m() { try { read(); } catch (IOException e) { ${catchBody} } } }`);
  return detectLogAndThrow(tree, "A.java").findings.length;
}

test("a log and a throw in opposite if/else branches are not flagged", () => {
  assert.equal(flagsInCatch(`if (quiet) { LOG.warn("x"); } else { throw e; }`), 0);
  assert.equal(flagsInCatch(`if (quiet) { throw e; } else { LOG.warn("x"); }`), 0);
  // else-if chain: still opposite branches of the outer if
  assert.equal(flagsInCatch(`if (a) { LOG.warn("x"); } else if (b) { throw e; }`), 0);
});

test("a log and a throw that can both happen are flagged", () => {
  assert.equal(flagsInCatch(`if (verbose) { LOG.warn("x"); } throw e;`), 1); // throw is after the if
  assert.equal(flagsInCatch(`if (bad) { LOG.warn("x"); throw e; }`), 1);    // same branch
  // one pair is exclusive, but the second log can still happen before the throw
  assert.equal(flagsInCatch(`LOG.error("y"); if (q) { LOG.warn("x"); } else { throw e; }`), 1);
});

test("reports the catch line, method and what was found", () => {
  const a = result.findings[0];
  assert.equal(a.line, 18);
  assert.equal(a.antiPattern, "Log and Throw");
  assert.equal(a.detail, "logs with LOG.error (line 19), throws at line 20");
});

test("a log call in the try block (not the catch) does not count", () => {
  const tree = parseJava(`class A { void m() throws Exception {
    try { LOG.info("start"); read(); } catch (IOException e) { throw e; }
  } }`);
  assert.equal(detectLogAndThrow(tree, "A.java").findings.length, 0);
});

// Parse `statement` inside a method and return its first (outermost) method call.
function firstCall(statement: string) {
  const tree = parseJava(`class A { void m() { ${statement} } }`);
  return tree.rootNode.descendantsOfType("method_invocation")[0];
}

test("recognises logger calls in their common forms", () => {
  assert.ok(isLoggingCall(firstCall(`LOG.error("x", e);`)));
  assert.ok(isLoggingCall(firstCall(`logger.log(Level.WARNING, "x", e);`)));
  assert.ok(isLoggingCall(firstCall(`this.logger.warn("x");`)));
  assert.ok(isLoggingCall(firstCall(`getLogger().info("x");`)));
});

test("recognises console printing", () => {
  assert.ok(isLoggingCall(firstCall(`System.err.println("x");`)));
  assert.ok(isLoggingCall(firstCall(`System.out.printf("%s", x);`)));
  assert.ok(isLoggingCall(firstCall(`e.printStackTrace();`)));
});

test("rejects calls that are not logging", () => {
  assert.ok(!isLoggingCall(firstCall(`failures.add(e);`)));        // not a logger, not a log method
  assert.ok(!isLoggingCall(firstCall(`LOG.isDebugEnabled();`)));   // logger, but not a log method
  assert.ok(!isLoggingCall(firstCall(`error("x");`)));             // log method name, but no logger
  assert.ok(!isLoggingCall(firstCall(`out.println("x");`)));       // println, but not System.out/err
});
