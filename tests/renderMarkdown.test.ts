import { describe, expect, it } from "vitest";
import { renderAgentHandoff, renderHandoff, renderQaReport } from "../src/renderMarkdown.js";
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
});
