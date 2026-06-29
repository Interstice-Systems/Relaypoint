import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeRelaypoint } from "../src/initialize.js";
import { evaluatePolicy, initializeRulePack, loadPolicyRules, RULES_PATH, STARTER_RULES } from "../src/policyRules.js";
import type { LoadedPolicyRules, PolicyRule, ProjectProfileRecord, QualityReview, ValidationResult } from "../src/types.js";

const roots: string[] = [];
async function root(): Promise<string> { const value = await mkdtemp(path.join(os.tmpdir(), "relaypoint-policy-")); roots.push(value); return value; }
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });

const profile: ProjectProfileRecord = { enabled: true, loaded: false, path: ".relaypoint/project_profile.json", warnings: [] };
const quality: QualityReview = { enabled: true, mode: "heuristic", filesReviewed: 0, findingCount: 0, highestSeverity: null, findings: [] };
const passed: ValidationResult = { script: "test", command: "npm run test", status: "passed", exit_code: 0, duration_ms: 1, stdout_preview: "", stderr_preview: "" };

function loaded(rules: PolicyRule[]): LoadedPolicyRules {
  return { enabled: true, path: RULES_PATH, loaded: true, usingDefaults: false, rules, warnings: [] };
}
function rule(when: PolicyRule["when"], severity: PolicyRule["severity"] = "warning"): PolicyRule {
  return { id: when, enabled: true, severity, description: `Check ${when}.`, when };
}
function evaluate(when: PolicyRule["when"], overrides: Partial<Parameters<typeof evaluatePolicy>[1]> = {}, severity: PolicyRule["severity"] = "warning") {
  return evaluatePolicy(loaded([rule(when, severity)]), {
    changedFiles: [], results: [passed], projectProfile: profile, qualityReview: quality, ...overrides,
  });
}

describe("policy rule loading and initialization", () => {
  it("uses built-in defaults when the rules file is missing", async () => {
    const result = await loadPolicyRules(await root());
    expect(result).toMatchObject({ loaded: false, usingDefaults: true, rules: STARTER_RULES.rules, warnings: [] });
  });

  it("falls back to defaults for malformed files and skips unsupported or disabled rules with warnings", async () => {
    const cwd = await root();
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, RULES_PATH), "{bad json", "utf8");
    const malformed = await loadPolicyRules(cwd);
    expect(malformed).toMatchObject({ loaded: false, usingDefaults: true });
    expect(malformed.warnings[0]).toContain("could not be parsed");

    await writeFile(path.join(cwd, RULES_PATH), JSON.stringify({
      schema_version: "0.5.0",
      rules: [
        { id: "unsupported", enabled: true, severity: "warning", description: "Unsupported.", when: "semantic_guess" },
        { id: "disabled", enabled: false, severity: "info", description: "Disabled.", when: "config_changed" },
      ],
    }), "utf8");
    const partial = await loadPolicyRules(cwd);
    expect(partial.rules).toHaveLength(1);
    expect(partial.warnings.join(" ")).toContain("unsupported trigger");
    expect(partial.warnings.join(" ")).toContain("disabled and was skipped");
    expect(evaluatePolicy(partial, { changedFiles: [], results: [], projectProfile: profile, qualityReview: quality }).status).toBe("UNKNOWN");
  });

  it("creates starter rules and init preserves existing files while creating missing ones", async () => {
    const cwd = await root();
    const target = await initializeRulePack(cwd);
    expect(JSON.parse(await readFile(target, "utf8"))).toEqual(STARTER_RULES);
    const custom = '{"custom":true}\n';
    await writeFile(target, custom, "utf8");
    const first = await initializeRelaypoint(cwd);
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "project profile", created: true }),
      expect.objectContaining({ label: "rules file", created: false }),
    ]));
    expect(await readFile(target, "utf8")).toBe(custom);
    const second = await initializeRelaypoint(cwd);
    expect(second.every((item) => !item.created)).toBe(true);
    expect(await readFile(target, "utf8")).toBe(custom);
  });
});

describe("deterministic policy triggers", () => {
  it("evaluates changed-file triggers", () => {
    expect(evaluate("source_changed_without_tests", { changedFiles: [{ path: "src/a.ts", status: " M", category: "source" }] }).rules_triggered).toBe(1);
    expect(evaluate("source_changed_without_tests", { changedFiles: [{ path: "src/a.ts", status: " M", category: "source" }, { path: "tests/a.test.ts", status: " M", category: "test" }] }).status).toBe("PASS");
    expect(evaluate("lockfile_changed", { changedFiles: [{ path: "package-lock.json", status: " M", category: "lockfile" }] }).findings[0].evidence).toContain("package-lock.json");
    expect(evaluate("config_changed", { changedFiles: [{ path: "tsconfig.json", status: " M", category: "config" }] }).rules_triggered).toBe(1);
    expect(evaluate("large_changeset", { changedFiles: Array.from({ length: 20 }, (_, index) => ({ path: `${index}.ts`, status: " M", category: "source" as const })) }).rules_triggered).toBe(1);
  });

  it("evaluates validation and project-profile triggers", () => {
    const failed = { ...passed, status: "failed" as const, exit_code: 1 };
    expect(evaluate("validation_failed", { results: [failed] }, "blocking").status).toBe("BLOCKED");
    expect(evaluate("validation_not_run", { results: [] }).rules_triggered).toBe(1);
    expect(evaluate("critical_path_changed_without_validation", { results: [], projectProfile: { ...profile, critical_paths_matched: ["src/core.ts"] } }).rules_triggered).toBe(1);
    expect(evaluate("critical_path_changed_without_validation", { results: [passed], projectProfile: { ...profile, critical_paths_matched: ["src/core.ts"] } }).status).toBe("PASS");
    expect(evaluate("preferred_validation_not_run", { results: [], projectProfile: { ...profile, preferred_validation: ["npm run test", "npm run build"] } }).findings[0].evidence).toContain("npm run build");
    expect(evaluate("preferred_validation_not_run", { results: [passed], projectProfile: { ...profile, preferred_validation: ["npm run test"] } }).status).toBe("PASS");
  });

  it("evaluates quality evidence triggers and uses WARN for warning or info findings", () => {
    const high: QualityReview = { ...quality, filesReviewed: 1, findingCount: 1, highestSeverity: "high", findings: [{ file: "src/a.ts", category: "long-function", severity: "high", message: "Long.", evidence: "90 lines.", reviewFocus: "Review." }] };
    const marker: QualityReview = { ...quality, filesReviewed: 1, findingCount: 1, highestSeverity: "medium", findings: [{ file: "src/a.ts", category: "review-marker", severity: "medium", message: "Marker.", evidence: "TODO at line 2.", reviewFocus: "Review." }] };
    expect(evaluate("high_quality_findings", { qualityReview: high }).status).toBe("WARN");
    expect(evaluate("todo_markers_found", { qualityReview: marker }, "info").status).toBe("WARN");
    expect(evaluate("todo_markers_found", { qualityReview: quality }).status).toBe("PASS");
  });

  it("describes findings as review evidence without correctness claims", () => {
    const result = evaluate("validation_not_run", { results: [] });
    expect(JSON.stringify(result.findings).toLowerCase()).not.toContain("code is correct");
    expect(JSON.stringify(result.findings).toLowerCase()).not.toContain("guaranteed defect");
  });
});
