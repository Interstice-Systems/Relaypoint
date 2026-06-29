import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createRunRecord } from "../src/runRecord.js";
import type { GitState } from "../src/git.js";

export const mockGit: GitState = {
  isGitRepo: true, root: "/tmp/example", name: "example", branch: "main", commit: "abc123", workingTreeClean: false,
  changedFiles: [{ path: "src/index.ts", status: " M", category: "source" }],
  recentCommits: [{ hash: "abc123", subject: "Initial", author: "Dev", date: "2026-06-21T00:00:00Z" }],
};
export const mockProject = { type: "node" as const, package_manager: "npm" as const, name: "example", scripts: { test: "vitest" }, validation_suggestions: [] };

describe("run record", () => {
  it("uses the v0.99 package and v0.5 run record schema versions", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const record = createRunRecord({ runId: "fixed", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });
    expect(packageJson.version).toBe("0.99.0");
    expect(record.schema_version).toBe("0.5.0");
  });

  it("has the v0.5 schema, policy evidence, and output references", () => {
    const record = createRunRecord({ runId: "2026-06-21T00-00-00Z", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });
    expect(record).toMatchObject({ schema_version: "0.5.0", tool: "relaypoint", repo: { name: "example", is_git_repo: true }, validation: { commands_discovered: ["npm run test"] }, quality_review: { enabled: true, mode: "heuristic", finding_count: 0 }, project_profile: { enabled: true, loaded: false }, policy: { enabled: true, using_defaults: true, status: "WARN" }, comparison: { enabled: true, available: false }, outputs: { agent_handoff: "AGENT_HANDOFF.md", quality_review: "QUALITY_REVIEW.md", run_comparison: "RUN_COMPARISON.md", policy_report: "POLICY_REPORT.md" } });
    expect(record.outputs).not.toHaveProperty("next_agent_prompt");
  });

  it("lets blocking policy findings require validation without masking validation failures", () => {
    const policy = { enabled: true as const, rules_path: null, loaded: false, using_defaults: true, rules_loaded: 1, rules_evaluated: 1, rules_triggered: 1, status: "BLOCKED" as const, findings: [{ rule_id: "local_block", severity: "blocking" as const, description: "Local review requirement.", evidence: "Recorded evidence.", review_focus: "Review the evidence." }], warnings: [] };
    const blocked = createRunRecord({ runId: "fixed", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: ["test"], results: [{ script: "test", command: "npm run test", status: "passed", exit_code: 0, duration_ms: 1, stdout_preview: "", stderr_preview: "" }], policy });
    expect(blocked.readiness).toBe("NEEDS_VALIDATION");
    const failed = createRunRecord({ runId: "failed", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: ["test"], results: [{ script: "test", command: "npm run test", status: "failed", exit_code: 1, duration_ms: 1, stdout_preview: "", stderr_preview: "" }], policy });
    expect(failed.readiness).toBe("HAS_FAILURES");
  });

  it("does not convert quality findings into validation failures", () => {
    const qualityReview = { enabled: true as const, mode: "heuristic" as const, filesReviewed: 1, findingCount: 1, highestSeverity: "high" as const, findings: [{ file: "src/index.ts", category: "long-function", severity: "high" as const, message: "May deserve review.", evidence: "90 lines.", reviewFocus: "Inspect readability." }] };
    const record = createRunRecord({ runId: "fixed", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: ["test"], results: [{ script: "test", command: "npm run test", status: "passed", exit_code: 0, duration_ms: 1, stdout_preview: "", stderr_preview: "" }], qualityReview });
    expect(record.readiness).toBe("READY_FOR_REVIEW");
    expect(record.quality_review.highest_severity).toBe("high");
  });
});
