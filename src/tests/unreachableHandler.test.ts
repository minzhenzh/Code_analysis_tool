// Tests for the Unreachable Handler detector and the repo index,
// run against fixtures/UnreachableHandler.java plus a few small inline examples.
// The expected results come from the FLAG / NO FLAG labels in the fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseJava, parseJavaFile } from "../parser";
import { buildRepoIndex } from "../repoIndex";
import { detectUnreachableHandler } from "../detectors/unreachableHandler";

const fixture = path.join(__dirname, "..", "..", "fixtures", "UnreachableHandler.java");
const fixtureTree = parseJavaFile(fixture);
const fixtureIndex = buildRepoIndex([fixtureTree]);
const result = detectUnreachableHandler(fixtureTree, fixture, fixtureIndex);
const flaggedMethods = result.findings.map((f) => f.method);

test("flags every method labelled FLAG", () => {
  assert.deepEqual(flaggedMethods, ["a", "f", "unrelatedType"]);
});

test("does not flag methods labelled NO FLAG", () => {
  for (const name of ["b", "c", "d", "e", "g", "declaredParent", "multiCatch", "division"]) {
    assert.ok(!flaggedMethods.includes(name), `${name} should not be flagged`);
  }
});

test("counts every catch block as the denominator", () => {
  assert.equal(result.total, 11);
});

test("reports what was caught and what the try block can throw", () => {
  const unrelated = result.findings.find((f) => f.method === "unrelatedType");
  assert.ok(unrelated !== undefined);
  assert.equal(unrelated.detail, "catches IllegalArgumentException; try block can throw: ConfigException");
});

test("the repo index learns `extends` and what methods throw", () => {
  assert.equal(fixtureIndex.superclassOf.get("ConfigException"), "RuntimeException");
  assert.deepEqual(fixtureIndex.methodThrows.get("openFile"), ["FileNotFoundException"]); // throws clause
  assert.deepEqual(fixtureIndex.methodThrows.get("loadConfig"), ["ConfigException"]);    // throw in body
});

// Run the detector on a small snippet (index built from the same snippet) and
// return the names of the flagged methods.
function flaggedIn(code: string): string[] {
  const tree = parseJava(code);
  return detectUnreachableHandler(tree, "A.java", buildRepoIndex([tree])).findings.map((f) => f.method);
}

test("@throws in Javadoc counts as a possible exception", () => {
  const code = `class A {
    /** @throws IllegalArgumentException if the value is bad */
    void check() { }
    void ok()  { try { check(); } catch (IllegalArgumentException e) { } }
    void bad() { try { check(); } catch (IllegalStateException e) { } }
  }`;
  assert.deepEqual(flaggedIn(code), ["bad"]);
});

test("`throw e;` uses the declared type of the variable e", () => {
  const code = `class A {
    void m(IllegalStateException problem) {
      try { throw problem; } catch (IllegalStateException e) { }
    }
    void n(IllegalStateException problem) {
      try { throw problem; } catch (NumberFormatException e) { }
    }
  }`;
  assert.deepEqual(flaggedIn(code), ["n"]);
});

test("an unknown thrown expression is never flagged", () => {
  // We cannot tell what makeError() returns, so we cannot claim the catch is unreachable.
  const code = `class A { void m() { try { throw makeError(); } catch (ConfigException e) { } } }`;
  assert.deepEqual(flaggedIn(code), []);
});

test("operations that throw without a call", () => {
  const code = `class A {
    void cast(Object o)  { try { String s = (String) o; } catch (ClassCastException e) { } }
    void index(int[] a)  { try { int x = a[5]; } catch (ArrayIndexOutOfBoundsException e) { } }
    void nul(String s)   { try { s.length(); } catch (NullPointerException e) { } }
    void plus(int x)     { try { int y = x + 1; } catch (ArithmeticException e) { } }
  }`;
  assert.deepEqual(flaggedIn(code), ["plus"]); // + cannot throw; / and % can
});

test("try-with-resources closes its resources, which may throw IOException", () => {
  const code = `class A { void m() { try (Res r = open()) { } catch (IOException e) { } } }`;
  assert.deepEqual(flaggedIn(code), []);
});
