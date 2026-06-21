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
export interface RunRecord {
  schema_version: "0.1.0";
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
  outputs: { handoff: "HANDOFF.md"; qa_report: "QA_REPORT.md"; agent_handoff: "AGENT_HANDOFF.md" };
}
