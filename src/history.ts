import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compareRunIds } from "./runId.js";
import { readinessMovement } from "./runComparison.js";
import type { Readiness } from "./types.js";

export const DEFAULT_HISTORY_LIMIT = 10;
export const MAX_HISTORY_WARNINGS = 10;
export const NO_HISTORY_MESSAGE = "No Relaypoint runs found. Run `relaypoint handoff` first.";

type JsonObject = Record<string, unknown>;
export type HistoryValidationStatus = "PASS" | "FAIL" | "MIXED" | "NOT_RUN";
export type HistoryPolicyStatus = "PASS" | "WARN" | "BLOCKED" | "UNKNOWN" | "unavailable";

export interface HistoryRun {
  runId: string;
  createdAt?: string;
  project: string;
  readiness?: Readiness;
  policyStatus: HistoryPolicyStatus;
  validationStatus: HistoryValidationStatus;
  qualityFindings?: number;
}

export interface HistorySummary {
  totalRuns: number;
  skippedRuns: number;
  latest: HistoryRun;
  timeline: HistoryRun[];
  readinessCounts: Record<Readiness, number>;
  unavailableReadiness: number;
  policyCounts: Record<string, number>;
  validationCounts: Record<HistoryValidationStatus, number>;
  knownQualityRuns: number;
  totalQualityFindings: number;
  averageQualityFindings?: number;
  readinessImproved: number;
  readinessRegressed: number;
}

export interface HistoryResult {
  summary: HistorySummary | null;
  warnings: string[];
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function timestamp(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : undefined;
}

function readiness(value: unknown): Readiness | undefined {
  return value === "READY_FOR_REVIEW" || value === "NEEDS_VALIDATION" ||
    value === "HAS_FAILURES" || value === "UNKNOWN"
    ? value
    : undefined;
}

function policyStatus(value: unknown): HistoryPolicyStatus {
  if (value === "PASS" || value === "WARN" || value === "BLOCKED" || value === "UNKNOWN") return value;
  return text(value) ? "UNKNOWN" : "unavailable";
}

function validationResultStatus(value: unknown): "passed" | "failed" | "not_run" {
  const result = object(value);
  if (!result) return "not_run";
  const status = text(result.status)?.toLowerCase();
  if (status === "passed" || status === "pass" || status === "success") return "passed";
  if (status === "failed" || status === "fail" || status === "failure") return "failed";
  if (status === "skipped" || status === "skip" || status === "not_run" || status === "not run") return "not_run";
  if (typeof result.exit_code === "number") return result.exit_code === 0 ? "passed" : "failed";
  return "not_run";
}

export function summarizeValidation(value: unknown): HistoryValidationStatus {
  const results = object(value)?.results;
  if (!Array.isArray(results)) return "NOT_RUN";
  const statuses = results.map(validationResultStatus);
  const passed = statuses.includes("passed");
  const failed = statuses.includes("failed");
  if (passed && failed) return "MIXED";
  if (failed) return "FAIL";
  if (passed) return "PASS";
  return "NOT_RUN";
}

function projectName(record: JsonObject): string {
  return text(object(record.project_profile)?.project_name) ??
    text(object(record.detected_project)?.name) ??
    text(object(record.repo)?.name) ??
    "unknown";
}

function historyRun(record: JsonObject, directoryName: string): HistoryRun {
  const quality = object(record.quality_review);
  return {
    runId: text(record.run_id) ?? directoryName,
    createdAt: timestamp(record.created_at),
    project: projectName(record),
    readiness: readiness(record.readiness),
    policyStatus: policyStatus(object(record.policy)?.status),
    validationStatus: summarizeValidation(record.validation),
    qualityFindings: count(quality?.finding_count),
  };
}

function compareRuns(left: HistoryRun, right: HistoryRun): number {
  const created = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  return created || compareRunIds(left.runId, right.runId);
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function readHistory(cwd: string = process.cwd(), limit: number = DEFAULT_HISTORY_LIMIT): Promise<HistoryResult> {
  const runsRoot = path.join(path.resolve(cwd), ".relaypoint", "runs");
  let entries;
  try {
    entries = await readdir(runsRoot, { withFileTypes: true });
  } catch (error: unknown) {
    if (object(error)?.code === "ENOENT") return { summary: null, warnings: [] };
    throw error;
  }

  const warnings: string[] = [];
  const runs: HistoryRun[] = [];
  const directories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => compareRunIds(left.name, right.name));
  for (const directory of directories) {
    const recordPath = path.join(runsRoot, directory.name, "RUN_RECORD.json");
    try {
      const parsed: unknown = JSON.parse(await readFile(recordPath, "utf8"));
      const record = object(parsed);
      if (!record) throw new Error("record is not a JSON object");
      runs.push(historyRun(record, directory.name));
    } catch (error: unknown) {
      const reason = error instanceof SyntaxError ? "invalid JSON"
        : object(error)?.code === "ENOENT" ? "file not found"
        : object(error)?.code ? "unreadable record"
        : error instanceof Error ? error.message
        : "unreadable record";
      warnings.push(`Skipped run ${directory.name}: ${reason}.`);
    }
  }

  if (runs.length === 0) return { summary: null, warnings };
  runs.sort(compareRuns);
  const readinessCounts: Record<Readiness, number> = {
    READY_FOR_REVIEW: 0,
    NEEDS_VALIDATION: 0,
    HAS_FAILURES: 0,
    UNKNOWN: 0,
  };
  const policyCounts: Record<string, number> = {};
  const validationCounts: Record<HistoryValidationStatus, number> = { PASS: 0, FAIL: 0, MIXED: 0, NOT_RUN: 0 };
  let unavailableReadiness = 0;
  let knownQualityRuns = 0;
  let totalQualityFindings = 0;
  let readinessImproved = 0;
  let readinessRegressed = 0;

  for (const run of runs) {
    if (run.readiness) readinessCounts[run.readiness] += 1;
    else unavailableReadiness += 1;
    increment(policyCounts, run.policyStatus);
    validationCounts[run.validationStatus] += 1;
    if (run.qualityFindings !== undefined) {
      knownQualityRuns += 1;
      totalQualityFindings += run.qualityFindings;
    }
  }
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1].readiness;
    const current = runs[index].readiness;
    if (!previous || !current) continue;
    const movement = readinessMovement(previous, current);
    if (movement === "improved") readinessImproved += 1;
    if (movement === "regressed") readinessRegressed += 1;
  }

  const newestFirst = [...runs].reverse();
  return {
    warnings,
    summary: {
      totalRuns: runs.length,
      skippedRuns: warnings.length,
      latest: newestFirst[0],
      timeline: newestFirst.slice(0, limit),
      readinessCounts,
      unavailableReadiness,
      policyCounts,
      validationCounts,
      knownQualityRuns,
      totalQualityFindings,
      averageQualityFindings: knownQualityRuns > 0 ? totalQualityFindings / knownQualityRuns : undefined,
      readinessImproved,
      readinessRegressed,
    },
  };
}

function countLine(counts: Record<string, number>, keys: string[]): string {
  return keys.map((key) => `${key} ${counts[key] ?? 0}`).join(", ");
}

function timelineRow(run: HistoryRun): string {
  const created = run.createdAt ?? "unknown";
  const readinessLabel = run.readiness ?? "unknown";
  const quality = run.qualityFindings ?? "unknown";
  return `  ${created}  ${readinessLabel}  ${run.policyStatus}  validation: ${run.validationStatus}  quality: ${quality}  run: ${run.runId}`;
}

export function renderHistory(summary: HistorySummary): string {
  const latest = summary.latest;
  const policyKeys = ["PASS", "WARN", "BLOCKED", "UNKNOWN", "unavailable"];
  const readinessForCounts: Record<string, number> = {
    ...summary.readinessCounts,
    unavailable: summary.unavailableReadiness,
  };
  const average = summary.averageQualityFindings?.toFixed(1) ?? "unknown";
  const lines = [
    "Relaypoint History",
    "",
    `Runs: ${summary.totalRuns}`,
    `Project: ${latest.project}`,
  ];
  if (summary.skippedRuns > 0) lines.push(`Skipped invalid runs: ${summary.skippedRuns}`);
  lines.push(
    "",
    "Latest:",
    `  Run ID: ${latest.runId}`,
    `  Created: ${latest.createdAt ?? "unknown"}`,
    `  Readiness: ${latest.readiness ?? "unknown"}`,
    `  Policy: ${latest.policyStatus}`,
    `  Validation: ${latest.validationStatus}`,
    `  Quality Findings: ${latest.qualityFindings ?? "unknown"}`,
    "",
    `Timeline (latest ${summary.timeline.length}):`,
    ...summary.timeline.map(timelineRow),
    "",
    "Trends:",
    `  Readiness: ${countLine(readinessForCounts, ["READY_FOR_REVIEW", "NEEDS_VALIDATION", "HAS_FAILURES", "UNKNOWN", "unavailable"])}`,
    `  Readiness improved: ${summary.readinessImproved}`,
    `  Readiness regressed: ${summary.readinessRegressed}`,
    `  Policy: ${countLine(summary.policyCounts, policyKeys)}`,
    `  Validation: ${countLine(summary.validationCounts, ["PASS", "FAIL", "MIXED", "NOT_RUN"])}`,
    `  Average quality findings: ${average}`,
  );
  return `${lines.join("\n")}\n`;
}

export function renderHistoryWarnings(warnings: string[]): string[] {
  const lines = warnings.slice(0, MAX_HISTORY_WARNINGS);
  const remaining = warnings.length - lines.length;
  if (remaining > 0) lines.push(`${remaining} additional invalid run ${remaining === 1 ? "record was" : "records were"} skipped.`);
  return lines;
}
