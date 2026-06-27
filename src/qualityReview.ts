import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRelaypointOutput } from "./classifyFiles.js";
import type { ChangedFile, ProjectProfileQuality, QualityFinding, QualityReview, QualitySeverity } from "./types.js";

const excluded = /(^|\/)(node_modules|dist|coverage)(\/|$)/;
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/i;
const textExtension = /\.(?:md|mdx|txt|rst)$/i;
const severityRank: Record<QualitySeverity, number> = { high: 3, medium: 2, low: 1 };
const thresholds = {
  fileLines: { medium: 350, high: 600 },
  longLine: { characters: 160, minimumCount: 5 },
  longFunctionLines: 100,
  nestingDepth: 6,
  broadHelperLines: 250,
  exportedDeclarations: 10,
  repeatedAnyLines: 3,
  repeatedConsoleLogs: 3,
  markdownSectionLines: 100,
  consecutiveBulletLines: 15,
} as const;

function finding(file: string, category: string, severity: QualitySeverity, message: string, evidence: string, reviewFocus: string): QualityFinding {
  return { file, category, severity, message, evidence, reviewFocus };
}

function lineNumbers(lines: string[], predicate: (line: string, index: number) => boolean): number[] {
  return lines.flatMap((line, index) => predicate(line, index) ? [index + 1] : []);
}

function structuralText(line: string): string {
  return line
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "")
    .replace(/\/(?:\\.|[^/\\])+\/[a-z]*/gi, "");
}

function analyzeGeneral(file: ChangedFile, lines: string[], quality?: ProjectProfileQuality): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const fileLimit = quality?.max_file_lines;
  if (fileLimit) {
    if (lines.length > fileLimit) findings.push(finding(file.path, "file-size", "high", "This changed file exceeds the project profile limit and may deserve review.", `${lines.length} lines (profile threshold: ${fileLimit}).`, "Check whether the file has distinct responsibilities that can be understood independently."));
  } else if (lines.length > thresholds.fileLines.high) findings.push(finding(file.path, "file-size", "high", "This changed file is large and may deserve review.", `${lines.length} lines (threshold: ${thresholds.fileLines.high}).`, "Check whether the file has distinct responsibilities that can be understood independently."));
  else if (lines.length > thresholds.fileLines.medium) findings.push(finding(file.path, "changed-file-size", "medium", "This changed file may be a possible simplification target.", `${lines.length} lines (threshold: ${thresholds.fileLines.medium}).`, "Review the file structure and whether its responsibilities remain clear."));

  const lineLimit = quality?.max_line_length ?? thresholds.longLine.characters;
  const longLines = lineNumbers(lines, (line) => line.length > lineLimit);
  if (longLines.length >= thresholds.longLine.minimumCount) findings.push(finding(file.path, "long-line", "low", "Repeated long lines may reduce readability.", `${longLines.length} lines exceed ${lineLimit} characters; first at line ${longLines[0]}.`, "Check whether the long expressions or prose can be made easier to scan."));

  const markers = lines.flatMap((line, index) => {
    const searchable = ["source", "test"].includes(file.category) && !/^\s*(?:\/\/|\/\*|\*)/.test(line) ? "" : line;
    return [...searchable.matchAll(/\b(TODO|FIXME|HACK)\b/gi)].map((match) => `${match[1].toUpperCase()} at line ${index + 1}`);
  });
  if (markers.length && quality?.allow_todos !== true) {
    const remainder = markers.length > 5 ? `, plus ${markers.length - 5} more` : "";
    findings.push(finding(file.path, "review-marker", "medium", "Explicit review markers may indicate unfinished or intentionally deferred work.", `${markers.slice(0, 5).join(", ")}${remainder}.`, "Confirm each marker is intentional, current, and understandable to a reviewer."));
  }

  const extraBlanks = lineNumbers(lines, (line, index) => index >= 2 && !line.trim() && !lines[index - 1].trim() && !lines[index - 2].trim());
  if (extraBlanks.length) findings.push(finding(file.path, "adjacent-blank-lines", "low", "Repeated adjacent blank lines add visual noise.", `${extraBlanks.length} run(s) contain more than two blank lines; first near line ${extraBlanks[0]}.`, "Review spacing for a more consistent document or source layout."));
  return findings;
}

function functionRanges(lines: string[]): Array<{ start: number; end: number }> {
  const starts = /(?:\bfunction\s+[\w$]+\s*\(|(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+[\w$]+\s*=.*=>|(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*[\w$]+\s*\([^;]*\)\s*\{)/;
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < lines.length; start += 1) {
    if (!starts.test(lines[start])) continue;
    let depth = 0;
    let opened = false;
    for (let end = start; end < lines.length; end += 1) {
      const structural = structuralText(lines[end]);
      const opens = (structural.match(/\{/g) ?? []).length;
      const closes = (structural.match(/\}/g) ?? []).length;
      depth += opens - closes;
      opened ||= opens > 0;
      if (opened && depth <= 0) { ranges.push({ start: start + 1, end: end + 1 }); start = end; break; }
    }
  }
  return ranges;
}

function analyzeSource(file: ChangedFile, lines: string[], quality?: ProjectProfileQuality): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const functionLimit = quality?.max_function_lines ?? thresholds.longFunctionLines;
  const longFunctions = functionRanges(lines).filter((range) => range.end - range.start + 1 > functionLimit);
  if (longFunctions.length) findings.push(finding(file.path, "long-function", "high", "A function appears long enough to deserve closer review.", `${longFunctions.length} function(s) exceed ${functionLimit} lines; first spans lines ${longFunctions[0].start}-${longFunctions[0].end}.`, "Check whether the function's control flow and responsibilities can be understood in smaller units."));

  let depth = 0;
  let maximum = 0;
  let maximumLine = 0;
  lines.forEach((line, index) => {
    const structural = structuralText(line);
    const opens = (structural.match(/\{/g) ?? []).length;
    const closes = (structural.match(/\}/g) ?? []).length;
    depth = Math.max(0, depth + opens - closes);
    if (depth > maximum) { maximum = depth; maximumLine = index + 1; }
  });
  if (maximum > thresholds.nestingDepth) findings.push(finding(file.path, "deep-nesting", "high", "Deeply nested blocks may make control flow harder to follow.", `Approximate brace depth ${maximum} near line ${maximumLine} (threshold: ${thresholds.nestingDepth}).`, "Review nested control flow and confirm each branch remains easy to reason about."));

  const base = path.basename(file.path).toLowerCase();
  if (/^(?:utils?|helpers?)\.[^.]+$/.test(base) && lines.length > thresholds.broadHelperLines) findings.push(finding(file.path, "broad-helper-file", "medium", "A broad helper file may contain too many unrelated responsibilities.", `${base} contains ${lines.length} lines (threshold: ${thresholds.broadHelperLines}).`, "Check whether the helpers form clear, cohesive groups."));

  const exports = lineNumbers(lines, (line) => /^\s*export\s+(?:async\s+)?(?:function|const|let|class)\b/.test(line));
  if (exports.length >= thresholds.exportedDeclarations) findings.push(finding(file.path, "many-exports", "medium", "Many exported declarations may make the module's role harder to understand.", `${exports.length} exported declarations (threshold: ${thresholds.exportedDeclarations}).`, "Review whether the public surface is cohesive and intentionally scoped."));

  const anyLines = lineNumbers(lines, (line) => /\bany\b/.test(line));
  if (anyLines.length >= thresholds.repeatedAnyLines) findings.push(finding(file.path, "repeated-any", "medium", "Repeated `any` usage may obscure type expectations.", `${anyLines.length} lines use any; first at line ${anyLines[0]}.`, "Check whether the affected boundaries can communicate more precise types."));

  const logs = lineNumbers(lines, (line) => /\bconsole\.log\s*\(/.test(line));
  const cliOrTest = file.category === "test" || /(^|\/)(?:cli|bin)(?:\.|\/)/i.test(file.path) || /\.(?:test|spec)\.[^.]+$/i.test(file.path);
  if (!cliOrTest && logs.length >= thresholds.repeatedConsoleLogs) findings.push(finding(file.path, "repeated-console-log", "low", "Repeated console logging outside CLI or tests may add noise.", `${logs.length} console.log calls; first at line ${logs[0]}.`, "Confirm the logging is intentional and appropriate for the module."));
  return findings;
}

function analyzeText(file: ChangedFile, lines: string[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const headings = lines.map((line, index) => ({ text: line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1]?.trim().toLowerCase(), line: index + 1 })).filter((entry) => entry.text);
  const repeated = [...new Set(headings.filter((entry, index) => headings.findIndex((candidate) => candidate.text === entry.text) !== index).map((entry) => entry.text!))];
  if (repeated.length) findings.push(finding(file.path, "repeated-heading", "medium", "Repeated heading text may make document structure ambiguous.", `Repeated heading(s): ${repeated.slice(0, 5).join(", ")}.`, "Check whether repeated sections are distinct and clearly named."));

  const boundaries = headings.map((heading) => heading.line).concat(lines.length + 1);
  const sections = headings.map((heading, index) => ({ line: heading.line, length: boundaries[index + 1] - heading.line }));
  const longSections = sections.filter((section) => section.length > thresholds.markdownSectionLines);
  if (longSections.length) findings.push(finding(file.path, "long-markdown-section", "medium", "A long Markdown section may be difficult to scan.", `${longSections.length} section(s) exceed ${thresholds.markdownSectionLines} lines; first begins at line ${longSections[0].line}.`, "Review whether headings or tighter organization would clarify the section."));

  let bulletRun = 0;
  let maximumRun = 0;
  let maximumEnd = 0;
  lines.forEach((line, index) => {
    if (/^\s*(?:[-*+] |\d+[.)] )/.test(line)) bulletRun += 1; else bulletRun = 0;
    if (bulletRun > maximumRun) { maximumRun = bulletRun; maximumEnd = index + 1; }
  });
  if (maximumRun > thresholds.consecutiveBulletLines) findings.push(finding(file.path, "bullet-density", "low", "A dense bullet sequence may be hard to scan.", `${maximumRun} consecutive bullet lines ending near line ${maximumEnd} (threshold: ${thresholds.consecutiveBulletLines}).`, "Check whether grouping or short explanatory text would improve readability."));

  const phrases = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const normalized = line.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalized.length < 40 || /^\s*(?:[-*+#]|\d+[.)])/.test(line)) return;
    phrases.set(normalized, [...(phrases.get(normalized) ?? []), index + 1]);
  });
  const repeatedPhrase = [...phrases.entries()].find(([, occurrences]) => occurrences.length >= 2);
  if (repeatedPhrase) findings.push(finding(file.path, "repeated-phrase", "low", "Repeated prose may indicate unnecessary duplication.", `The same phrase appears on lines ${repeatedPhrase[1].slice(0, 5).join(", ")}.`, "Check whether the repeated statement adds distinct context each time."));
  return findings;
}

export async function reviewChangedFiles(repoRoot: string, changedFiles: ChangedFile[], quality?: ProjectProfileQuality): Promise<QualityReview> {
  const findings: QualityFinding[] = [];
  let filesReviewed = 0;
  for (const file of changedFiles) {
    const normalized = file.path.replaceAll("\\", "/");
    if (isRelaypointOutput(normalized) || excluded.test(normalized) || file.status.includes("D")) continue;
    const absolute = path.resolve(repoRoot, normalized);
    if (absolute !== repoRoot && !absolute.startsWith(`${repoRoot}${path.sep}`)) continue;
    let contents: string;
    try { contents = await readFile(absolute, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "EISDIR") continue;
      throw error;
    }
    if (contents.includes("\0")) continue;
    filesReviewed += 1;
    const lines = contents.split(/\r?\n/);
    findings.push(...analyzeGeneral(file, lines, quality));
    if (sourceExtension.test(normalized)) findings.push(...analyzeSource(file, lines, quality));
    if (textExtension.test(normalized)) findings.push(...analyzeText(file, lines));
  }
  findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.file.localeCompare(b.file) || a.category.localeCompare(b.category));
  return { enabled: true, mode: "heuristic", filesReviewed, findingCount: findings.length, highestSeverity: findings[0]?.severity ?? null, findings };
}

export function toQualityReviewRecord(review: QualityReview) {
  return {
    enabled: review.enabled, mode: review.mode, files_reviewed: review.filesReviewed,
    finding_count: review.findingCount, highest_severity: review.highestSeverity,
    findings: review.findings.map(({ reviewFocus, ...item }) => ({ ...item, review_focus: reviewFocus })),
  };
}
