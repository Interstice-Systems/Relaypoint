import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ChangedFile,
  LoadedPolicyRules,
  PolicyFinding,
  PolicyRecord,
  PolicyRule,
  PolicySeverity,
  ProjectProfileRecord,
  QualityReview,
  RuleTrigger,
  ValidationResult,
} from "./types.js";

export const RULES_PATH = ".relaypoint/rules.json" as const;
export const SUPPORTED_RULE_TRIGGERS: RuleTrigger[] = [
  "source_changed_without_tests",
  "validation_failed",
  "validation_not_run",
  "critical_path_changed_without_validation",
  "lockfile_changed",
  "config_changed",
  "high_quality_findings",
  "todo_markers_found",
  "large_changeset",
  "preferred_validation_not_run",
];

export const STARTER_RULES: { schema_version: "0.5.0"; rules: PolicyRule[] } = {
  schema_version: "0.5.0",
  rules: [
    {
      id: "source_requires_tests",
      enabled: true,
      severity: "warning",
      description: "Source changes should usually include test changes or validation evidence.",
      when: "source_changed_without_tests",
    },
    {
      id: "validation_failures_block_review",
      enabled: true,
      severity: "blocking",
      description: "Validation failures should be resolved or explicitly reviewed before completion.",
      when: "validation_failed",
    },
    {
      id: "critical_paths_require_validation",
      enabled: true,
      severity: "warning",
      description: "Critical path changes should be validated before review.",
      when: "critical_path_changed_without_validation",
    },
    {
      id: "lockfile_requires_review",
      enabled: true,
      severity: "info",
      description: "Lockfile changes should be reviewed for dependency drift.",
      when: "lockfile_changed",
    },
  ],
};

const severities = new Set<PolicySeverity>(["blocking", "warning", "info"]);
const triggers = new Set<RuleTrigger>(SUPPORTED_RULE_TRIGGERS);

function defaults(warnings: string[] = []): LoadedPolicyRules {
  return { enabled: true, path: RULES_PATH, loaded: false, usingDefaults: true, rules: structuredClone(STARTER_RULES.rules), warnings };
}

export async function initializeRulePack(cwd: string): Promise<string> {
  const target = path.join(path.resolve(cwd), RULES_PATH);
  try { await readFile(target, "utf8"); throw new Error(`Rules file already exists: ${target}`); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(STARTER_RULES, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return target;
}

export async function loadPolicyRules(repoRoot: string): Promise<LoadedPolicyRules> {
  const target = path.join(repoRoot, RULES_PATH);
  let raw: string;
  try { raw = await readFile(target, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults();
    return defaults(["Rules file could not be read. Built-in default rules were used."]);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return defaults(["Rules file could not be parsed. Built-in default rules were used."]); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults(["Rules file must be a JSON object. Built-in default rules were used."]);
  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.rules)) return defaults(["Rules file rules must be an array. Built-in default rules were used."]);

  const warnings: string[] = [];
  if (value.schema_version !== "0.5.0") warnings.push(`Rules file schema_version '${String(value.schema_version)}' differs from expected 0.5.0.`);
  const rules: PolicyRule[] = [];
  const ids = new Set<string>();
  value.rules.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      warnings.push(`Rule at index ${index} is malformed and was skipped.`);
      return;
    }
    const rule = candidate as Record<string, unknown>;
    if (typeof rule.id !== "string" || !rule.id.trim()) {
      warnings.push(`Rule at index ${index} has an invalid id and was skipped.`);
      return;
    }
    const id = rule.id.trim();
    if (ids.has(id)) {
      warnings.push(`Rule '${id}' has a duplicate id and was skipped.`);
      return;
    }
    if (typeof rule.enabled !== "boolean" || !severities.has(rule.severity as PolicySeverity) || typeof rule.description !== "string" || !rule.description.trim()) {
      warnings.push(`Rule '${id}' is malformed and was skipped.`);
      return;
    }
    if (!triggers.has(rule.when as RuleTrigger)) {
      warnings.push(`Rule '${id}' uses unsupported trigger '${String(rule.when)}' and was skipped.`);
      return;
    }
    ids.add(id);
    if (!rule.enabled) warnings.push(`Rule '${id}' is disabled and was skipped.`);
    rules.push({ id, enabled: rule.enabled, severity: rule.severity as PolicySeverity, description: rule.description.trim(), when: rule.when as RuleTrigger });
  });
  return { enabled: true, path: RULES_PATH, loaded: true, usingDefaults: false, rules, warnings };
}

interface PolicyEvidence {
  changedFiles: ChangedFile[];
  results: ValidationResult[];
  projectProfile: ProjectProfileRecord;
  qualityReview: QualityReview;
}

function findingFor(rule: PolicyRule, input: PolicyEvidence): PolicyFinding | null {
  const files = (category: ChangedFile["category"]): string[] => input.changedFiles.filter((file) => file.category === category).map((file) => file.path);
  const commandsRun = input.results.filter((result) => result.status !== "skipped").map((result) => result.command);
  const failed = input.results.filter((result) => result.status === "failed").map((result) => result.command);
  const critical = input.projectProfile.critical_paths_matched ?? [];
  const preferred = input.projectProfile.preferred_validation ?? [];
  const preferredMissing = preferred.filter((command) => !commandsRun.includes(command));
  const high = input.qualityReview.findings.filter((item) => item.severity === "high");
  const markers = input.qualityReview.findings.filter((item) => item.category === "review-marker");
  let evidence: string | null = null;
  let reviewFocus = "";
  switch (rule.when) {
    case "source_changed_without_tests":
      if (files("source").length && !files("test").length) {
        evidence = `Changed source without changed tests: ${files("source").join(", ")}`;
        reviewFocus = "Review whether source changes have sufficient test or validation evidence.";
      }
      break;
    case "validation_failed":
      if (failed.length) {
        evidence = `Failed validation: ${failed.join(", ")}`;
        reviewFocus = "Review failed validation evidence before completion.";
      }
      break;
    case "validation_not_run":
      if (!commandsRun.length) {
        evidence = "No validation commands were run.";
        reviewFocus = "Determine whether applicable validation evidence is required before review.";
      }
      break;
    case "critical_path_changed_without_validation":
      if (critical.length && !commandsRun.length) {
        evidence = `Changed critical paths without validation: ${critical.join(", ")}`;
        reviewFocus = "Review critical path changes and record applicable validation evidence.";
      }
      break;
    case "lockfile_changed":
      if (files("lockfile").length) {
        evidence = `Changed lockfile: ${files("lockfile").join(", ")}`;
        reviewFocus = "Review dependency changes before committing.";
      }
      break;
    case "config_changed":
      if (files("config").length) {
        evidence = `Changed configuration: ${files("config").join(", ")}`;
        reviewFocus = "Review configuration changes for repository-wide effects.";
      }
      break;
    case "high_quality_findings":
      if (high.length) {
        evidence = `High-severity quality findings: ${high.map((item) => `${item.file} (${item.category})`).join(", ")}`;
        reviewFocus = "Review high-severity deterministic quality findings in context.";
      }
      break;
    case "todo_markers_found":
      if (markers.length) {
        evidence = `Review markers found: ${markers.map((item) => `${item.file}: ${item.evidence}`).join("; ")}`;
        reviewFocus = "Confirm each TODO, FIXME, or HACK marker is intentional and current.";
      }
      break;
    case "large_changeset":
      if (input.changedFiles.length >= 20) {
        evidence = `Changed files: ${input.changedFiles.length} (large changeset threshold: 20)`;
        reviewFocus = "Review the changeset in smaller logical groups where practical.";
      }
      break;
    case "preferred_validation_not_run":
      if (preferredMissing.length) {
        evidence = `Preferred validation not run: ${preferredMissing.join(", ")}`;
        reviewFocus = "Review whether the project's preferred validation commands should be run.";
      }
      break;
  }
  return evidence ? { ruleId: rule.id, severity: rule.severity, description: rule.description, evidence, reviewFocus } : null;
}

export function evaluatePolicy(loaded: LoadedPolicyRules, input: PolicyEvidence): PolicyRecord {
  const evaluated = loaded.rules.filter((rule) => rule.enabled);
  const findings = evaluated.map((rule) => findingFor(rule, input)).filter((finding): finding is PolicyFinding => Boolean(finding));
  const status = !evaluated.length ? "UNKNOWN" : findings.some((finding) => finding.severity === "blocking") ? "BLOCKED" : findings.length ? "WARN" : "PASS";
  return {
    enabled: true,
    rules_path: loaded.loaded ? loaded.path : null,
    loaded: loaded.loaded,
    using_defaults: loaded.usingDefaults,
    rules_loaded: loaded.rules.length,
    rules_evaluated: evaluated.length,
    rules_triggered: findings.length,
    status,
    findings: findings.map(({ ruleId, reviewFocus, ...finding }) => ({ rule_id: ruleId, ...finding, review_focus: reviewFocus })),
    warnings: loaded.warnings,
  };
}
