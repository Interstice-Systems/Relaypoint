import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_WARNINGS,
  NO_HISTORY_MESSAGE,
  readHistory,
  renderHistory,
  renderHistoryWarnings,
  summarizeValidation,
} from "../src/history.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-history-"));
  roots.push(root);
  return root;
}

async function writeRun(root: string, directory: string, record: unknown): Promise<void> {
  const runDirectory = path.join(root, ".relaypoint", "runs", directory);
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, "RUN_RECORD.json"), JSON.stringify(record));
}

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: "run-1",
    created_at: "2026-06-28T18:00:00.000Z",
    repo: { name: "Relaypoint" },
    readiness: "NEEDS_VALIDATION",
    policy: { status: "WARN" },
    validation: { results: [] },
    quality_review: { finding_count: 2 },
    ...overrides,
  };
}

describe("project history", () => {
  it("handles missing runs without creating output", async () => {
    const root = await temporaryRoot();

    expect(await readHistory(root)).toEqual({ summary: null, warnings: [] });
    expect(NO_HISTORY_MESSAGE).toBe("No Relaypoint runs found. Run `relaypoint handoff` first.");
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("skips malformed, unreadable, and non-object records with concise warnings", async () => {
    const root = await temporaryRoot();
    const malformed = path.join(root, ".relaypoint", "runs", "bad-json");
    await mkdir(malformed, { recursive: true });
    await writeFile(path.join(malformed, "RUN_RECORD.json"), '{"run_id":');
    await mkdir(path.join(root, ".relaypoint", "runs", "missing-record"), { recursive: true });
    await writeRun(root, "not-object", []);
    await writeRun(root, "valid", record());

    const result = await readHistory(root);

    expect(result.summary?.totalRuns).toBe(1);
    expect(result.summary?.skippedRuns).toBe(3);
    expect(result.warnings).toEqual([
      "Skipped run bad-json: invalid JSON.",
      "Skipped run missing-record: file not found.",
      "Skipped run not-object: record is not a JSON object.",
    ]);
  });

  it("reads records and sorts by created_at, then run_id", async () => {
    const root = await temporaryRoot();
    const timestamp = "2026-06-28T19:00:00.000Z";
    await writeRun(root, "third", record({ run_id: "2026-06-28T19-00-00-000Z-010", created_at: timestamp }));
    await writeRun(root, "first", record({ run_id: "2026-06-28T18-00-00-000Z", created_at: "2026-06-28T18:00:00.000Z" }));
    await writeRun(root, "second", record({ run_id: "2026-06-28T19-00-00-000Z-002", created_at: timestamp }));

    const result = await readHistory(root);

    expect(result.summary?.timeline.map((run) => run.runId)).toEqual([
      "2026-06-28T19-00-00-000Z-010",
      "2026-06-28T19-00-00-000Z-002",
      "2026-06-28T18-00-00-000Z",
    ]);
    expect(result.summary?.latest.runId).toBe("2026-06-28T19-00-00-000Z-010");
  });

  it("uses the default timeline limit and supports an explicit limit", async () => {
    const root = await temporaryRoot();
    for (let index = 0; index < 12; index += 1) {
      const suffix = String(index).padStart(2, "0");
      await writeRun(root, `run-${suffix}`, record({
        run_id: `run-${suffix}`,
        created_at: `2026-06-28T18:${suffix}:00.000Z`,
      }));
    }

    const defaultResult = await readHistory(root);
    const limitedResult = await readHistory(root, 5);

    expect(DEFAULT_HISTORY_LIMIT).toBe(10);
    expect(defaultResult.summary?.totalRuns).toBe(12);
    expect(defaultResult.summary?.timeline).toHaveLength(10);
    expect(limitedResult.summary?.timeline).toHaveLength(5);
  });

  it("summarizes readiness, policy, validation, quality, and movement", async () => {
    const root = await temporaryRoot();
    await writeRun(root, "one", record({
      run_id: "one",
      created_at: "2026-06-28T18:00:00.000Z",
      readiness: "HAS_FAILURES",
      policy: { status: "BLOCKED" },
      validation: { results: [{ status: "failed", exit_code: 1 }] },
      quality_review: { finding_count: 7 },
    }));
    await writeRun(root, "two", record({
      run_id: "two",
      created_at: "2026-06-28T19:00:00.000Z",
      readiness: "READY_FOR_REVIEW",
      policy: { status: "PASS" },
      validation: { results: [{ status: "passed", exit_code: 0 }] },
      quality_review: { finding_count: 3 },
    }));
    await writeRun(root, "three", record({
      run_id: "three",
      created_at: "2026-06-28T20:00:00.000Z",
      readiness: "NEEDS_VALIDATION",
      policy: { status: "WARN" },
      validation: { results: [{ status: "passed" }, { status: "failed" }] },
      quality_review: { finding_count: 5 },
    }));
    await writeRun(root, "four", record({
      run_id: "four",
      created_at: "2026-06-28T21:00:00.000Z",
      readiness: "UNKNOWN",
      policy: { status: "legacy-value" },
      validation: { results: [{ status: "skipped" }] },
      quality_review: {},
    }));

    const result = await readHistory(root);
    const summary = result.summary!;
    const output = renderHistory(summary);

    expect(summary.readinessCounts).toEqual({
      READY_FOR_REVIEW: 1,
      NEEDS_VALIDATION: 1,
      HAS_FAILURES: 1,
      UNKNOWN: 1,
    });
    expect(summary.policyCounts).toEqual({ BLOCKED: 1, PASS: 1, WARN: 1, UNKNOWN: 1 });
    expect(summary.validationCounts).toEqual({ PASS: 1, FAIL: 1, MIXED: 1, NOT_RUN: 1 });
    expect(summary.averageQualityFindings).toBe(5);
    expect(summary.readinessImproved).toBe(1);
    expect(summary.readinessRegressed).toBe(2);
    expect(output).toContain("Average quality findings: 5.0");
    expect(output).toContain("Validation: PASS 1, FAIL 1, MIXED 1, NOT_RUN 1");
    expect(output.toLowerCase()).not.toContain("next agent");
    expect(output.toLowerCase()).not.toContain("next task");
  });

  it("bounds warning output while preserving the full warning count", () => {
    const warnings = Array.from({ length: 12 }, (_, index) => `Skipped run invalid-${index}: invalid JSON.`);
    const rendered = renderHistoryWarnings(warnings);

    expect(MAX_HISTORY_WARNINGS).toBe(10);
    expect(rendered).toHaveLength(11);
    expect(rendered.at(-1)).toBe("2 additional invalid run records were skipped.");
  });

  it("classifies validation only from recorded evidence", () => {
    expect(summarizeValidation(undefined)).toBe("NOT_RUN");
    expect(summarizeValidation({ results: [] })).toBe("NOT_RUN");
    expect(summarizeValidation({ results: [{ status: "skipped" }, { exit_code: null }] })).toBe("NOT_RUN");
    expect(summarizeValidation({ results: [{ exit_code: 0 }] })).toBe("PASS");
    expect(summarizeValidation({ results: [{ exit_code: 1 }] })).toBe("FAIL");
    expect(summarizeValidation({ results: [{ status: "passed" }, { status: "failed" }] })).toBe("MIXED");
  });

  it("handles partial older records without modifying run evidence", async () => {
    const root = await temporaryRoot();
    await writeRun(root, "legacy-run", {
      repo: { name: "legacy-project" },
      validation: { results: [{ command: "npm test", exit_code: 0 }] },
    });
    const runsDirectory = path.join(root, ".relaypoint", "runs");
    const recordPath = path.join(runsDirectory, "legacy-run", "RUN_RECORD.json");
    const latestPath = path.join(root, ".relaypoint", "latest", "sentinel.txt");
    await mkdir(path.dirname(latestPath), { recursive: true });
    await writeFile(latestPath, "unchanged");
    const before = await readdir(runsDirectory, { recursive: true });
    const recordBefore = await readFile(recordPath, "utf8");

    const result = await readHistory(root);

    expect(result.summary?.latest).toMatchObject({
      runId: "legacy-run",
      project: "legacy-project",
      policyStatus: "unavailable",
      validationStatus: "PASS",
    });
    expect(result.summary?.latest.createdAt).toBeUndefined();
    expect(result.summary?.latest.qualityFindings).toBeUndefined();
    expect(result.summary?.unavailableReadiness).toBe(1);
    expect(await readdir(runsDirectory, { recursive: true })).toEqual(before);
    expect(await readFile(recordPath, "utf8")).toBe(recordBefore);
    expect(await readFile(latestPath, "utf8")).toBe("unchanged");
  });

  it("reads recognized fields from unknown newer schemas", async () => {
    const root = await temporaryRoot();
    await writeRun(root, "future-run", record({
      schema_version: "99.0.0",
      run_id: "future-run",
      future_evidence: { ignored: true },
    }));

    const result = await readHistory(root);

    expect(result.warnings).toEqual([]);
    expect(result.summary?.latest).toMatchObject({
      runId: "future-run",
      readiness: "NEEDS_VALIDATION",
      policyStatus: "WARN",
    });
  });
});
