import { describe, expect, it } from "vitest";
import { determineReadiness, generateRiskFlags } from "../src/riskFlags.js";
import type { DetectedProject } from "../src/types.js";

const project: DetectedProject = { type: "node", package_manager: "npm", scripts: { test: "vitest" }, validation_suggestions: [] };

describe("risk flags", () => {
  it("flags deterministic changes and missing validation", () => {
    const flags = generateRiskFlags({ isGitRepo: true, workingTreeClean: false, changedFiles: [{ path: "src/a.ts", status: " M", category: "source" }, { path: "package.json", status: " M", category: "config" }], project, discovered: ["npm run test"], requested: [], results: [] });
    expect(flags).toEqual(expect.arrayContaining(["DIRTY_WORKING_TREE", "SOURCE_CHANGED_WITHOUT_TESTS", "CONFIG_CHANGED", "VALIDATION_NOT_RUN"]));
    expect(determineReadiness(flags, [])).toBe("NEEDS_VALIDATION");
  });

  it("makes failed validation highest priority", () => {
    const failed = { script: "test", command: "npm run test", status: "failed" as const, exit_code: 1, duration_ms: 1, stdout_preview: "", stderr_preview: "failure" };
    expect(determineReadiness(["VALIDATION_FAILED"], [failed])).toBe("HAS_FAILURES");
  });

  it("reports ready only when validation ran without failures or skips", () => {
    const passed = { script: "test", command: "npm run test", status: "passed" as const, exit_code: 0, duration_ms: 1, stdout_preview: "", stderr_preview: "" };
    expect(determineReadiness([], [passed])).toBe("READY_FOR_REVIEW");
    expect(determineReadiness([], [{ ...passed, status: "skipped", exit_code: null }])).toBe("NEEDS_VALIDATION");
  });
});
