import { describe, expect, it } from "vitest";
import { renderAgentHandoff, renderHandoff, renderQaReport, renderQualityReview, renderRunComparison } from "../src/renderMarkdown.js";
import { createRunRecord } from "../src/runRecord.js";
import { compareRuns } from "../src/runComparison.js";
import { mockGit, mockProject } from "./runRecord.test.js";

const record = createRunRecord({ runId: "2026-06-21T00-00-00Z", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });

describe("Markdown rendering", () => {
  it("includes the final run ID and creation timestamp in every report", () => {
    const reports = [
      renderHandoff(record),
      renderQaReport(record),
      renderAgentHandoff(record),
      renderQualityReview(record),
      renderRunComparison(record),
    ];
    for (const report of reports) {
      expect(report).toContain(`Run ID: ${record.run_id}`);
      expect(report).toContain(`Created at: ${record.created_at}`);
    }
  });

  it("renders key handoff and QA sections", () => {
    expect(renderHandoff(record)).toContain("## Review Focus");
    expect(renderHandoff(record)).toContain("No project profile found");
    expect(renderHandoff(record)).not.toContain("## Suggested Review Focus");
    expect(renderQaReport(record)).toContain("## Validation Commands Run");
    expect(renderQaReport(record)).toContain("### Profile warnings");
    expect(renderQaReport(record)).toContain("## Evidence Gaps");
  });

  it("renders safe continuation context without speculative task language", () => {
    const output = renderAgentHandoff(record);
    expect(output).toContain("continuation context");
    expect(output).toContain("## Validation Evidence");
    expect(output).toContain("## Risk Flags");
    expect(output).toContain("## Review Focus");
    expect(output).toContain("## Do Not Assume");
    expect(output).toContain("### Commands Run");
    expect(output).toContain("Record results for discovered validation: npm run test.");
    expect(output.toLowerCase()).not.toContain("suggested next task");
  });

  it("is deterministic for fixed input", () => expect(renderAgentHandoff(record)).toBe(renderAgentHandoff(record)));

  it("renders deterministic quality findings grouped by severity", () => {
    const qualityRecord = createRunRecord({ runId: "fixed", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [], qualityReview: { enabled: true, mode: "heuristic", filesReviewed: 1, findingCount: 1, highestSeverity: "medium", findings: [{ file: "src/index.ts", category: "review-marker", severity: "medium", message: "A marker may deserve review.", evidence: "TODO at line 4", reviewFocus: "Confirm the marker is current." }] } });
    const output = renderQualityReview(qualityRecord);
    expect(output).toBe(renderQualityReview(qualityRecord));
    expect(output).toContain("### medium");
    expect(output).toContain("TODO at line 4");
    expect(output).toContain("findings are review targets, not proof of defects");
  });

  it("renders evidence-only comparison output", () => {
    const output = renderRunComparison(record);
    expect(output).toContain("# Run Comparison");
    expect(output).toContain("recorded evidence only");
    expect(output).toContain("matches exact recorded keys deterministically");
    expect(output.toLowerCase()).not.toContain("next agent should");
  });

  it("distinguishes disabled comparison from unavailable comparison", () => {
    const disabled = createRunRecord({ runId: "disabled", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [], comparison: { enabled: false, available: false, reason: "Comparison disabled by --no-compare." } });
    expect(renderRunComparison(disabled)).toContain("Comparison status: disabled");
  });

  it("caps long comparison lists and points to the full JSON evidence", () => {
    const previous = createRunRecord({ runId: "previous", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });
    const current = createRunRecord({ runId: "current", createdAt: "2026-06-21T00:01:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });
    current.changed_files = Array.from({ length: 12 }, (_, index) => ({ path: `file-${String(index).padStart(2, "0")}.ts`, status: " M", category: "source" }));
    current.comparison = compareRuns(previous, current);
    const output = renderRunComparison(current);
    expect(output).toContain("2 more; see `RUN_RECORD.json` for full comparison evidence.");
    expect(output).not.toContain("`file-11.ts`");
  });
});
