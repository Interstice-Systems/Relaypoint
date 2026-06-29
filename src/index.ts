import path from "node:path";
import { inspectGit } from "./git.js";
import { detectProject } from "./projectDetect.js";
import { runRequestedValidations } from "./validation.js";
import { createRunRecord } from "./runRecord.js";
import { renderAgentHandoff, renderHandoff, renderPolicyReport, renderQaReport, renderQualityReview, renderRunComparison } from "./renderMarkdown.js";
import { writeBundle } from "./fsUtils.js";
import type { RunRecord } from "./types.js";
import { reviewChangedFiles } from "./qualityReview.js";
import { compareRuns, findPreviousRun } from "./runComparison.js";
import { applyIgnoredPaths, createProjectProfileRecord, loadProjectProfile } from "./projectProfile.js";
import { createUniqueRun } from "./runId.js";
import { evaluatePolicy, loadPolicyRules } from "./policyRules.js";

export async function createHandoff(options: { cwd?: string; run?: string[]; now?: Date; compare?: boolean } = {}): Promise<{ record: RunRecord; runDir: string }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const git = inspectGit(cwd); // Capture before writing any Relaypoint output.
  if (!git.isGitRepo) throw new Error(`Not a Git repository: ${cwd}`);
  const profile = await loadProjectProfile(git.root);
  const filtered = applyIgnoredPaths(git.changedFiles, profile);
  git.changedFiles = filtered.files;
  const now = options.now ?? new Date();
  const { runId, runDir: reservedRunDir } = await createUniqueRun({
    runsDir: path.join(git.root, ".relaypoint", "runs"),
    now,
  });
  const comparisonEnabled = options.compare !== false;
  const previous = comparisonEnabled ? await findPreviousRun(git.root, runId) : null;
  const project = await detectProject(git.root);
  const projectProfile = createProjectProfileRecord(profile, git.changedFiles, filtered.applied, project);
  const requested = options.run ?? [];
  const results = await runRequestedValidations(git.root, project, requested);
  const qualityReview = await reviewChangedFiles(git.root, git.changedFiles, profile.loaded ? profile.profile.quality : undefined);
  const loadedRules = await loadPolicyRules(git.root);
  const policy = evaluatePolicy(loadedRules, { changedFiles: git.changedFiles, results, projectProfile, qualityReview });
  const unavailableComparison = comparisonEnabled
    ? { enabled: true, available: false, reason: "No previous Relaypoint run was found." }
    : { enabled: false, available: false, reason: "Comparison disabled by --no-compare." };
  const record = createRunRecord({ runId, createdAt: now.toISOString(), git, project, requested, results, projectProfile, qualityReview, policy, comparison: unavailableComparison });
  if (previous) record.comparison = compareRuns(previous, record);
  const files = {
    "HANDOFF.md": renderHandoff(record), "QA_REPORT.md": renderQaReport(record),
    "AGENT_HANDOFF.md": renderAgentHandoff(record), "QUALITY_REVIEW.md": renderQualityReview(record),
    "RUN_COMPARISON.md": renderRunComparison(record),
    "POLICY_REPORT.md": renderPolicyReport(record),
    "RUN_RECORD.json": `${JSON.stringify(record, null, 2)}\n`,
  };
  const runDir = await writeBundle(git.root, runId, files, reservedRunDir);
  return { record, runDir };
}

export * from "./types.js";
export * from "./status.js";
export * from "./history.js";
