# Exception Handling Anti-Pattern Detector

CIS*6650 Assignment 2 (Minzhen Zhang). A tool that reads Java source code and detects three
exception handling anti-patterns from de Pádua & Shang (ICPC 2017):
Unreachable Handler, Log and Throw, and Throws Kitchen Sink.

> **Status: Stage 2.** The Throws Kitchen Sink detector is written, tested, and runs from the CLI.
> Log and Throw and Unreachable Handler are not written yet.

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
node dist/cli.js fixtures/ThrowsKitchenSink.java
node dist/cli.js fixtures --out out/fixtures
```

The terminal shows a short summary:

```
Analyzed 1 Java file(s) in fixtures/ThrowsKitchenSink.java
  Throws Kitchen Sink: 5 of 8 throws clauses (62.50%)
Reports written to:
  out/report.md
  out/report.csv
  out/report.json
```

The details are saved in the `--out` folder (default `out/`):

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
mkdir -p out
node dist/printAst.js fixtures/LogAndThrow.java --no-comments > out/LogAndThrow.ast.txt
```

Then open `out/LogAndThrow.ast.txt` in VS Code. Tip: VS Code can fold (collapse) the indented
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
| Throws Kitchen Sink | a `throws` clause lists 2 or more exception types (purely syntactic; the method body is ignored) | all throws clauses |

## Project structure

```
src/
  cli.ts         main program: finds .java files, runs the detectors, prints a summary
  report.ts      writes report.md / report.csv / report.json
  parser.ts      parseJava(text) / parseJavaFile(path): Java source -> tree-sitter tree
  printAst.ts    command-line program that prints the tree (uses parser.ts)
  types.ts       Finding / DetectorResult: what every detector returns
  astUtils.ts    shared helpers (line numbers, enclosing method name, comments)
  detectors/
    throwsKitchenSink.ts
  tests/         one test file per detector (run with `npm test`)
fixtures/        small Java examples labelled FLAG / NO FLAG (expected detector results)
docs/            the paper and the assignment description
dist/            compiled JavaScript (created by `npm run build`, not in git)
out/             reports and saved outputs (not in git)
```

## Notes and troubleshooting

- **Large files:** tree-sitter's Node binding rejects input of 32,768 characters or more by default
  (`Invalid argument`). `parser.ts` passes a `bufferSize` larger than each file, so files of any
  size parse.
- **VS Code shows "Cannot find name 'fs'":** VS Code is using its own TypeScript version. Run
  "TypeScript: Select TypeScript Version" -> "Use Workspace Version" from the command palette.
  (`.vscode/settings.json` and `"types": ["node"]` in `tsconfig.json` already handle this.)
- **`Cannot find module '.../dist/printAst.js'`:** you have not built yet; run `npm run build`.
