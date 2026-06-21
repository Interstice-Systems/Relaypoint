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
  it("has the stable v0 shape and agent handoff output", () => {
    const record = createRunRecord({ runId: "2026-06-21T00-00-00Z", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });
    expect(record).toMatchObject({ schema_version: "0.1.0", tool: "relaypoint", repo: { name: "example", is_git_repo: true }, validation: { commands_discovered: ["npm run test"] }, outputs: { agent_handoff: "AGENT_HANDOFF.md" } });
    expect(record.outputs).not.toHaveProperty("next_agent_prompt");
  });
});
