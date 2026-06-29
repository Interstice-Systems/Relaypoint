import type { DetectedProject, PolicyRecord, ProjectProfileRecord, QualityReview, RunComparison, RunRecord, ValidationResult } from "./types.js";
import type { GitState } from "./git.js";
import { determineReadiness, generateRiskFlags } from "./riskFlags.js";
import { discoverValidationCommands } from "./validation.js";
import { toQualityReviewRecord } from "./qualityReview.js";
import { evaluatePolicy, STARTER_RULES } from "./policyRules.js";

export function createRunRecord(input: { runId: string; createdAt: string; git: GitState; project: DetectedProject; requested: string[]; results: ValidationResult[]; projectProfile?: ProjectProfileRecord; qualityReview?: QualityReview; policy?: PolicyRecord; comparison?: RunComparison }): RunRecord {
  const discovered = discoverValidationCommands(input.project);
  const riskFlags = generateRiskFlags({
    isGitRepo: input.git.isGitRepo, workingTreeClean: input.git.workingTreeClean,
    changedFiles: input.git.changedFiles, project: input.project, discovered,
    requested: input.requested, results: input.results,
  });
  const qualityReview = input.qualityReview ?? { enabled: true, mode: "heuristic", filesReviewed: 0, findingCount: 0, highestSeverity: null, findings: [] };
  const projectProfile = input.projectProfile ?? { enabled: true, loaded: false, path: ".relaypoint/project_profile.json", warnings: ["No project profile found. Run `relaypoint init` to create one."] };
  const policy = input.policy ?? evaluatePolicy(
    { enabled: true, path: ".relaypoint/rules.json", loaded: false, usingDefaults: true, rules: structuredClone(STARTER_RULES.rules), warnings: [] },
    { changedFiles: input.git.changedFiles, results: input.results, projectProfile, qualityReview },
  );
  let readiness = determineReadiness(riskFlags, input.results);
  if (policy.status === "BLOCKED" && readiness !== "HAS_FAILURES") readiness = "NEEDS_VALIDATION";
  return {
    schema_version: "0.5.0", tool: "relaypoint", run_id: input.runId, created_at: input.createdAt,
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
    readiness,
    quality_review: toQualityReviewRecord(qualityReview),
    project_profile: projectProfile,
    policy,
    comparison: input.comparison ?? { enabled: true, available: false, reason: "No previous Relaypoint run was found." },
    outputs: { handoff: "HANDOFF.md", qa_report: "QA_REPORT.md", agent_handoff: "AGENT_HANDOFF.md", quality_review: "QUALITY_REVIEW.md", run_comparison: "RUN_COMPARISON.md", policy_report: "POLICY_REPORT.md" },
  };
}
