// types.ts
// Shapes of the data that every detector produces. Keeping them in one place
// means the CLI and the report writer can treat all three detectors the same way.

// A union of string literals: a value of this type must be exactly one of these strings.
export type AntiPattern = "Throws Kitchen Sink" | "Log and Throw" | "Unreachable Handler";

// One detected anti-pattern instance.
export interface Finding {
  antiPattern: AntiPattern;
  file: string;   // path of the .java file
  line: number;   // 1-based line where the problem is
  method: string; // name of the enclosing method or constructor
  detail: string; // human-readable explanation, e.g. "throws 2 types: IOException, SQLException"
}

// What a detector returns for one file.
// `total` is the denominator for the paper's percentages:
//   Throws Kitchen Sink -> number of throws clauses
//   Log and Throw / Unreachable Handler -> number of catch blocks
export interface DetectorResult {
  findings: Finding[];
  total: number;
}
