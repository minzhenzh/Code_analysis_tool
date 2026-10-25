# Exception Handling Anti-Pattern Detector

CIS*6650 Assignment 2 (Minzhen Zhang). A tool that reads Java source code and detects three
exception handling anti-patterns from de Pádua & Shang (ICPC 2017):
Unreachable Handler, Log and Throw, and Throws Kitchen Sink.

> **Status: Stage 1.** The tool can parse a Java file and print its syntax tree (AST).
> The detectors are not written yet.

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

## Run: print the AST of a Java file

```bash
node dist/printAst.js fixtures/LogAndThrow.java
```

Options:

| Option | Meaning | Example |
|---|---|---|
| `--lines FROM-TO` | only print nodes that overlap these lines | `--lines 14-22` |
| `--all` | also print keywords and punctuation (`"throws"`, `"{"`, `","`) | `--all` |

```bash
node dist/printAst.js fixtures/LogAndThrow.java --lines 14-22
node dist/printAst.js fixtures/ThrowsKitchenSink.java --lines 15 --all
```

Shortcut through npm (the `--` passes the arguments on to the script):

```bash
npm run ast -- fixtures/LogAndThrow.java --lines 14-22
```

## How to read the output

```
catch_clause [lines 18-21]
  catch_formal_parameter [line 18]
    catch_type [line 18]
      type_identifier [line 18]  "IOException"
    name: identifier [line 18]  "e"
```

- **Indentation** = nesting: a node is inside the node above it with less indentation.
- **`catch_clause`, `type_identifier`, ...** = the node type. Detectors search for these.
- **`name:`** = a field, a named slot in the parent (e.g. a method's `name`, a call's `object`).
- **`[lines 18-21]`** = where the node is in the file (1-based, like your editor).
- **`"IOException"`** = the source text, shown for small nodes.
- **`ERROR` / `MISSING`** nodes mean tree-sitter found a syntax error at that spot.

## Project structure

```
src/
  parser.ts      parseJava(text) / parseJavaFile(path): Java source -> tree-sitter tree
  printAst.ts    command-line program that prints the tree (uses parser.ts)
fixtures/        small Java examples labelled FLAG / NO FLAG (expected detector results)
docs/            the paper and the assignment description
dist/            compiled JavaScript (created by `npm run build`, not in git)
```

## Notes and troubleshooting

- **Large files:** tree-sitter's Node binding rejects input of 32,768 characters or more by default
  (`Invalid argument`). `parser.ts` passes a `bufferSize` larger than each file, so files of any
  size parse.
- **VS Code shows "Cannot find name 'fs'":** VS Code is using its own TypeScript version. Run
  "TypeScript: Select TypeScript Version" -> "Use Workspace Version" from the command palette.
  (`.vscode/settings.json` and `"types": ["node"]` in `tsconfig.json` already handle this.)
- **`Cannot find module '.../dist/printAst.js'`:** you have not built yet; run `npm run build`.
