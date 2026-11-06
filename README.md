# Exception Handling Anti-Pattern Detector

A command-line tool that reads Java source code and detects three exception handling anti-patterns
defined by de Pádua & Shang, *"Studying the Prevalence of Exception Handling Anti-Patterns"*, ICPC 2017
(Table I):

| Group | Anti-pattern | Definition (paper) |
|---|---|---|
| Flow | **Unreachable Handler** | The handler does not catch any possible exception from the try block. |
| Handler | **Log and Throw** | The handler logs some information and propagates the exception. |
| Throws | **Throws Kitchen Sink** | The throws clause propagates multiple exceptions. |

It reports, for each anti-pattern, how many catch blocks / throws clauses are affected (the paper's
metrics), every location as `file:line`, and saves the results as Markdown, CSV and JSON.

CIS*6650 Assignment 2, Minzhen Zhang. Written in TypeScript on Node.js, using
[tree-sitter](https://tree-sitter.github.io/) and `tree-sitter-java` to parse Java. The analyzed project
is **never compiled**: the tool only reads `.java` files as text, so it also works on code with missing
dependencies.

## Results on Guava v19.0

Main library module (`guava/`, 469 files), the same code the paper analyzed:

| Anti-pattern | Paper | This tool |
|---|---:|---:|
| Unreachable Handler (% of catch blocks) | 37.22% | 11.56% (37/320) |
| Log and Throw (% of catch blocks) | 0.00% | 0.31% (1/320) |
| Throws Kitchen Sink (% of throws clauses) | 11.79% | 11.79% (60/509) |

The comparison, a sensitivity analysis and a manual check of the findings are in
[docs/guava-results.md](docs/guava-results.md).

## Requirements

- **Node.js 22 or newer** (`node --version` to check). npm comes with Node.
- macOS, Linux or Windows. tree-sitter ships ready-built binaries, so nothing is compiled during install.

## Quick start (from the source folder)

```bash
cd Code_analysis_tool          # the project folder; quote the path if it contains spaces
npm install                    # download the libraries into node_modules/
npm run build                  # compile TypeScript (src/) to JavaScript (dist/)
node dist/cli.js fixtures/LogAndThrow.java
```

An `allow-scripts` warning from `npm install` is expected and harmless.

## Install as a command (the executable)

The tool can be installed as a command named **`antipattern-detector`**, so it runs from any folder.

**From the release package** (`release/exception-antipattern-detector-1.0.0.tgz`):

```bash
npm install -g release/exception-antipattern-detector-1.0.0.tgz
antipattern-detector --help
```

To create or update that package from the source folder: `npm pack --pack-destination release`
(this also builds the code first).

**Or directly from the source folder** (after `npm install`): `npm link` makes `antipattern-detector`
point to this folder, so later changes take effect after `npm run build`.

To uninstall: `npm uninstall -g exception-antipattern-detector`.

## Usage

```
antipattern-detector <file.java | folder> [--out <folder>]
```

(From the source folder without installing, use `node dist/cli.js` instead of `antipattern-detector`.)

| Argument / option | Meaning |
|---|---|
| `<file.java \| folder>` | a Java file, or a folder: all `.java` files inside, including subfolders |
| `--out <folder>` | where to save the reports (default: `out/<name of the file or folder>`) |
| `--help` | show the help text |
| `--version` | show the version |

Example: analyze Guava v19.0, as in the paper.

```bash
git clone --depth 1 --branch v19.0 https://github.com/google/guava.git subjects/guava-19.0
antipattern-detector subjects/guava-19.0/guava
```

```
Analyzed 469 Java file(s) in subjects/guava-19.0/guava
  Unreachable Handler: 37 of 320 catch blocks (11.56%)
  Log and Throw: 1 of 320 catch blocks (0.31%)
  Throws Kitchen Sink: 60 of 509 throws clauses (11.79%)
Reports written to:
  out/guava/report.md
  out/guava/report.csv
  out/guava/report.json
```

### Reports

Each run saves its reports in a folder named after what was analyzed, e.g. `out/guava/` or
`out/LogAndThrow/`. Running the same target again overwrites its folder.

| File | For | Contents |
|---|---|---|
| `report.md` | reading | summary table, then one table of findings (`file:line`, method, detail) per anti-pattern. In VS Code, Cmd/Ctrl+Shift+V shows it formatted |
| `report.csv` | spreadsheets | one row per finding: anti-pattern, file, line, method, detail |
| `report.json` | programs | everything: summary, findings, skipped files |

Each finding's detail explains why it was flagged, for example:

```
ListenerCallQueue.java:87   execute       logs with logger.log (line 93), throws at line 96
Collections2.java:111       safeContains  catches ClassCastException; try block can throw: NullPointerException
ThrowsKitchenSink.java:18   parse         throws 3 types: IOException, ParseException, TimeoutException
```

A file that cannot be read or parsed is skipped and listed in the report instead of stopping the run.

## Detection rules

| Anti-pattern | Rule | Percentage is out of |
|---|---|---|
| Unreachable Handler | none of the catch's types is related (same class, subclass, or superclass) to any exception the try block can possibly throw. `catch (Exception)` / `catch (Throwable)` are always reachable | all catch blocks |
| Log and Throw | a catch block's body contains (anywhere inside, also nested in `if`/loops) both a **logging call** and a `throw` statement, except when the two are in opposite branches of the same `if`/`else` (then the handler logs *or* throws, never both) | all catch blocks |
| Throws Kitchen Sink | a `throws` clause lists 2 or more exception types (purely syntactic; the method body is ignored) | all throws clauses |

### What counts as a logging call

The paper does not define it; this is the tool's decision:

1. **Logger calls**: the object's name ends in `log` or `logger` (case-insensitive: `LOG`, `LOGGER`,
   `logger`, `this.logger`, `getLogger()`) **and** the method is a logging method:
   `trace debug info warn error fatal` (SLF4J / Log4j) or
   `log severe warning info config fine finer finest` (`java.util.logging`, used by Guava).
2. **Console printing**: `System.out` / `System.err` `.print` / `.println` / `.printf`, and `printStackTrace()`.
   Printing still "logs some information", so it counts.

### How Unreachable Handler finds "what the try block can throw"

The paper used Eclipse JDT, which knows the exact type of every expression. This tool only has the
syntax tree, so it approximates in two passes:

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
- The JDK's source is not available, so `src/jdkExceptions.ts` holds a hand-written table of common JDK
  exception classes (who extends whom), common JDK methods by name (e.g. `parseInt` → NumberFormatException,
  `read`/`close` → IOException) and constructors (e.g. `new FileInputStream` → FileNotFoundException).

### Limitations

Unreachable Handler:
- **Calls are matched by name only.** All repo methods named `close` share one entry, and the JDK
  entry for `get` covers both `Future.get` and `List.get`. This can only make the tool flag *less*.
- **Unknown calls throw nothing.** A call to a library method that is neither in the repo nor in the
  JDK table adds no exceptions, so a catch around it may be flagged when it is really reachable (flag *more*).
- **One level only.** For `a()` the index records what `a` declares, documents, or throws itself, not what
  the methods called by `a` throw.
- **No scoping inside the try block.** A `throw` or call inside a nested try that catches it, or inside
  a lambda / anonymous class, still counts as possible (flag *less*).
- **Errors are not modelled everywhere.** `catch (Error)` is flagged unless the try block visibly throws one,
  although e.g. OutOfMemoryError can happen anywhere.
- A `throw` whose type cannot be worked out (e.g. `throw makeException();`) makes the catch count as reachable.
- Types are compared by simple name (`java.io.IOException` = `IOException`).

Log and Throw:
- A logger with an unusual name (e.g. `audit.warn(...)`) is missed; a non-logger whose name ends in "log"
  (e.g. `dialog.warn(...)`) would be counted.
- Only `if`/`else` is recognised as "opposite branches"; e.g. different `switch` cases are not.
- A `throw` inside a lambda or anonymous class written in the catch block is counted even though it does
  not leave the handler.

Throws Kitchen Sink:
- Types are counted as written; `throws IOException, FileNotFoundException` counts as 2 even though one
  is a subclass of the other.

## Tests

```bash
npm test
```

Compiles the code and runs every `dist/tests/*.test.js` with Node's built-in test runner (26 tests).
Each detector is tested against its fixture in `fixtures/`, where every example is labelled **FLAG** or
**NO FLAG** with an explanation; those labels are the expected results. Small inline examples cover
edge cases (Javadoc `@throws`, `throw e;`, if/else branches, logger forms, comments in throws clauses, ...).

## Viewing the syntax tree (developer tool)

`printAst` shows how tree-sitter sees a Java file; this is how each detector's node types were chosen.

```bash
node dist/printAst.js fixtures/LogAndThrow.java --lines 18-21 --no-comments
```

| Option | Meaning |
|---|---|
| `--lines FROM-TO` | only print nodes that overlap these lines (`--lines 15` for one line) |
| `--no-comments` | hide `//` and `/* */` comment nodes |
| `--all` | also print keywords and punctuation (`"throws"`, `"{"`, `","`) |

Add `> out/ast/LogAndThrow.ast.txt` to save the tree to a file (create the folder first with
`mkdir -p out/ast`). Example output for the Java code
`} catch (IOException e) { LOG.error("read failed", e); throw e; }`:

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

Each line is one node: the tree lines show nesting, `object:` is a field (a named slot in the parent),
`method_invocation` is the node type (what detectors search for), `"LOG"` is the source text of small
nodes, and `(line 19)` is the position, left out when it is the same as the parent's.
`ERROR` / `MISSING` nodes mean tree-sitter found a syntax error at that spot.

## Project structure

```
src/
  cli.ts               main program: finds .java files, parses them, builds the repo index,
                       runs the detectors, prints the summary
  report.ts            writes report.md / report.csv / report.json
  parser.ts            parseJava(text) / parseJavaFile(path): Java source -> tree-sitter tree
  types.ts             Finding / DetectorResult: what every detector returns
  astUtils.ts          shared helpers (line numbers, enclosing method, type names, comments)
  repoIndex.ts         pass 1: class hierarchy + what each method name may throw
  jdkExceptions.ts     hand-written tables of common JDK exceptions, methods and constructors
  detectors/
    unreachableHandler.ts
    logAndThrow.ts
    throwsKitchenSink.ts
  printAst.ts          developer tool: print a file's syntax tree
  tests/               one test file per detector (npm test)
fixtures/              Java examples labelled FLAG / NO FLAG (expected results)
docs/                  the paper, the assignment, guava-results.md
release/               the installable package (.tgz), created by npm pack (not in git)
dist/                  compiled JavaScript, created by npm run build (not in git)
out/                   generated reports, one folder per analyzed target (not in git)
subjects/              downloaded projects to analyze, e.g. guava-19.0 (not in git)
```

## Troubleshooting

- **`Cannot find module '.../dist/cli.js'`**: the code is not built yet; run `npm run build`.
- **Changes to a `.ts` file have no effect**: run `npm run build` again (Node runs the compiled `dist/`).
- **Large files**: tree-sitter's Node binding rejects input of 32,768 characters or more by default
  (`Invalid argument`). `parser.ts` passes a buffer size larger than each file, so files of any size parse.
- **VS Code shows "Cannot find name 'fs'"**: VS Code is using its own TypeScript version. Run
  "TypeScript: Select TypeScript Version" -> "Use Workspace Version" from the command palette.
  (`.vscode/settings.json` and `"types": ["node"]` in `tsconfig.json` already handle this.)
