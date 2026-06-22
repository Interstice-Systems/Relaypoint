import { describe, expect, it } from "vitest";
import { renderAgentHandoff, renderHandoff, renderQaReport, renderQualityReview } from "../src/renderMarkdown.js";
import { createRunRecord } from "../src/runRecord.js";
import { mockGit, mockProject } from "./runRecord.test.js";

const record = createRunRecord({ runId: "2026-06-21T00-00-00Z", createdAt: "2026-06-21T00:00:00.000Z", git: mockGit, project: mockProject, requested: [], results: [] });

describe("Markdown rendering", () => {
  it("renders key handoff and QA sections", () => {
    expect(renderHandoff(record)).toContain("## Review Focus");
    expect(renderHandoff(record)).not.toContain("## Suggested Review Focus");
    expect(renderQaReport(record)).toContain("## Validation Commands Run");
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
});
