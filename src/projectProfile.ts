import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChangedFile, DetectedProject, LoadedProjectProfile, ProjectProfile, ProjectProfileRecord } from "./types.js";

export const PROFILE_PATH = ".relaypoint/project_profile.json" as const;
export const STARTER_PROFILE: ProjectProfile = {
  schema_version: "0.3.0",
  project_name: "",
  description: "",
  critical_paths: [],
  ignored_paths: [],
  preferred_validation: [],
  review_focus: [],
  quality: { max_file_lines: null, max_function_lines: null, max_line_length: null, allow_todos: true },
  notes: [],
};

const normalizePath = (value: string): string => value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
const stringArray = (value: unknown): string[] | null => Array.isArray(value) && value.every((item) => typeof item === "string") ? value.map((item) => item.trim()).filter(Boolean) : null;
const optionalString = (value: unknown): value is string => typeof value === "string";
const threshold = (value: unknown): number | null | undefined => value === null ? null : Number.isInteger(value) && (value as number) > 0 ? value as number : undefined;

function unsafeProfilePath(value: string, ignored: boolean): boolean {
  const slashes = value.trim().replaceAll("\\", "/");
  const normalized = normalizePath(slashes);
  const segments = normalized.split("/");
  return !normalized || normalized === "." || segments.includes("..") || slashes.startsWith("/") || /^[a-z]:\//i.test(slashes) ||
    (ignored && segments[0].toLowerCase() === ".git");
}

export async function initializeProjectProfile(cwd: string): Promise<string> {
  const target = path.join(path.resolve(cwd), PROFILE_PATH);
  try { await readFile(target, "utf8"); throw new Error(`Project profile already exists: ${target}`); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(STARTER_PROFILE, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return target;
}

export async function loadProjectProfile(repoRoot: string): Promise<LoadedProjectProfile> {
  const target = path.join(repoRoot, PROFILE_PATH);
  let raw: string;
  try { raw = await readFile(target, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { enabled: true, loaded: false, path: PROFILE_PATH, profile: structuredClone(STARTER_PROFILE), warnings: ["No project profile found. Run `relaypoint init` to create one."] };
    return { enabled: true, loaded: false, path: PROFILE_PATH, profile: structuredClone(STARTER_PROFILE), warnings: ["Project profile could not be read. Defaults were used."] };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return { enabled: true, loaded: false, path: PROFILE_PATH, profile: structuredClone(STARTER_PROFILE), warnings: ["Project profile could not be parsed. Defaults were used."] }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { enabled: true, loaded: false, path: PROFILE_PATH, profile: structuredClone(STARTER_PROFILE), warnings: ["Project profile must be a JSON object. Defaults were used."] };

  const value = parsed as Record<string, unknown>;
  const warnings: string[] = [];
  const profile = structuredClone(STARTER_PROFILE);
  if (!optionalString(value.schema_version)) warnings.push("Project profile schema_version is missing or invalid; expected 0.3.0.");
  else { profile.schema_version = value.schema_version; if (value.schema_version !== "0.3.0") warnings.push(`Project profile schema_version '${value.schema_version}' differs from expected 0.3.0.`); }
  for (const key of ["project_name", "description"] as const) {
    if (value[key] === undefined) continue;
    if (optionalString(value[key])) profile[key] = value[key].trim(); else warnings.push(`Project profile ${key} must be a string; the default was used.`);
  }
  for (const key of ["critical_paths", "ignored_paths", "preferred_validation", "review_focus", "notes"] as const) {
    if (value[key] === undefined) continue;
    const normalized = stringArray(value[key]);
    if (normalized && key.endsWith("_paths")) {
      const safe = normalized.filter((entry) => {
        if (!unsafeProfilePath(entry, key === "ignored_paths")) return true;
        warnings.push(`Project profile ${key} entry '${entry}' is unsafe or not repository-relative and was ignored.`);
        return false;
      });
      profile[key] = safe.map(normalizePath);
    } else if (normalized) profile[key] = normalized;
    else warnings.push(`Project profile ${key} must be an array of strings; the default was used.`);
  }
  if (value.quality !== undefined) {
    if (!value.quality || typeof value.quality !== "object" || Array.isArray(value.quality)) warnings.push("Project profile quality must be an object; defaults were used.");
    else {
      const quality = value.quality as Record<string, unknown>;
      for (const key of ["max_file_lines", "max_function_lines", "max_line_length"] as const) {
        if (quality[key] === undefined) continue;
        const normalized = threshold(quality[key]);
        if (normalized === undefined) warnings.push(`Project profile quality.${key} must be a positive integer or null; the default was used.`); else profile.quality[key] = normalized;
      }
      if (quality.allow_todos !== undefined) {
        if (typeof quality.allow_todos === "boolean") profile.quality.allow_todos = quality.allow_todos;
        else warnings.push("Project profile quality.allow_todos must be a boolean; the default was used.");
      }
    }
  }
  return { enabled: true, loaded: true, path: PROFILE_PATH, profile, warnings };
}

export function pathMatchesPrefix(filePath: string, configuredPath: string): boolean {
  const file = normalizePath(filePath);
  const prefix = normalizePath(configuredPath);
  return Boolean(prefix) && (file === prefix || file.startsWith(`${prefix}/`));
}

export function applyIgnoredPaths(files: ChangedFile[], profile: LoadedProjectProfile): { files: ChangedFile[]; applied: string[] } {
  const applied = files.filter((file) => profile.profile.ignored_paths.some((prefix) => pathMatchesPrefix(file.path, prefix))).map((file) => file.path).sort();
  const ignored = new Set(applied);
  return { files: files.filter((file) => !ignored.has(file.path) && !file.path.replaceAll("\\", "/").startsWith(".relaypoint/")), applied };
}

export function createProjectProfileRecord(profile: LoadedProjectProfile, files: ChangedFile[], ignored: string[], project: DetectedProject): ProjectProfileRecord {
  if (!profile.loaded) return { enabled: true, loaded: false, path: PROFILE_PATH, warnings: profile.warnings };
  const critical = files.filter((file) => profile.profile.critical_paths.some((prefix) => pathMatchesPrefix(file.path, prefix))).map((file) => file.path).sort();
  const manager = project.package_manager === "unknown" ? "npm" : project.package_manager;
  const preferred = profile.profile.preferred_validation.filter((name) => project.type === "node" && Boolean(project.scripts[name])).map((name) => `${manager} run ${name}`).sort();
  return {
    enabled: true, loaded: true, path: PROFILE_PATH, schema_version: profile.profile.schema_version,
    project_name: profile.profile.project_name, warnings: profile.warnings, critical_paths_matched: critical,
    ignored_paths_applied: ignored, preferred_validation: preferred, review_focus: profile.profile.review_focus,
    description: profile.profile.description, quality: profile.profile.quality, notes: profile.profile.notes,
  };
}
