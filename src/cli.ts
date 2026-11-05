// cli.ts
// The command-line entry point: run every detector on a Java file or a whole folder,
// print a short summary, and save readable reports to files.
//
// Usage:
//   node dist/cli.js <file.java | folder> [--out <folder>]
//
// Reports (default folder: out/):
//   report.md    human-readable summary + every finding (open in VS Code, Ctrl/Cmd+Shift+V to preview)
//   report.csv   one row per finding (opens in Excel / Numbers)
//   report.json  everything, for other programs

import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";
import { parseJavaFile } from "./parser";
import { AntiPattern, DetectorResult, Finding } from "./types";
import { detectThrowsKitchenSink } from "./detectors/throwsKitchenSink";
import { Report, Summary, writeReports } from "./report";

// Everything the CLI needs to know about one detector.
interface DetectorInfo {
  antiPattern: AntiPattern;
  unit: string; // what the percentage is out of, e.g. "throws clauses"
  // A function type: `detect` must be a function taking a tree and a file path
  // and returning a DetectorResult.
  detect: (tree: Parser.Tree, filePath: string) => DetectorResult;
}

// Add the Log and Throw and Unreachable Handler detectors here in Stages 3 and 4.
const DETECTORS: DetectorInfo[] = [
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
  let outDir = "out";
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

  const files = findJavaFiles(target);

  // Collect results per detector across all files.
  const findings: Finding[] = [];
  const totals: number[] = DETECTORS.map(() => 0);
  const failedFiles: string[] = [];

  for (const file of files) {
    // One unreadable or broken file should not stop the whole run.
    try {
      const tree = parseJavaFile(file);
      DETECTORS.forEach((detector, i) => {
        const result = detector.detect(tree, file);
        findings.push(...result.findings);
        totals[i] += result.total;
      });
    } catch (err) {
      failedFiles.push(file);
      console.error(`Skipped ${file}: ${(err as Error).message}`);
    }
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
