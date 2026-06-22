import type { ChangedFile, RunRecord, ValidationResult } from "./types.js";

function list(items: string[], empty = "None recorded."): string { return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`; }
function changed(files: ChangedFile[]): string { return list(files.map((file) => `\`${file.path}\` (${file.status.trim() || "modified"}, ${file.category})`), "No changed files detected."); }
function validations(results: ValidationResult[]): string {
  return results.length ? results.map((result) => {
    const detail = result.reason ? ` — ${result.reason}` : ` — exit ${result.exit_code ?? "unknown"}, ${result.duration_ms}ms`;
    const stdout = result.stdout_preview.trim() ? `\n  - stdout: ${JSON.stringify(result.stdout_preview.trim().slice(0, 500))}` : "";
    const stderr = result.stderr_preview.trim() ? `\n  - stderr: ${JSON.stringify(result.stderr_preview.trim().slice(0, 500))}` : "";
    return `- \`${result.command}\`: **${result.status.toUpperCase()}**${detail}${stdout}${stderr}`;
  }).join("\n") : "- No validation commands were run.";
}
function reviewFocus(record: RunRecord): string[] {
  const map: Record<string, string> = {
    SOURCE_CHANGED_WITHOUT_TESTS: "Review source changes that have no corresponding changed tests.", VALIDATION_NOT_RUN: "Validation remains unverified; do not infer passing results.",
    VALIDATION_FAILED: "Inspect failed validation output and affected files.", CONFIG_CHANGED: "Review configuration changes for repository-wide effects.",
    LOCKFILE_CHANGED: "Confirm lockfile changes are intentional and reproducible.", LARGE_CHANGESET: "Review the large changeset in smaller logical groups.",
    GENERATED_FILES_CHANGED: "Confirm generated files are expected and reproducible.", UNKNOWN_PROJECT_TYPE: "Confirm the project type and appropriate validation process.",
  };
  return record.risk_flags.map((flag) => map[flag]).filter((value): value is string => Boolean(value));
}

function evidenceNeeded(record: RunRecord): string[] {
  const evidence: string[] = [];
  if (record.risk_flags.includes("VALIDATION_NOT_RUN")) {
    if (record.validation.commands_discovered.length) evidence.push(`Record results for discovered validation: ${record.validation.commands_discovered.join(", ")}.`);
    else evidence.push("Identify and record the repository's applicable validation commands.");
  }
  for (const result of record.validation.results) {
    if (result.status === "failed") evidence.push(`Resolve or explain the failed validation: ${result.command}.`);
    if (result.status === "skipped") evidence.push(`Provide valid evidence for the skipped request: ${result.command}.`);
  }
  if (record.risk_flags.includes("SOURCE_CHANGED_WITHOUT_TESTS")) evidence.push("Review whether changed source requires corresponding test coverage.");
  return evidence;
}

export function renderHandoff(record: RunRecord): string {
  const groups = [...new Set(record.changed_files.map((file) => file.category))];
  return `# Relaypoint Handoff\n\n## Current State\n\n- Repository: ${record.repo.name}\n- Created at: ${record.created_at}\n- Branch: ${record.repo.branch ?? "unavailable"}\n- Commit: ${record.repo.commit ?? "unavailable"}\n- Working tree: ${record.repo.working_tree_clean ? "clean" : "dirty"}\n- Project type: ${record.detected_project.type}\n\n## What Changed\n\nRelaypoint detected changes in the following areas:\n\n${list(groups)}\n\nReview the file list below and compare it against the intended task. Relaypoint records evidence; it does not infer intent or correctness.\n\n## Changed Files\n\n${changed(record.changed_files)}\n\n## Recent Commits\n\n${list(record.recent_commits.map((commit) => `\`${commit.hash}\` ${commit.subject} — ${commit.author}, ${commit.date}`), "No recent commits available.")}\n\n## Important Files Touched\n\n${list(record.changed_files.filter((file) => ["source", "test", "config", "lockfile"].includes(file.category)).map((file) => `\`${file.path}\` (${file.category})`), "No important files identified by deterministic classification.")}\n\n## Known Open Questions\n\n- Does the changeset match the intended task?\n- Are unvalidated paths covered by manual review?\n- Are configuration, lockfile, or generated changes intentional?\n\n## Review Focus\n\n${list(reviewFocus(record), "Review the changed files and recorded validation evidence.")}\n`;
}

export function renderQaReport(record: RunRecord): string {
  const skipped = record.validation.results.filter((result) => result.status === "skipped").map((result) => `${result.command}: ${result.reason ?? "skipped"}`);
  const manual = record.changed_files.filter((file) => ["source", "config", "lockfile", "generated", "unknown"].includes(file.category)).map((file) => `\`${file.path}\` (${file.category})`);
  const testsAffected = record.changed_files.some((file) => file.category === "test") ? "Changed test files should be reviewed alongside affected source code." : "No changed test files were detected; source changes may require coverage review.";
  return `# QA Report\n\n## Overall Readiness\n\n**${record.readiness}**\n\nThis status summarizes recorded evidence and is not a correctness guarantee.\n\n## Validation Commands Discovered\n\n${list(record.validation.commands_discovered)}\n\n## Validation Commands Requested\n\n${list(record.validation.commands_requested)}\n\n## Validation Commands Run\n\n${list(record.validation.commands_run)}\n\n## Validation Results\n\n${validations(record.validation.results)}\n\n## Skipped Validation Commands\n\n${list(skipped)}\n\n## Evidence Gaps\n\n${list(evidenceNeeded(record), "No missing automated validation evidence detected. Human review is still required.")}\n\n## Tests Likely Affected\n\n${testsAffected}\n\n## Files Requiring Manual Review\n\n${list(manual)}\n\n## Risk Flags\n\n${list(record.risk_flags)}\n\n## Recommended QA Checklist\n\n- Confirm the changeset matches the intended task.\n- Review source, test, configuration, lockfile, and generated changes.\n- Verify each required validation result is recorded and passing.\n- Reproduce relevant validation in the target environment.\n- Perform manual checks for behavior not covered by automated validation.\n`;
}

export function renderAgentHandoff(record: RunRecord): string {
  const categories = ["source", "test", "docs", "config", "lockfile", "generated", "unknown"] as const;
  const grouped = categories.map((category) => `### ${category}\n\n${list(record.changed_files.filter((file) => file.category === category).map((file) => `\`${file.path}\` (${file.status.trim() || "modified"})`))}`).join("\n\n");
  const missing = evidenceNeeded(record);
  return `# Agent Handoff\n\nThis file provides continuation context for the current repository state after an AI-assisted development session.\n\nIt is not an instruction to continue automatically. It does not decide the next task. It preserves evidence so a human developer or future agent can make an informed decision.\n\n## Current State\n\n- Repository: ${record.repo.name}\n- Branch: ${record.repo.branch ?? "unavailable"}\n- Commit: ${record.repo.commit ?? "unavailable"}\n- Working tree: ${record.repo.working_tree_clean ? "clean" : "dirty"}\n- Created at: ${record.created_at}\n\n## Changed Files\n\n${grouped}\n\n## Validation Evidence\n\n### Discovered\n\n${list(record.validation.commands_discovered)}\n\n### Requested\n\n${list(record.validation.commands_requested)}\n\n### Commands Run\n\n${list(record.validation.commands_run)}\n\n### Results\n\n${validations(record.validation.results)}\n\n## Risk Flags\n\n${list(record.risk_flags)}\n\n## Review Focus\n\n${list(reviewFocus(record), "Review changed files and confirm the recorded evidence is sufficient.")}\n\n## Do Not Assume\n\n- Do not assume tests passed unless evidence is shown.\n- Do not assume validation was run unless recorded.\n- Do not assume the implementation is complete.\n- Do not assume generated files are safe to commit.\n- Do not overwrite unrelated files.\n- Do not expand scope without documenting why.\n\n## Evidence Needed Before Claiming Completion\n\n${list(missing, "No missing automated validation evidence detected. Human review is still required.")}\n`;
}

export function renderQualityReview(record: RunRecord): string {
  const review = record.quality_review;
  const grouped = (["high", "medium", "low"] as const).flatMap((severity) => {
    const findings = review.findings.filter((item) => item.severity === severity);
    if (!findings.length) return [];
    const rendered = findings.map((item) => `#### \`${item.file}\` — ${item.category}\n\n- Severity: ${item.severity}\n- Message: ${item.message}\n- Evidence: ${item.evidence}\n- Review focus: ${item.review_focus}`).join("\n\n");
    return [`### ${severity}\n\n${rendered}`];
  }).join("\n\n");
  const status = review.finding_count ? "Review targets identified" : "No heuristic findings identified";
  return `# Quality Review\n\nThis report uses deterministic heuristics to highlight files and patterns that may deserve simplification or closer human review.\n\nIt does not prove correctness.\nIt does not replace human review.\nIt does not automatically rewrite code or text.\n\n## Summary\n\n- Files reviewed: ${review.files_reviewed}\n- Findings: ${review.finding_count}\n- Highest severity: ${review.highest_severity ?? "none"}\n- Review status: ${status}\n\n## Heuristic Findings\n\n${grouped || "- No heuristic findings."}\n\n## Code Simplicity Signals\n\nThe deterministic review checks changed source files for file size, long functions, approximate nesting depth, repeated long lines, review markers, broad helper modules, large export surfaces, repeated \`any\`, and repeated console logging.\n\n## Text / Documentation Signals\n\nThe deterministic review checks changed text files for long sections, repeated headings, repeated long lines, dense bullet sequences, repeated phrases, and excess blank space.\n\n## Review Guidance\n\nThese findings are review targets, not proof of defects. A finding indicates that a pattern crossed a fixed threshold and may deserve closer human review. Context, intent, validation evidence, and human judgment remain authoritative.\n`;
}
