import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { QualitySeverity, Readiness, ReadinessMovement, RunComparison, RunRecord, ValidationResult } from "./types.js";
import { compareRunIds } from "./runId.js";

export type ComparableRunRecord = Pick<RunRecord, "run_id" | "created_at" | "readiness" | "risk_flags" | "changed_files" | "validation" | "quality_review">;

const readinessScore: Record<Readiness, number> = { UNKNOWN: 0, HAS_FAILURES: 1, NEEDS_VALIDATION: 2, READY_FOR_REVIEW: 3 };
const severityScore: Record<QualitySeverity, number> = { low: 1, medium: 2, high: 3 };
const alphabetic = (items: Iterable<string>): string[] => [...items].sort((a, b) => a.localeCompare(b));
const difference = (left: Set<string>, right: Set<string>): string[] => alphabetic([...left].filter((item) => !right.has(item)));
const intersection = (left: Set<string>, right: Set<string>): string[] => alphabetic([...left].filter((item) => right.has(item)));

function movement(previous: number | undefined, current: number | undefined): ReadinessMovement {
  if (previous === undefined || current === undefined) return "unknown";
  if (current > previous) return "improved";
  if (current < previous) return "regressed";
  return "unchanged";
}

export function readinessMovement(previous: Readiness, current: Readiness): ReadinessMovement {
  return movement(readinessScore[previous], readinessScore[current]);
}

function severityMovement(previous: QualitySeverity | null, current: QualitySeverity | null): ReadinessMovement {
  const before = previous ? severityScore[previous] : 0;
  const after = current ? severityScore[current] : 0;
  if (after > before) return "regressed";
  if (after < before) return "improved";
  return "unchanged";
}

function findingKey(finding: ComparableRunRecord["quality_review"]["findings"][number]): string {
  return `${finding.file}|${finding.category}|${finding.message}`;
}

function statusByCommand(results: ValidationResult[]): Map<string, ValidationResult["status"]> {
  return new Map([...results].sort((a, b) => a.command.localeCompare(b.command)).map((result) => {
    const status = result.status ?? (result.exit_code === 0 ? "passed" : result.exit_code === null ? "skipped" : "failed");
    return [result.command, status];
  }));
}

export function compareRuns(previous: ComparableRunRecord, current: ComparableRunRecord): RunComparison {
  const previousRisks = new Set(previous.risk_flags);
  const currentRisks = new Set(current.risk_flags);
  const previousFiles = new Set(previous.changed_files.map((file) => file.path));
  const currentFiles = new Set(current.changed_files.map((file) => file.path));
  const previousValidation = statusByCommand(previous.validation.results);
  const currentValidation = statusByCommand(current.validation.results);
  const validation = {
    improved: [] as string[], regressed: [] as string[], unchangedPassing: [] as string[],
    unchangedFailing: [] as string[], newlyRun: [] as string[], noLongerRun: [] as string[], skipped: [] as string[],
  };
  for (const command of alphabetic(new Set([...previousValidation.keys(), ...currentValidation.keys()]))) {
    const before = previousValidation.get(command);
    const after = currentValidation.get(command);
    if (!before) {
      validation.newlyRun.push(command);
      if (after === "passed") validation.improved.push(command);
      if (after === "skipped") validation.skipped.push(command);
    } else if (!after) {
      validation.noLongerRun.push(command);
      if (before === "passed") validation.regressed.push(command);
    } else if (before === "passed" && after === "passed") validation.unchangedPassing.push(command);
    else if (before === "failed" && after === "failed") validation.unchangedFailing.push(command);
    else if (after === "passed" && before !== "passed") validation.improved.push(command);
    else if (before === "passed" && after !== "passed") validation.regressed.push(command);
    else if (before === "skipped" && after === "failed") validation.regressed.push(command);
    else if (after === "skipped") validation.skipped.push(command);
  }
  const previousFindings = new Set(previous.quality_review.findings.map(findingKey));
  const currentFindings = new Set(current.quality_review.findings.map(findingKey));
  const previousSeverity = previous.quality_review.highest_severity;
  const currentSeverity = current.quality_review.highest_severity;
  return {
    enabled: true, available: true, previous_run_id: previous.run_id, previous_created_at: previous.created_at,
    summary: {
      readiness_previous: previous.readiness,
      readiness_current: current.readiness,
      readiness_change: readinessMovement(previous.readiness, current.readiness),
      risk_flags_added: difference(currentRisks, previousRisks), risk_flags_removed: difference(previousRisks, currentRisks), risk_flags_persistent: intersection(currentRisks, previousRisks),
      changed_files_added: difference(currentFiles, previousFiles), changed_files_removed: difference(previousFiles, currentFiles), changed_files_persistent: intersection(currentFiles, previousFiles),
      validation_improved: validation.improved, validation_regressed: validation.regressed,
      validation_unchanged_passing: validation.unchangedPassing, validation_unchanged_failing: validation.unchangedFailing,
      validation_newly_run: validation.newlyRun, validation_no_longer_run: validation.noLongerRun, validation_skipped: validation.skipped,
      quality_findings_added: difference(currentFindings, previousFindings).length,
      quality_findings_removed: difference(previousFindings, currentFindings).length,
      quality_finding_count_previous: previous.quality_review.finding_count,
      quality_finding_count_current: current.quality_review.finding_count,
      quality_highest_severity_previous: previousSeverity, quality_highest_severity_current: currentSeverity,
      quality_highest_severity_change: severityMovement(previousSeverity, currentSeverity),
    },
  };
}

function isComparable(value: unknown): value is ComparableRunRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ComparableRunRecord>;
  const readiness = new Set<Readiness>(["UNKNOWN", "HAS_FAILURES", "NEEDS_VALIDATION", "READY_FOR_REVIEW"]);
  const severities = new Set<QualitySeverity>(["low", "medium", "high"]);
  return typeof record.run_id === "string" && typeof record.created_at === "string" &&
    readiness.has(record.readiness as Readiness) && Array.isArray(record.risk_flags) && record.risk_flags.every((flag) => typeof flag === "string") &&
    Array.isArray(record.changed_files) && record.changed_files.every((file) => file && typeof file.path === "string") &&
    Array.isArray(record.validation?.results) && record.validation.results.every((result) => result && typeof result.command === "string" &&
      (["passed", "failed", "skipped"].includes(result.status) || (result.status == null && (typeof result.exit_code === "number" || result.exit_code === null)))) &&
    Array.isArray(record.quality_review?.findings) && record.quality_review.findings.every((finding) => finding &&
      typeof finding.file === "string" && typeof finding.category === "string" && typeof finding.message === "string") &&
    typeof record.quality_review?.finding_count === "number" &&
    (record.quality_review.highest_severity === null || severities.has(record.quality_review.highest_severity));
}

export async function findPreviousRun(repoRoot: string, excludeRunId?: string): Promise<ComparableRunRecord | null> {
  const runsRoot = path.join(repoRoot, ".relaypoint", "runs");
  let entries: string[];
  try { entries = await readdir(runsRoot); }
  catch { return null; }
  for (const entry of entries.sort((a, b) => compareRunIds(b, a))) {
    if (entry === excludeRunId) continue;
    try {
      const parsed: unknown = JSON.parse(await readFile(path.join(runsRoot, entry, "RUN_RECORD.json"), "utf8"));
      if (isComparable(parsed)) return parsed;
    } catch { /* Skip unreadable and invalid prior evidence. */ }
  }
  return null;
}
