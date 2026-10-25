// parser.ts
// Turns Java source text into a tree-sitter syntax tree (AST).
// Every detector will start from the tree returned by parseJava().

import * as fs from "fs";
import Parser from "tree-sitter";
import Java from "tree-sitter-java";

// One parser object can be reused for every file, so we create it once.
const parser = new Parser();
parser.setLanguage(Java);

// TypeScript syntax: `source: string` says the parameter must be a string,
// and `: Parser.Tree` after the parentheses says what the function returns.
export function parseJava(source: string): Parser.Tree {
  // tree-sitter never "fails": if the code has syntax errors it still returns
  // a tree, with ERROR nodes where it got confused. That is why it works on
  // code that does not compile (e.g. our fixtures with missing imports).
  //
  // bufferSize: by default tree-sitter's Node binding only accepts ~32 KB of
  // input; some Guava files are bigger, so we size the buffer to the file.
  return parser.parse(source, undefined, { bufferSize: source.length * 2 + 1024 });
}

export function parseJavaFile(filePath: string): Parser.Tree {
  const source = fs.readFileSync(filePath, "utf8");
  return parseJava(source);
}
