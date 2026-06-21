import type { ChangedFile, DetectedProject, Readiness, ValidationResult } from "./types.js";

export function generateRiskFlags(input: { isGitRepo: boolean; workingTreeClean: boolean; changedFiles: ChangedFile[]; project: DetectedProject; discovered: string[]; requested: string[]; results: ValidationResult[] }): string[] {
  const { changedFiles: files } = input;
  const categories = new Set(files.map((file) => file.category));
  const flags: string[] = [];
  if (!input.isGitRepo) flags.push("NOT_A_GIT_REPO");
  if (input.isGitRepo && !input.workingTreeClean) flags.push("DIRTY_WORKING_TREE");
  if (input.discovered.length === 0) flags.push("NO_VALIDATION_COMMAND_FOUND");
  if (categories.has("source") && !categories.has("test")) flags.push("SOURCE_CHANGED_WITHOUT_TESTS");
  if (categories.has("test")) flags.push("TEST_FILES_CHANGED");
  if (categories.has("config")) flags.push("CONFIG_CHANGED");
  if (categories.has("lockfile")) flags.push("LOCKFILE_CHANGED");
  if (categories.has("docs")) flags.push("DOCS_CHANGED");
  if (files.length >= 20) flags.push("LARGE_CHANGESET");
  if (categories.has("generated")) flags.push("GENERATED_FILES_CHANGED");
  if (input.results.some((result) => result.status === "failed")) flags.push("VALIDATION_FAILED");
  if (input.results.filter((result) => result.status !== "skipped").length === 0) flags.push("VALIDATION_NOT_RUN");
  if (input.project.type === "unknown") flags.push("UNKNOWN_PROJECT_TYPE");
  return flags;
}

export function determineReadiness(flags: string[], results: ValidationResult[]): Readiness {
  if (flags.includes("VALIDATION_FAILED")) return "HAS_FAILURES";
  if (flags.includes("NOT_A_GIT_REPO") || flags.includes("UNKNOWN_PROJECT_TYPE")) return "UNKNOWN";
  if (flags.includes("VALIDATION_NOT_RUN") || results.some((result) => result.status === "skipped")) return "NEEDS_VALIDATION";
  return "READY_FOR_REVIEW";
}
