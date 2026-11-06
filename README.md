# Exception Handling Anti-Pattern Detector

CIS*6650 Assignment 2 (Minzhen Zhang). A tool that reads Java source code and detects three
exception handling anti-patterns from de Pádua & Shang (ICPC 2017):
Unreachable Handler, Log and Throw, and Throws Kitchen Sink.

> **Status: Stage 5.** All three detectors are written, tested, and run from the CLI. Results on
> Guava v19.0 and the comparison with the paper are in [docs/guava-results.md](docs/guava-results.md).

## Results on Guava v19.0 (`guava/` module, 469 files)

| Anti-pattern | Paper | This tool |
|---|---:|---:|
| Unreachable Handler (% of catch blocks) | 37.22% | 11.56% (37/320) |
| Log and Throw (% of catch blocks) | 0.00% | 0.31% (1/320) |
| Throws Kitchen Sink (% of throws clauses) | 11.79% | 11.79% (60/509) |

To reproduce:

```bash
git clone --depth 1 --branch v19.0 https://github.com/google/guava.git subjects/guava-19.0
node dist/cli.js subjects/guava-19.0/guava
```

## Requirements

- Node.js 22 or newer (`node --version` to check)
- npm (comes with Node)

## Setup (once)

Open a terminal in the project folder. The path contains spaces and a `*`, so keep the quotes:

```bash
cd "/Users/minzhenzh/Documents/UoGuelph/Courses/CIS*6650 - Data-Driven SE/Code_analysis_tool"
npm install
```

`npm install` downloads the libraries listed in `package.json` into `node_modules/`.
An `allow-scripts` warning is expected and harmless: tree-sitter ships ready-built binaries for macOS,
so nothing needs to be compiled.

## Build

The code is written in TypeScript (`src/*.ts`), which Node cannot run directly.
Compile it to JavaScript (`dist/*.js`):

```bash
npm run build
```

**Run this again after every change to a `.ts` file**, otherwise you are running the old code.

## Run: detect anti-patterns

Give it one `.java` file or a folder (all `.java` files inside, including subfolders):

```bash
node dist/cli.js fixtures/ThrowsKitchenSink.java    # one file
node dist/cli.js subjects/guava-19.0/guava          # a whole project folder
```

The terminal shows a short summary:

```
Analyzed 1 Java file(s) in fixtures/ThrowsKitchenSink.java
  Unreachable Handler: 1 of 1 catch blocks (100.00%)
  Log and Throw: 0 of 1 catch blocks (0.00%)
  Throws Kitchen Sink: 5 of 8 throws clauses (62.50%)
Reports written to:
  out/ThrowsKitchenSink/report.md
  out/ThrowsKitchenSink/report.csv
  out/ThrowsKitchenSink/report.json
```

The details are saved in a folder named after what you analyzed, so each run has its own place:

```
out/
├── ThrowsKitchenSink/   <- from: node dist/cli.js fixtures/ThrowsKitchenSink.java
├── guava/               <- from: node dist/cli.js subjects/guava-19.0/guava
└── ast/                 <- saved AST printouts (see below)
```

Running the same target again overwrites its folder. Use `--out <folder>` to choose another folder.
Each folder contains:

| File | For | Contents |
|---|---|---|
| `report.md` | reading | summary table + one table of findings (file:line, method, detail) per anti-pattern. In VS Code, press Cmd+Shift+V to see it formatted |
| `report.csv` | spreadsheets | one row per finding; opens in Excel / Numbers |
| `report.json` | programs | everything: summary, findings, skipped files |

A file that cannot be read or parsed is skipped and listed in the report instead of stopping the run.

## Run: print the AST of a Java file

```bash
node dist/printAst.js fixtures/LogAndThrow.java
```

Options:

| Option | Meaning | Example |
|---|---|---|
| `--lines FROM-TO` | only print nodes that overlap these lines | `--lines 14-22` |
| `--no-comments` | hide `//` and `/* */` comment nodes | `--no-comments` |
| `--all` | also print keywords and punctuation (`"throws"`, `"{"`, `","`) | `--all` |

```bash
node dist/printAst.js fixtures/LogAndThrow.java --lines 14-22
node dist/printAst.js fixtures/ThrowsKitchenSink.java --lines 15 --all
```

Shortcut through npm (the `--` passes the arguments on to the script):

```bash
npm run ast -- fixtures/LogAndThrow.java --lines 14-22
```

### Save the output to a file

Long trees are easier to read in VS Code than in the terminal. `>` sends the output into a file
instead of the screen (`out/` is ignored by git):

```bash
mkdir -p out/ast
node dist/printAst.js fixtures/LogAndThrow.java --no-comments > out/ast/LogAndThrow.ast.txt
```

Then open `out/ast/LogAndThrow.ast.txt` in VS Code. Re-run the command after changing a fixture, or the saved file is out of date. Tip: VS Code can fold (collapse) the indented
branches using the arrows next to the line numbers.

## How to read the output

Java (lines 18-21 of `fixtures/LogAndThrow.java`):

```java
} catch (IOException e) {
    LOG.error("read failed", e);
    throw e;
}
```

Tree:

```
catch_clause  (lines 18-21)
├── catch_formal_parameter  (line 18)
│   ├── catch_type
│   │   └── type_identifier "IOException"
│   └── name: identifier "e"
└── body: block
    ├── expression_statement  (line 19)
    │   └── method_invocation
    │       ├── object: identifier "LOG"
    │       ├── name: identifier "error"
    │       └── arguments: argument_list
    │           ├── string_literal
    │           │   └── string_fragment "read failed"
    │           └── identifier "e"
    └── throw_statement  (line 20)
        └── identifier "e"
```

Each line is one node, made of:

| Part | Example | Meaning |
|---|---|---|
| tree lines `├──` `└──` `│` | | which node is inside which. `└──` marks the last child |
| field name (optional) | `object:` | which named slot of the parent this node fills |
| **node type** | `method_invocation` | **what kind of thing it is; detectors search for these** |
| text (small nodes only) | `"LOG"` | the source code of this node, as a reminder |
| position (optional) | `(line 19)` | where it is in the file. **Left out when it is the same as the parent's** |

`ERROR` / `MISSING` nodes mean tree-sitter found a syntax error at that spot.

## Run the tests

```bash
npm test
```

This compiles the code and runs every `dist/tests/*.test.js` with Node's built-in test runner.
Each detector is tested against its fixture in `fixtures/`; the FLAG / NO FLAG labels there are the
expected results.

## Detection rules

| Anti-pattern | Rule | Percentage is out of |
|---|---|---|
| Unreachable Handler | none of the catch's types is related (same class, subclass, or superclass) to any exception the try block can possibly throw. `catch (Exception)` / `catch (Throwable)` are always reachable | all catch blocks |
| Log and Throw | a catch block's body contains (anywhere inside, also nested in `if`/loops) both a **logging call** and a `throw` statement, except when the two are in opposite branches of the same `if`/`else` (then the handler logs *or* throws, never both) | all catch blocks |
| Throws Kitchen Sink | a `throws` clause lists 2 or more exception types (purely syntactic; the method body is ignored) | all throws clauses |

**What counts as a logging call** (the paper does not define it; this is the tool's decision):

1. **Logger calls**: the object's name ends in `log` or `logger` (case-insensitive: `LOG`, `LOGGER`,
   `logger`, `this.logger`, `getLogger()`) **and** the method is a logging method:
   `trace debug info warn error fatal` (SLF4J / Log4j) or
   `log severe warning info config fine finer finest` (`java.util.logging`, used by Guava).
2. **Console printing**: `System.out` / `System.err` `.print` / `.println` / `.printf`, and `printStackTrace()`.
   Printing still "logs some information", so it counts.

**How Unreachable Handler finds "what the try block can throw"** without type information
(the paper used Eclipse JDT bindings; this tool only has the syntax tree). The run has two passes:

- **Pass 1, repo index** (`src/repoIndex.ts`), built from every file before detecting:
  - the repo's class hierarchy, from every `class X extends Y`;
  - for each **method name**: the types in its `throws` clause, its `@throws` / `@exception` Javadoc
    tags, and the `throw new X(...)` statements in its body. Constructors are stored under their class name.
- **Pass 2, for each catch**, the try block (and try-with-resources resources) can throw:
  1. `throw new X(...)` → X; `throw e;` → the declared type of variable `e`;
  2. a call `foo(...)` / `x.foo(...)` → the index entry for the name `foo`, plus the JDK table;
  3. `new Foo(...)` → what `Foo`'s constructors may throw (index + JDK table);
  4. operations: `/` and `%` → ArithmeticException; `a[i]` → ArrayIndexOutOfBoundsException;
     `(Foo) x` → ClassCastException; `x.foo()` / `x.field` → NullPointerException; `assert` → AssertionError;
  5. try-with-resources → whatever `close()` may throw.
- The JDK is not in the repo, so `src/jdkExceptions.ts` holds a hand-written table of common JDK exception
  classes (who extends whom), common JDK methods by name (e.g. `parseInt` → NumberFormatException,
  `read`/`close` → IOException) and constructors (e.g. `new FileInputStream` → FileNotFoundException).

Approximations (limitations) of Unreachable Handler:
- **Calls are matched by name only.** All repo methods named `close` share one entry, and the JDK
  entry for `get` covers both `Future.get` and `List.get`. This can only make the tool flag *less*.
- **Unknown calls throw nothing.** A call to a library method that is neither in the repo nor in the
  JDK table adds no exceptions, so a catch around it may be flagged when it is really reachable (flag *more*).
- **One level only.** For `a()` the index records what `a` declares, documents, or throws itself, not what
  the methods called by `a` throw.
- **No scoping inside the try block.** A `throw` or call inside a nested try that catches it, or inside
  a lambda / anonymous class, still counts as possible (flag *less*).
- A `throw` whose type cannot be worked out (e.g. `throw makeException();`) makes the catch count as reachable.
- Types are compared by simple name (`java.io.IOException` = `IOException`).

Known limitations of Log and Throw: a logger with an unusual name (e.g. `audit.warn(...)`) is missed; a non-logger
whose name ends in "log" (e.g. `dialog.warn(...)`) would be counted; a `throw` inside a lambda or
anonymous class written in the catch block is counted even though it does not leave the handler.

## Project structure

```
src/
  cli.ts         main program: finds .java files, runs the detectors, prints a summary
  report.ts      writes report.md / report.csv / report.json
  parser.ts      parseJava(text) / parseJavaFile(path): Java source -> tree-sitter tree
  printAst.ts    command-line program that prints the tree (uses parser.ts)
  types.ts       Finding / DetectorResult: what every detector returns
  astUtils.ts    shared helpers (line numbers, enclosing method name, type names, comments)
  repoIndex.ts   pass 1: class hierarchy + what each method name may throw, for the whole repo
  jdkExceptions.ts  hand-written tables of common JDK exceptions, methods and constructors
  detectors/
    unreachableHandler.ts
    logAndThrow.ts
    throwsKitchenSink.ts
  tests/         one test file per detector (run with `npm test`)
fixtures/        small Java examples labelled FLAG / NO FLAG (expected detector results)
docs/            the paper and the assignment description
dist/            compiled JavaScript (created by `npm run build`, not in git)
out/             generated reports, one folder per analyzed target, plus out/ast/ (not in git)
```

## Notes and troubleshooting

- **Large files:** tree-sitter's Node binding rejects input of 32,768 characters or more by default
  (`Invalid argument`). `parser.ts` passes a `bufferSize` larger than each file, so files of any
  size parse.
- **VS Code shows "Cannot find name 'fs'":** VS Code is using its own TypeScript version. Run
  "TypeScript: Select TypeScript Version" -> "Use Workspace Version" from the command palette.
  (`.vscode/settings.json` and `"types": ["node"]` in `tsconfig.json` already handle this.)
- **`Cannot find module '.../dist/printAst.js'`:** you have not built yet; run `npm run build`.
