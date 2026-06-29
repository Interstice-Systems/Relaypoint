import { readFile } from "node:fs/promises";
import path from "node:path";

export const NO_RUN_MESSAGE = "No Relaypoint run found. Run `relaypoint handoff` first.";

type JsonObject = Record<string, unknown>;
const MAX_LIST_ITEMS = 5;
const MAX_REPORTS = 10;

interface NamedGroups {
  passed: string[];
  failed: string[];
  skipped: string[];
  unknown: string[];
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function displayList(values: string[]): string {
  if (values.length === 0) return "none";
  const visible = values.slice(0, MAX_LIST_ITEMS).join(", ");
  const remaining = values.length - MAX_LIST_ITEMS;
  return remaining > 0 ? `${visible} (+${remaining} more)` : visible;
}

function validationName(result: JsonObject): string {
  return text(result.script) ?? text(result.command) ?? "unknown";
}

function validationStatus(result: JsonObject): keyof NamedGroups {
  const status = text(result.status)?.toLowerCase();
  if (status === "passed" || status === "pass" || status === "success") return "passed";
  if (status === "failed" || status === "fail" || status === "failure") return "failed";
  if (status === "skipped" || status === "skip" || status === "not_run" || status === "not run") return "skipped";
  const exitCode = number(result.exit_code);
  if (exitCode === 0) return "passed";
  if (exitCode !== undefined) return "failed";
  return "unknown";
}

function summarizeValidation(record: JsonObject): NamedGroups {
  const groups: NamedGroups = { passed: [], failed: [], skipped: [], unknown: [] };
  const validation = object(record.validation);
  for (const value of array(validation?.results)) {
    const result = object(value);
    if (!result) continue;
    groups[validationStatus(result)].push(validationName(result));
  }
  return groups;
}

function overallValidation(groups: NamedGroups): string {
  if (groups.failed.length > 0) return "FAIL";
  if (groups.unknown.length > 0) return "UNKNOWN";
  if (groups.passed.length > 0) return "PASS";
  if (groups.skipped.length > 0) return "SKIPPED";
  return "NOT_RUN";
}

function countSeverities(findings: unknown): { high: number; medium: number; low: number } {
  const result = { high: 0, medium: 0, low: 0 };
  for (const value of array(findings)) {
    const severity = text(object(value)?.severity)?.toLowerCase();
    if (severity === "high" || severity === "medium" || severity === "low") result[severity] += 1;
  }
  return result;
}

function countPolicySeverities(findings: unknown): { blocking: number; warning: number; info: number } {
  const result = { blocking: 0, warning: 0, info: 0 };
  for (const value of array(findings)) {
    const severity = text(object(value)?.severity)?.toLowerCase();
    if (severity === "blocking" || severity === "warning" || severity === "info") result[severity] += 1;
  }
  return result;
}

function projectName(record: JsonObject): string {
  const profile = object(record.project_profile);
  const project = object(record.detected_project);
  const repo = object(record.repo);
  return text(profile?.project_name) ?? text(project?.name) ?? text(repo?.name) ?? "unknown";
}

function reportNames(record: JsonObject): string[] {
  const names = Object.values(object(record.outputs) ?? {}).flatMap((value) => text(value) ?? []);
  names.push("RUN_RECORD.json");
  return [...new Set(names)];
}

function profileStatus(profile: JsonObject | undefined): string {
  if (!profile) return "unknown";
  if (boolean(profile.loaded) === true) return "loaded";
  if (boolean(profile.loaded) === false) return "missing";
  return "unknown";
}

function workingTreeStatus(repo: JsonObject): string {
  if (boolean(repo.working_tree_clean) === true) return "clean";
  if (boolean(repo.working_tree_clean) === false) return "dirty";
  return "unknown";
}

function qualityLabel(quality: JsonObject | undefined): string {
  if (!quality) return "unavailable";
  const total = number(quality.finding_count) ?? arrayCount(quality.findings);
  if (total === undefined) return "unknown";
  return `${total} ${total === 1 ? "finding" : "findings"}`;
}

function renderOverview(record: JsonObject, validation: NamedGroups): string[] {
  const repo = object(record.repo) ?? {};
  const project = object(record.detected_project) ?? {};
  const profile = object(record.project_profile);
  const policy = object(record.policy);
  const quality = object(record.quality_review);
  const comparison = object(record.comparison);
  return [
    "Relaypoint Status",
    "",
    "Project",
    `  Name: ${projectName(record)}`,
    `  Type: ${text(project.type) ?? "unknown"}`,
    `  Profile: ${profileStatus(profile)}`,
    "",
    "Latest Run",
    `  Run ID: ${text(record.run_id) ?? "unknown"}`,
    `  Created: ${text(record.created_at) ?? "unknown"}`,
    `  Branch: ${text(repo.branch) ?? "unknown"}`,
    `  Commit: ${text(repo.commit)?.slice(0, 7) ?? "unknown"}`,
    `  Working Tree: ${workingTreeStatus(repo)}`,
    "",
    "Readiness",
    `  Overall: ${text(record.readiness) ?? "unknown"}`,
    `  Policy: ${policy ? text(policy.status) ?? "unknown" : "unavailable"}`,
    `  Validation: ${overallValidation(validation)}`,
    `  Quality: ${qualityLabel(quality)}`,
    `  Comparison: ${boolean(comparison?.available) === true ? "available" : "unavailable"}`,
    "",
    "Validation",
    `  Passed: ${displayList(validation.passed)}`,
    `  Failed: ${displayList(validation.failed)}`,
    `  Skipped: ${displayList(validation.skipped)}`,
    `  Unknown: ${displayList(validation.unknown)}`,
  ];
}

function renderPolicy(policy: JsonObject | undefined): string[] {
  if (!policy) return ["", "Policy", "  Status: unavailable"];
  const policyCounts = countPolicySeverities(policy?.findings);
  const hasFindings = Array.isArray(policy.findings);
  return [
    "",
    "Policy",
    `  Status: ${text(policy.status) ?? "unknown"}`,
    `  Blocking: ${hasFindings ? policyCounts.blocking : "unknown"}`,
    `  Warning: ${hasFindings ? policyCounts.warning : "unknown"}`,
    `  Info: ${hasFindings ? policyCounts.info : "unknown"}`,
  ];
}

function renderQuality(quality: JsonObject | undefined): string[] {
  if (!quality) return ["", "Quality", "  Findings: unavailable"];
  const qualityCounts = countSeverities(quality?.findings);
  const qualityTotal = number(quality?.finding_count) ?? arrayCount(quality?.findings);
  const hasFindings = Array.isArray(quality.findings);
  return [
    "",
    "Quality",
    `  Findings: ${qualityTotal ?? "unknown"}`,
    `  High: ${hasFindings ? qualityCounts.high : "unknown"}`,
    `  Medium: ${hasFindings ? qualityCounts.medium : "unknown"}`,
    `  Low: ${hasFindings ? qualityCounts.low : "unknown"}`,
  ];
}

function renderComparison(comparison: JsonObject | undefined): string[] {
  const lines = ["", "Comparison"];
  const summary = object(comparison?.summary);
  if (boolean(comparison?.available) === true) {
    lines.push(
      `  Readiness Change: ${text(summary?.readiness_change) ?? "unknown"}`,
      `  Risks Added: ${arrayCount(summary?.risk_flags_added) ?? "unknown"}`,
      `  Risks Removed: ${arrayCount(summary?.risk_flags_removed) ?? "unknown"}`,
      `  Quality Findings Added: ${number(summary?.quality_findings_added) ?? "unknown"}`,
      `  Quality Findings Removed: ${number(summary?.quality_findings_removed) ?? "unknown"}`,
    );
    if (summary && ("validation_improved" in summary || "validation_regressed" in summary)) {
      lines.push(
        `  Validation Improved: ${arrayCount(summary.validation_improved) ?? "unknown"}`,
        `  Validation Regressed: ${arrayCount(summary.validation_regressed) ?? "unknown"}`,
      );
    }
  } else {
    lines.push(`  Available: no`);
    const reason = text(comparison?.reason);
    if (reason) lines.push(`  Reason: ${reason}`);
  }
  return lines;
}

export function renderStatus(value: unknown): string {
  const record = object(value) ?? {};
  const validation = summarizeValidation(record);
  const reports = reportNames(record);
  const visibleReports = reports.slice(0, MAX_REPORTS).map((name) => `  ${name}`);
  if (reports.length > MAX_REPORTS) visibleReports.push(`  ... ${reports.length - MAX_REPORTS} more reports`);
  const lines = [
    ...renderOverview(record, validation),
    ...renderPolicy(object(record.policy)),
    ...renderQuality(object(record.quality_review)),
    ...renderComparison(object(record.comparison)),
    "",
    "Reports",
    ...visibleReports,
  ];
  return `${lines.join("\n")}\n`;
}

export async function readLatestStatus(cwd: string = process.cwd()): Promise<string | null> {
  const recordPath = path.join(path.resolve(cwd), ".relaypoint", "latest", "RUN_RECORD.json");
  try {
    const contents = await readFile(recordPath, "utf8");
    return renderStatus(JSON.parse(contents) as unknown);
  } catch (error: unknown) {
    if (object(error)?.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error(`Latest RUN_RECORD.json is not valid JSON: ${recordPath}`);
    throw error;
  }
}
