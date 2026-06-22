import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareRuns, findPreviousRun } from "../src/runComparison.js";
import { createRunRecord } from "../src/runRecord.js";
import { mockGit, mockProject } from "./runRecord.test.js";
import type { RunRecord, ValidationResult } from "../src/types.js";

const result = (command: string, status: ValidationResult["status"]): ValidationResult => ({
  script: command, command, status, exit_code: status === "passed" ? 0 : status === "failed" ? 1 : null,
  duration_ms: 1, stdout_preview: "", stderr_preview: "",
});

function fixture(id: string): RunRecord {
  return createRunRecord({ runId: id, createdAt: `2026-06-21T00:00:0${id}.000Z`, git: mockGit, project: mockProject, requested: [], results: [] });
}

describe("run comparison", () => {
  it("compares risks, files, readiness, validation, and findings deterministically", () => {
    const previous = fixture("1");
    const current = fixture("2");
    previous.readiness = "HAS_FAILURES";
    current.readiness = "READY_FOR_REVIEW";
    previous.risk_flags = ["Z_PERSISTENT", "B_REMOVED"];
    current.risk_flags = ["A_ADDED", "Z_PERSISTENT"];
    previous.changed_files = [{ path: "z.ts", status: " M", category: "source" }, { path: "removed.ts", status: " M", category: "source" }];
    current.changed_files = [{ path: "added.ts", status: " M", category: "source" }, { path: "z.ts", status: " M", category: "source" }];
    previous.validation.results = [result("improved", "failed"), result("regressed", "passed"), result("pass", "passed"), result("fail", "failed"), result("removed", "passed"), result("skip", "failed")];
    current.validation.results = [result("improved", "passed"), result("regressed", "failed"), result("pass", "passed"), result("fail", "failed"), result("added", "passed"), result("skip", "skipped")];
    previous.quality_review = { ...previous.quality_review, finding_count: 2, highest_severity: "high", findings: [
      { file: "same.ts", category: "size", severity: "low", message: "same", evidence: "", review_focus: "" },
      { file: "old.ts", category: "size", severity: "high", message: "old", evidence: "", review_focus: "" },
    ] };
    current.quality_review = { ...current.quality_review, finding_count: 2, highest_severity: "medium", findings: [
      { file: "same.ts", category: "size", severity: "low", message: "same", evidence: "changed", review_focus: "changed" },
      { file: "new.ts", category: "size", severity: "medium", message: "new", evidence: "", review_focus: "" },
    ] };

    const summary = compareRuns(previous, current).summary!;
    expect(summary).toMatchObject({
      readiness_change: "improved", risk_flags_added: ["A_ADDED"], risk_flags_removed: ["B_REMOVED"], risk_flags_persistent: ["Z_PERSISTENT"],
      changed_files_added: ["added.ts"], changed_files_removed: ["removed.ts"], changed_files_persistent: ["z.ts"],
      validation_improved: ["added", "improved"], validation_regressed: ["regressed", "removed"],
      validation_unchanged_passing: ["pass"], validation_unchanged_failing: ["fail"], validation_newly_run: ["added"], validation_no_longer_run: ["removed"], validation_skipped: ["skip"],
      quality_findings_added: 1, quality_findings_removed: 1, quality_finding_count_previous: 2, quality_finding_count_current: 2,
      quality_highest_severity_change: "improved",
    });
  });

  it.each([
    ["UNKNOWN", "UNKNOWN", "unchanged"],
    ["READY_FOR_REVIEW", "NEEDS_VALIDATION", "regressed"],
  ] as const)("classifies readiness %s to %s", (before, after, expected) => {
    const previous = fixture("1"); const current = fixture("2");
    previous.readiness = before; current.readiness = after;
    expect(compareRuns(previous, current).summary?.readiness_change).toBe(expected);
  });

  it("infers a legacy validation status from its exit code", () => {
    const previous = fixture("1"); const current = fixture("2");
    previous.validation.results = [{ ...result("test", "failed"), status: undefined } as unknown as ValidationResult];
    current.validation.results = [result("test", "passed")];
    expect(compareRuns(previous, current).summary?.validation_improved).toEqual(["test"]);
  });

  it("skips an invalid newest record and selects the most recent valid record", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-selection-"));
    try {
      const older = fixture("1");
      await mkdir(path.join(root, ".relaypoint", "runs", "2026-06-21T10-00-00-000Z"), { recursive: true });
      await writeFile(path.join(root, ".relaypoint", "runs", "2026-06-21T10-00-00-000Z", "RUN_RECORD.json"), JSON.stringify(older));
      await mkdir(path.join(root, ".relaypoint", "runs", "2026-06-21T11-00-00-000Z"), { recursive: true });
      await writeFile(path.join(root, ".relaypoint", "runs", "2026-06-21T11-00-00-000Z", "RUN_RECORD.json"), '{"run_id":"invalid"}');
      expect((await findPreviousRun(root))?.run_id).toBe("1");
      expect(await findPreviousRun(root, "2026-06-21T10-00-00-000Z")).toBeNull();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
