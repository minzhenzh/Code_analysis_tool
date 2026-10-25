# Project: Exception Handling Anti-Pattern Detector (CIS*6650 Assignment 2)

## Context
I am an M.Sc. student. This is a course assignment based on:
de Pádua & Shang, "Studying the Prevalence of Exception Handling Anti-Patterns," ICPC 2017 (see docs/).
I am NEW to Java and to static code analysis. I must be able to explain every part of this tool
in an in-class demo and possibly a 1-on-1 meeting with the instructor. Prioritize my understanding
over speed.

## My assigned anti-patterns (definitions from Table I of the paper)
1. Unreachable Handler (Flow): the catch handler does not catch any exception that the try block can throw.
2. Log and Throw (Handler): the catch handler logs some information and then (re)throws an exception.
3. Throws Kitchen Sink (Throws): a method's `throws` clause declares multiple exception types.

## Technical decisions
- Tool language: TypeScript on Node.js. Do NOT use Java, Eclipse, or JDT.
- Parser: tree-sitter + tree-sitter-java.
- The tool analyzes Java source code (.java files) as text; it never compiles the target project.
- CLI usage: `node dist/cli.js <path-to-java-repo>` → prints per-anti-pattern counts,
  percentages (per catch block / per throws clause, matching the paper's metrics), and file:line
  locations; also writes a JSON/CSV report.
- Target repo for evaluation: Guava v19.0 only (one of the paper's subjects).
  The instructor requires using a single repo for this assignment. Do not add other repos.
- Unreachable Handler cannot use type bindings. Approximate it using: explicit `throw` statements,
  `throws` clauses and `@throws` Javadoc of methods declared in the same repo, the repo's own exception
  class hierarchy (`extends`), and a small hand-written table of common JDK exceptions/methods.
  Document every approximation as a limitation.

## How to work with me
- Work in small stages. After each stage, stop and explain what you built, which tree-sitter node
  types are involved, and why, before moving on.
- Before writing a detector, show me the AST for the relevant fixture in fixtures/ and walk me through it.
- I have never written Java. The files in fixtures/ were provided to me; each example is labelled
  FLAG or NO FLAG and these labels are the expected test results. Before implementing each
  detector, walk me through that fixture file line by line, explaining the Java syntax and why
  each example is or isn't flagged. Then quiz me on 2-3 new variants (I predict FLAG/NO FLAG
  before you tell me the answer), and add the variants to the fixture file afterwards.
- I know JavaScript but not TypeScript. Use simple TypeScript only (type annotations, interfaces,
  union types). Avoid generics-heavy or advanced type tricks, and briefly explain any TS syntax
  the first time it appears.
- Keep code simple and readable rather than clever. Add comments explaining the "why".
- Write tests that run each detector against fixtures/.

## Stages
1. Project setup + parse one Java file and print its AST.
2. Throws Kitchen Sink detector (purely syntactic) + tests.
3. Log and Throw detector + tests (define clearly what counts as a "logging call").
4. Unreachable Handler detector (the approximation above) + tests.
5. Run on Guava v19.0; compare results with the paper's Table III/IV and explain differences.
6. Package as a CLI/executable and write a README.