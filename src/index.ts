import path from "node:path";
import { inspectGit } from "./git.js";
import { detectProject } from "./projectDetect.js";
import { runRequestedValidations } from "./validation.js";
import { createRunRecord } from "./runRecord.js";
import { renderAgentHandoff, renderHandoff, renderQaReport, renderQualityReview, renderRunComparison } from "./renderMarkdown.js";
import { safeTimestamp, writeBundle } from "./fsUtils.js";
import type { RunRecord } from "./types.js";
import { reviewChangedFiles } from "./qualityReview.js";
import { compareRuns, findPreviousRun } from "./runComparison.js";

export async function createHandoff(options: { cwd?: string; run?: string[]; now?: Date; compare?: boolean } = {}): Promise<{ record: RunRecord; runDir: string }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const git = inspectGit(cwd); // Capture before writing any Relaypoint output.
  if (!git.isGitRepo) throw new Error(`Not a Git repository: ${cwd}`);
  const now = options.now ?? new Date();
  const runId = safeTimestamp(now);
  const comparisonEnabled = options.compare !== false;
  const previous = comparisonEnabled ? await findPreviousRun(git.root, runId) : null; // Select before creating this run.
  const project = await detectProject(git.root);
  const requested = options.run ?? [];
  const results = await runRequestedValidations(git.root, project, requested);
  const qualityReview = await reviewChangedFiles(git.root, git.changedFiles);
  const unavailableComparison = comparisonEnabled
    ? { enabled: true, available: false, reason: "No previous Relaypoint run was found." }
    : { enabled: false, available: false, reason: "Comparison disabled by --no-compare." };
  const record = createRunRecord({ runId, createdAt: now.toISOString(), git, project, requested, results, qualityReview, comparison: unavailableComparison });
  if (previous) record.comparison = compareRuns(previous, record);
  const files = {
    "HANDOFF.md": renderHandoff(record), "QA_REPORT.md": renderQaReport(record),
    "AGENT_HANDOFF.md": renderAgentHandoff(record), "QUALITY_REVIEW.md": renderQualityReview(record),
    "RUN_COMPARISON.md": renderRunComparison(record),
    "RUN_RECORD.json": `${JSON.stringify(record, null, 2)}\n`,
  };
  const runDir = await writeBundle(git.root, runId, files);
  return { record, runDir };
}

export * from "./types.js";
