// report.ts
// Saves the analysis results to files: Markdown (for people), CSV (for spreadsheets)
// and JSON (for programs). The CLI builds a Report object and calls writeReports().

import * as fs from "fs";
import * as path from "path";
import { AntiPattern, Finding } from "./types";

// Prevalence of one anti-pattern, like one cell of the paper's Table III / IV.
export interface Summary {
  antiPattern: AntiPattern;
  unit: string;       // what the percentage is out of, e.g. "throws clauses"
  flagged: number;    // how many were flagged
  total: number;      // how many were checked
  percentage: number; // 100 * flagged / total
}

export interface Report {
  target: string;        // the file or folder that was analyzed
  filesAnalyzed: number;
  failedFiles: string[]; // files that could not be read or parsed
  summary: Summary[];
  findings: Finding[];
}

// Write report.md, report.csv and report.json into `outDir`. Returns the paths written.
export function writeReports(report: Report, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true }); // create the folder if it does not exist
  const files = [
    { name: "report.md", content: toMarkdown(report) },
    { name: "report.csv", content: toCsv(report.findings) },
    { name: "report.json", content: JSON.stringify(report, null, 2) + "\n" },
  ];
  const written: string[] = [];
  for (const file of files) {
    const filePath = path.join(outDir, file.name);
    fs.writeFileSync(filePath, file.content);
    written.push(filePath);
  }
  return written;
}

function toMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push("# Exception Handling Anti-Pattern Report", "");
  lines.push(`- Target: \`${report.target}\``);
  lines.push(`- Java files analyzed: ${report.filesAnalyzed}`);
  lines.push(`- Files skipped (could not be parsed): ${report.failedFiles.length}`, "");

  lines.push("## Summary", "");
  lines.push("| Anti-pattern | Flagged | Total | Percentage | Out of |");
  lines.push("|---|---:|---:|---:|---|");
  for (const s of report.summary) {
    lines.push(`| ${s.antiPattern} | ${s.flagged} | ${s.total} | ${s.percentage.toFixed(2)}% | ${s.unit} |`);
  }
  lines.push("");

  // One section per anti-pattern, listing every finding.
  for (const s of report.summary) {
    const matches = report.findings.filter((f) => f.antiPattern === s.antiPattern);
    lines.push(`## ${s.antiPattern} (${matches.length})`, "");
    if (matches.length === 0) {
      lines.push("No findings.", "");
      continue;
    }
    lines.push("| Location | Method | Detail |");
    lines.push("|---|---|---|");
    for (const f of matches) {
      lines.push(`| ${escapeMd(f.file)}:${f.line} | ${escapeMd(f.method)} | ${escapeMd(f.detail)} |`);
    }
    lines.push("");
  }

  if (report.failedFiles.length > 0) {
    lines.push("## Skipped files", "");
    for (const file of report.failedFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// A `|` inside a table cell would start a new column, so escape it.
function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function toCsv(findings: Finding[]): string {
  const rows = [["anti_pattern", "file", "line", "method", "detail"]];
  for (const f of findings) {
    rows.push([f.antiPattern, f.file, String(f.line), f.method, f.detail]);
  }
  return rows.map((row) => row.map(csvField).join(",")).join("\n") + "\n";
}

// CSV rule: wrap each field in double quotes, and write a quote inside it as "".
// This keeps commas in a detail ("IOException, SQLException") inside one column.
function csvField(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}
