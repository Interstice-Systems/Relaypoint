export type FileCategory = "source" | "test" | "docs" | "config" | "lockfile" | "generated" | "unknown";
export type Readiness = "READY_FOR_REVIEW" | "NEEDS_VALIDATION" | "HAS_FAILURES" | "UNKNOWN";

export interface ChangedFile { path: string; status: string; category: FileCategory }
export interface RecentCommit { hash: string; subject: string; author: string; date: string }
export interface DetectedProject {
  type: "node" | "python" | "unknown";
  package_manager: "npm" | "pnpm" | "yarn" | "unknown";
  name?: string;
  scripts: Record<string, string>;
  validation_suggestions: string[];
}
export interface ValidationResult {
  script: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exit_code: number | null;
  duration_ms: number;
  stdout_preview: string;
  stderr_preview: string;
  reason?: string;
}
export type QualitySeverity = "high" | "medium" | "low";
export interface QualityFinding {
  file: string;
  category: string;
  severity: QualitySeverity;
  message: string;
  evidence: string;
  reviewFocus: string;
}
export interface QualityReview {
  enabled: true;
  mode: "heuristic";
  filesReviewed: number;
  findingCount: number;
  highestSeverity: QualitySeverity | null;
  findings: QualityFinding[];
}
export interface QualityReviewRecord {
  enabled: true;
  mode: "heuristic";
  files_reviewed: number;
  finding_count: number;
  highest_severity: QualitySeverity | null;
  findings: Array<Omit<QualityFinding, "reviewFocus"> & { review_focus: string }>;
}
export type ReadinessMovement = "improved" | "regressed" | "unchanged" | "unknown";
export interface RunComparisonSummary {
  readiness_previous: Readiness;
  readiness_current: Readiness;
  readiness_change: ReadinessMovement;
  risk_flags_added: string[];
  risk_flags_removed: string[];
  risk_flags_persistent: string[];
  changed_files_added: string[];
  changed_files_removed: string[];
  changed_files_persistent: string[];
  validation_improved: string[];
  validation_regressed: string[];
  validation_unchanged_passing: string[];
  validation_unchanged_failing: string[];
  validation_newly_run: string[];
  validation_no_longer_run: string[];
  validation_skipped: string[];
  quality_findings_added: number;
  quality_findings_removed: number;
  quality_finding_count_previous: number;
  quality_finding_count_current: number;
  quality_highest_severity_previous: QualitySeverity | null;
  quality_highest_severity_current: QualitySeverity | null;
  quality_highest_severity_change: ReadinessMovement;
}
export interface RunComparison {
  enabled: boolean;
  available: boolean;
  reason?: string;
  previous_run_id?: string;
  previous_created_at?: string;
  summary?: RunComparisonSummary;
}
export interface RunRecord {
  schema_version: "0.2.0";
  tool: "relaypoint";
  run_id: string;
  created_at: string;
  repo: {
    name: string; root: string; branch: string | null; commit: string | null;
    is_git_repo: boolean; working_tree_clean: boolean;
  };
  changed_files: ChangedFile[];
  recent_commits: RecentCommit[];
  detected_project: DetectedProject;
  validation: {
    commands_discovered: string[];
    commands_requested: string[];
    commands_run: string[];
    results: ValidationResult[];
  };
  risk_flags: string[];
  readiness: Readiness;
  quality_review: QualityReviewRecord;
  comparison: RunComparison;
  outputs: { handoff: "HANDOFF.md"; qa_report: "QA_REPORT.md"; agent_handoff: "AGENT_HANDOFF.md"; quality_review: "QUALITY_REVIEW.md"; run_comparison: "RUN_COMPARISON.md" };
}
