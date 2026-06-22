import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeBundle } from "../src/fsUtils.js";
import { renderAgentHandoff, renderHandoff, renderQaReport, renderQualityReview } from "../src/renderMarkdown.js";
import { createRunRecord } from "../src/runRecord.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("handoff quality output", () => {
  it("writes quality review to the run and latest bundles", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-handoff-"));
    roots.push(root);
    const git = { isGitRepo: true, root, name: "fixture", branch: "main", commit: "abc123", workingTreeClean: false, changedFiles: [{ path: "example.ts", status: " M", category: "source" as const }], recentCommits: [] };
    const project = { type: "node" as const, package_manager: "npm" as const, name: "fixture", scripts: {}, validation_suggestions: [] };
    const qualityReview = { enabled: true as const, mode: "heuristic" as const, filesReviewed: 1, findingCount: 1, highestSeverity: "low" as const, findings: [{ file: "example.ts", category: "long-line", severity: "low" as const, message: "Long lines may reduce readability.", evidence: "Line 2 exceeds 120 characters.", reviewFocus: "Check whether it can be easier to scan." }] };
    const record = createRunRecord({ runId: "2026-06-21T12-00-00-000Z", createdAt: "2026-06-21T12:00:00.000Z", git, project, requested: [], results: [], qualityReview });
    const files = { "HANDOFF.md": renderHandoff(record), "QA_REPORT.md": renderQaReport(record), "AGENT_HANDOFF.md": renderAgentHandoff(record), "QUALITY_REVIEW.md": renderQualityReview(record), "RUN_RECORD.json": `${JSON.stringify(record, null, 2)}\n` };
    const runDir = await writeBundle(root, record.run_id, files);
    const runQuality = await readFile(path.join(runDir, "QUALITY_REVIEW.md"), "utf8");
    const latestQuality = await readFile(path.join(root, ".relaypoint", "latest", "QUALITY_REVIEW.md"), "utf8");
    const json = JSON.parse(await readFile(path.join(root, ".relaypoint", "latest", "RUN_RECORD.json"), "utf8"));
    expect(runQuality).toBe(latestQuality);
    expect(runQuality).toContain("# Quality Review");
    expect(json.quality_review).toMatchObject({ enabled: true, mode: "heuristic", files_reviewed: 1 });
    expect(json.outputs.quality_review).toBe("QUALITY_REVIEW.md");
    expect(record.readiness).not.toBe("HAS_FAILURES");
  });
});
