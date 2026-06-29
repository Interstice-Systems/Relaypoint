import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NO_RUN_MESSAGE, readLatestStatus, renderStatus } from "../src/status.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-status-"));
  roots.push(root);
  return root;
}

async function writeLatest(root: string, record: unknown): Promise<void> {
  const latest = path.join(root, ".relaypoint", "latest");
  await mkdir(latest, { recursive: true });
  await writeFile(path.join(latest, "RUN_RECORD.json"), JSON.stringify(record));
}

const fullRecord = {
  run_id: "2026-06-28T18-41-02Z-001",
  created_at: "2026-06-28T18:41:02.123Z",
  repo: {
    name: "fallback-name",
    branch: "main",
    commit: "abc123456789",
    working_tree_clean: false,
  },
  detected_project: { type: "node", name: "relaypoint" },
  project_profile: { loaded: true, project_name: "Relaypoint" },
  readiness: "READY_FOR_REVIEW",
  validation: {
    results: [
      { script: "test", status: "passed", exit_code: 0 },
      { script: "build", exit_code: 0 },
      { script: "lint", status: "failed", exit_code: 1 },
      { script: "missing", status: "skipped", exit_code: null },
      { command: "legacy-check", exit_code: null },
    ],
  },
  policy: {
    status: "WARN",
    findings: [
      { severity: "blocking" },
      { severity: "warning" },
      { severity: "info" },
      { severity: "info" },
    ],
  },
  quality_review: {
    finding_count: 4,
    findings: [
      { severity: "high" },
      { severity: "medium" },
      { severity: "low" },
      { severity: "low" },
    ],
  },
  comparison: {
    available: true,
    summary: {
      readiness_change: "unchanged",
      risk_flags_added: [],
      risk_flags_removed: ["VALIDATION_NOT_RUN"],
      quality_findings_added: 1,
      quality_findings_removed: 2,
      validation_improved: ["test"],
      validation_regressed: [],
    },
  },
  outputs: {
    handoff: "HANDOFF.md",
    qa_report: "QA_REPORT.md",
    agent_handoff: "AGENT_HANDOFF.md",
    quality_review: "QUALITY_REVIEW.md",
    run_comparison: "RUN_COMPARISON.md",
    policy_report: "POLICY_REPORT.md",
  },
};

describe("project status", () => {
  it("handles a missing latest run without creating output", async () => {
    const root = await temporaryRoot();
    expect(await readLatestStatus(root)).toBeNull();
    expect(NO_RUN_MESSAGE).toBe("No Relaypoint run found. Run `relaypoint handoff` first.");
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("reads and summarizes the latest run record", async () => {
    const root = await temporaryRoot();
    await writeLatest(root, fullRecord);

    const output = await readLatestStatus(root);
    expect(output).toContain("Name: Relaypoint");
    expect(output).toContain("Type: node");
    expect(output).toContain("Profile: loaded");
    expect(output).toContain("Run ID: 2026-06-28T18-41-02Z-001");
    expect(output).toContain("Created: 2026-06-28T18:41:02.123Z");
    expect(output).toContain("Branch: main");
    expect(output).toContain("Commit: abc1234");
    expect(output).toContain("Working Tree: dirty");
  });

  it("summarizes validation, policy, and quality evidence", () => {
    const output = renderStatus(fullRecord);
    expect(output).toContain("Passed: test, build");
    expect(output).toContain("Failed: lint");
    expect(output).toContain("Skipped: missing");
    expect(output).toContain("Unknown: legacy-check");
    expect(output).toContain("Status: WARN");
    expect(output).toContain("Blocking: 1");
    expect(output).toContain("Warning: 1");
    expect(output).toContain("Info: 2");
    expect(output).toContain("Findings: 4");
    expect(output).toContain("High: 1");
    expect(output).toContain("Medium: 1");
    expect(output).toContain("Low: 2");
  });

  it("summarizes comparison movement and report outputs", () => {
    const output = renderStatus(fullRecord);
    expect(output).toContain("Readiness Change: unchanged");
    expect(output).toContain("Risks Added: 0");
    expect(output).toContain("Risks Removed: 1");
    expect(output).toContain("Quality Findings Added: 1");
    expect(output).toContain("Quality Findings Removed: 2");
    expect(output).toContain("Validation Improved: 1");
    expect(output).toContain("Validation Regressed: 0");
    for (const report of [...Object.values(fullRecord.outputs), "RUN_RECORD.json"]) {
      expect(output).toContain(`  ${report}`);
    }
  });

  it("handles an older record with missing optional fields", async () => {
    const root = await temporaryRoot();
    await writeLatest(root, {
      run_id: "legacy",
      repo: { name: "legacy-project" },
      validation: { results: [{ command: "npm test", exit_code: 0 }] },
      outputs: { handoff: "HANDOFF.md" },
    });

    const output = await readLatestStatus(root);
    expect(output).toContain("Name: legacy-project");
    expect(output).toContain("Created: unknown");
    expect(output).toContain("Profile: unknown");
    expect(output).toContain("Policy: unavailable");
    expect(output).toContain("Quality: unavailable");
    expect(output).toContain("Passed: npm test");
    expect(output).toContain("Available: no");
    expect(output).toContain("HANDOFF.md");
  });

  it("reports malformed latest JSON with a helpful error", async () => {
    const root = await temporaryRoot();
    const latest = path.join(root, ".relaypoint", "latest");
    await mkdir(latest, { recursive: true });
    await writeFile(path.join(latest, "RUN_RECORD.json"), '{"run_id":');

    await expect(readLatestStatus(root)).rejects.toThrow("Latest RUN_RECORD.json is not valid JSON");
  });

  it("keeps long record lists concise and avoids prescriptive language", () => {
    const output = renderStatus({
      ...fullRecord,
      validation: {
        results: Array.from({ length: 8 }, (_, index) => ({ script: `check-${index + 1}`, status: "passed" })),
      },
      comparison: { enabled: false, available: false, reason: "Comparison disabled by --no-compare." },
      outputs: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`report_${index}`, `REPORT_${index}.md`])),
    });

    expect(output).toContain("Passed: check-1, check-2, check-3, check-4, check-5 (+3 more)");
    expect(output).toContain("Reason: Comparison disabled by --no-compare.");
    expect(output).toContain("... 3 more reports");
    expect(output.toLowerCase()).not.toContain("next agent");
    expect(output.toLowerCase()).not.toContain("next task");
  });

  it("does not create another run when status is read", async () => {
    const root = await temporaryRoot();
    await writeLatest(root, fullRecord);
    const runs = path.join(root, ".relaypoint", "runs");
    await mkdir(path.join(runs, "existing-run"), { recursive: true });
    const before = await readdir(runs);

    await readLatestStatus(root);

    expect(await readdir(runs)).toEqual(before);
  });
});
