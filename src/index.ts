import path from "node:path";
import { inspectGit } from "./git.js";
import { detectProject } from "./projectDetect.js";
import { runRequestedValidations } from "./validation.js";
import { createRunRecord } from "./runRecord.js";
import { renderAgentHandoff, renderHandoff, renderQaReport } from "./renderMarkdown.js";
import { safeTimestamp, writeBundle } from "./fsUtils.js";
import type { RunRecord } from "./types.js";

export async function createHandoff(options: { cwd?: string; run?: string[]; now?: Date } = {}): Promise<{ record: RunRecord; runDir: string }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const git = inspectGit(cwd); // Capture before writing any Relaypoint output.
  if (!git.isGitRepo) throw new Error(`Not a Git repository: ${cwd}`);
  const project = await detectProject(git.root);
  const requested = options.run ?? [];
  const results = await runRequestedValidations(git.root, project, requested);
  const now = options.now ?? new Date();
  const runId = safeTimestamp(now);
  const record = createRunRecord({ runId, createdAt: now.toISOString(), git, project, requested, results });
  const files = {
    "HANDOFF.md": renderHandoff(record), "QA_REPORT.md": renderQaReport(record),
    "AGENT_HANDOFF.md": renderAgentHandoff(record), "RUN_RECORD.json": `${JSON.stringify(record, null, 2)}\n`,
  };
  const runDir = await writeBundle(git.root, runId, files);
  return { record, runDir };
}

export * from "./types.js";
