import type { DetectedProject, QualityReview, RunRecord, ValidationResult } from "./types.js";
import type { GitState } from "./git.js";
import { determineReadiness, generateRiskFlags } from "./riskFlags.js";
import { discoverValidationCommands } from "./validation.js";
import { toQualityReviewRecord } from "./qualityReview.js";

export function createRunRecord(input: { runId: string; createdAt: string; git: GitState; project: DetectedProject; requested: string[]; results: ValidationResult[]; qualityReview?: QualityReview }): RunRecord {
  const discovered = discoverValidationCommands(input.project);
  const riskFlags = generateRiskFlags({
    isGitRepo: input.git.isGitRepo, workingTreeClean: input.git.workingTreeClean,
    changedFiles: input.git.changedFiles, project: input.project, discovered,
    requested: input.requested, results: input.results,
  });
  const qualityReview = input.qualityReview ?? { enabled: true, mode: "heuristic", filesReviewed: 0, findingCount: 0, highestSeverity: null, findings: [] };
  return {
    schema_version: "0.1.0", tool: "relaypoint", run_id: input.runId, created_at: input.createdAt,
    repo: { name: input.git.name, root: input.git.root, branch: input.git.branch, commit: input.git.commit, is_git_repo: input.git.isGitRepo, working_tree_clean: input.git.workingTreeClean },
    changed_files: input.git.changedFiles,
    recent_commits: input.git.recentCommits,
    detected_project: input.project,
    validation: {
      commands_discovered: discovered,
      commands_requested: input.requested,
      commands_run: input.results.filter((result) => result.status !== "skipped").map((result) => result.command),
      results: input.results,
    },
    risk_flags: riskFlags,
    readiness: determineReadiness(riskFlags, input.results),
    quality_review: toQualityReviewRecord(qualityReview),
    outputs: { handoff: "HANDOFF.md", qa_report: "QA_REPORT.md", agent_handoff: "AGENT_HANDOFF.md", quality_review: "QUALITY_REVIEW.md" },
  };
}
