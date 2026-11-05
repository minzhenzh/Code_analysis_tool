// Tests for the Throws Kitchen Sink detector, run against fixtures/ThrowsKitchenSink.java.
// The expected results come from the FLAG / NO FLAG labels in that fixture.
//
// Uses Node's built-in test runner (node:test), so no extra library is needed.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { parseJava, parseJavaFile } from "../parser";
import { detectThrowsKitchenSink } from "../detectors/throwsKitchenSink";

// __dirname is dist/tests when the compiled test runs, so go up two folders.
const fixture = path.join(__dirname, "..", "..", "fixtures", "ThrowsKitchenSink.java");
const result = detectThrowsKitchenSink(parseJavaFile(fixture), fixture);
const flaggedMethods = result.findings.map((f) => f.method);

test("flags every method labelled FLAG", () => {
  // ThrowsKitchenSink = the constructor (it has the class's name)
  assert.deepEqual(flaggedMethods, ["load", "parse", "ThrowsKitchenSink", "qualified", "fetch"]);
});

test("does not flag methods labelled NO FLAG", () => {
  for (const name of ["save", "risky", "close", "multiCatch", "throwInBody"]) {
    assert.ok(!flaggedMethods.includes(name), `${name} should not be flagged`);
  }
});

test("counts every throws clause as the denominator", () => {
  // load, parse, constructor, save, risky, qualified, throwInBody, fetch.
  // close and multiCatch have no throws clause.
  assert.equal(result.total, 8);
});

test("reports line, method and the listed types", () => {
  const load = result.findings[0];
  assert.equal(load.line, 15);
  assert.equal(load.antiPattern, "Throws Kitchen Sink");
  assert.equal(load.detail, "throws 2 types: IOException, SQLException");
});

test("a fully qualified type counts as one type", () => {
  const qualified = result.findings.find((f) => f.method === "qualified");
  assert.ok(qualified !== undefined);
  assert.equal(qualified.detail, "throws 2 types: java.io.IOException, java.sql.SQLException");
});

test("a comment inside the throws clause is not counted as a type", () => {
  // The comment sits BETWEEN the types, so it is a child of the throws node.
  const tree = parseJava("class A { void m() throws IOException, /* note */ SQLException { } }");
  const r = detectThrowsKitchenSink(tree, "A.java");
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].detail, "throws 2 types: IOException, SQLException");
});
