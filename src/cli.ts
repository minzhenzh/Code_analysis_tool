// cli.ts
// The command-line entry point: run every detector on a Java file or a whole folder,
// print a short summary, and save readable reports to files.
//
// Usage:
//   node dist/cli.js <file.java | folder> [--out <folder>]
//
// Reports go to out/<name of the target>/ unless --out is given, so every run has its own
// clearly named folder (e.g. out/ThrowsKitchenSink/, out/fixtures/, out/guava/):
//   report.md    human-readable summary + every finding (open in VS Code, Ctrl/Cmd+Shift+V to preview)
//   report.csv   one row per finding (opens in Excel / Numbers)
//   report.json  everything, for other programs

import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";
import { parseJavaFile } from "./parser";
import { AntiPattern, DetectorResult, Finding } from "./types";
import { detectThrowsKitchenSink } from "./detectors/throwsKitchenSink";
import { detectLogAndThrow } from "./detectors/logAndThrow";
import { detectUnreachableHandler } from "./detectors/unreachableHandler";
import { buildRepoIndex, RepoIndex } from "./repoIndex";
import { Report, Summary, writeReports } from "./report";

// Everything the CLI needs to know about one detector.
interface DetectorInfo {
  antiPattern: AntiPattern;
  unit: string; // what the percentage is out of, e.g. "throws clauses"
  // A function type: `detect` must be a function taking a tree, a file path and the
  // repo index, and returning a DetectorResult. Detectors that do not need the index
  // (Log and Throw, Throws Kitchen Sink) simply declare fewer parameters.
  detect: (tree: Parser.Tree, filePath: string, index: RepoIndex) => DetectorResult;
}

const DETECTORS: DetectorInfo[] = [
  { antiPattern: "Unreachable Handler", unit: "catch blocks", detect: detectUnreachableHandler },
  { antiPattern: "Log and Throw", unit: "catch blocks", detect: detectLogAndThrow },
  { antiPattern: "Throws Kitchen Sink", unit: "throws clauses", detect: detectThrowsKitchenSink },
];

// Return every .java file at `target`: the file itself, or all .java files in the
// folder and its subfolders.
function findJavaFiles(target: string): string[] {
  if (fs.statSync(target).isFile()) {
    return [target];
  }
  const files: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJavaFiles(fullPath)); // `...` spreads the returned array into push()
    } else if (entry.name.endsWith(".java")) {
      files.push(fullPath);
    }
  }
  return files;
}

function main(): void {
  const args = process.argv.slice(2);
  let target: string | null = null;
  let outDir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") {
      outDir = args[i + 1];
      i++;
    } else {
      target = args[i];
    }
  }
  if (target === null || !fs.existsSync(target)) {
    console.error("Usage: node dist/cli.js <file.java | folder> [--out <folder>]");
    process.exit(1);
  }
  if (outDir === null) {
    // "fixtures/ThrowsKitchenSink.java" -> out/ThrowsKitchenSink, "../guava" -> out/guava
    outDir = path.join("out", path.basename(path.resolve(target), ".java"));
  }

  const files = findJavaFiles(target);
  const failedFiles: string[] = [];

  // Parse every file once and keep the trees: both passes below use them.
  // One unreadable or broken file should not stop the whole run.
  const parsed: { file: string; tree: Parser.Tree }[] = [];
  for (const file of files) {
    try {
      parsed.push({ file: file, tree: parseJavaFile(file) });
    } catch (err) {
      failedFiles.push(file);
      console.error(`Skipped ${file}: ${(err as Error).message}`);
    }
  }

  // Pass 1: learn the repo's exception hierarchy and what each method throws.
  const index = buildRepoIndex(parsed.map((p) => p.tree));

  // Pass 2: run every detector on every file, collecting results per detector.
  const findings: Finding[] = [];
  const totals: number[] = DETECTORS.map(() => 0);
  for (const { file, tree } of parsed) {
    DETECTORS.forEach((detector, i) => {
      const result = detector.detect(tree, file, index);
      findings.push(...result.findings);
      totals[i] += result.total;
    });
  }

  const summary: Summary[] = DETECTORS.map((detector, i) => {
    const flagged = findings.filter((f) => f.antiPattern === detector.antiPattern).length;
    return {
      antiPattern: detector.antiPattern,
      unit: detector.unit,
      flagged: flagged,
      total: totals[i],
      // Avoid dividing by zero when a project has no throws clauses / catch blocks.
      percentage: totals[i] === 0 ? 0 : (100 * flagged) / totals[i],
    };
  });

  const report: Report = { target, filesAnalyzed: files.length, failedFiles, summary, findings };
  const written = writeReports(report, outDir);

  // Short summary in the terminal; the details are in the report files.
  console.log(`Analyzed ${files.length} Java file(s) in ${target}`);
  for (const s of summary) {
    console.log(`  ${s.antiPattern}: ${s.flagged} of ${s.total} ${s.unit} (${s.percentage.toFixed(2)}%)`);
  }
  console.log("Reports written to:");
  for (const file of written) {
    console.log(`  ${file}`);
  }
}

main();
