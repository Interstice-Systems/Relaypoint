import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyIgnoredPaths, createProjectProfileRecord, initializeProjectProfile, loadProjectProfile, pathMatchesPrefix, PROFILE_PATH } from "../src/projectProfile.js";

const roots: string[] = [];
async function root(): Promise<string> { const value = await mkdtemp(path.join(os.tmpdir(), "relaypoint-profile-")); roots.push(value); return value; }
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });

describe("project profile", () => {
  it("initializes a starter profile and refuses to overwrite it", async () => {
    const cwd = await root();
    const target = await initializeProjectProfile(cwd);
    const before = await readFile(target, "utf8");
    expect(JSON.parse(before)).toMatchObject({ schema_version: "0.3.0", critical_paths: [], quality: { allow_todos: true } });
    await expect(initializeProjectProfile(cwd)).rejects.toThrow("Project profile already exists");
    expect(await readFile(target, "utf8")).toBe(before);
  });

  it("handles missing and malformed profiles with stable warnings", async () => {
    const cwd = await root();
    const missing = await loadProjectProfile(cwd);
    expect(missing).toMatchObject({ loaded: false, path: PROFILE_PATH });
    expect(missing.warnings[0]).toContain("relaypoint init");
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, PROFILE_PATH), "{not json", "utf8");
    const malformed = await loadProjectProfile(cwd);
    expect(malformed).toMatchObject({ loaded: false, warnings: ["Project profile could not be parsed. Defaults were used."] });
  });

  it("loads valid context, filters ignored files, and records deterministic matches", async () => {
    const cwd = await root();
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, PROFILE_PATH), JSON.stringify({
      schema_version: "0.3.0", project_name: "Fixture", description: "Local evidence fixture.",
      critical_paths: ["src/", "package.json"], ignored_paths: ["scratch/"], preferred_validation: ["build", "test", "missing"],
      review_focus: ["preserve deterministic output"], quality: { max_line_length: 120, allow_todos: false }, notes: ["Owner-defined note."],
    }), "utf8");
    const loaded = await loadProjectProfile(cwd);
    const changed = [
      { path: "src/index.ts", status: " M", category: "source" as const },
      { path: "package.json", status: " M", category: "config" as const },
      { path: "scratch/debug.ts", status: "??", category: "source" as const },
      { path: ".relaypoint/latest/HANDOFF.md", status: "??", category: "generated" as const },
    ];
    const filtered = applyIgnoredPaths(changed, loaded);
    expect(filtered.files.map((file) => file.path)).toEqual(["src/index.ts", "package.json"]);
    expect(filtered.applied).toEqual(["scratch/debug.ts"]);
    const record = createProjectProfileRecord(loaded, filtered.files, filtered.applied, { type: "node", package_manager: "npm", scripts: { test: "vitest", build: "tsc" }, validation_suggestions: [] });
    expect(record).toMatchObject({ loaded: true, project_name: "Fixture", critical_paths_matched: ["package.json", "src/index.ts"], ignored_paths_applied: ["scratch/debug.ts"], preferred_validation: ["npm run build", "npm run test"], review_focus: ["preserve deterministic output"] });
  });

  it("warns on schema and field mismatches while retaining valid fields", async () => {
    const cwd = await root();
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, PROFILE_PATH), JSON.stringify({ schema_version: "0.2.0", project_name: "Fixture", notes: "invalid" }), "utf8");
    const loaded = await loadProjectProfile(cwd);
    expect(loaded.loaded).toBe(true);
    expect(loaded.profile.project_name).toBe("Fixture");
    expect(loaded.warnings.join(" ")).toContain("differs from expected 0.3.0");
    expect(loaded.warnings.join(" ")).toContain("notes must be an array of strings");
  });

  it("rejects unsafe or non-repository-relative profile paths", async () => {
    const cwd = await root();
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, PROFILE_PATH), JSON.stringify({
      schema_version: "0.3.0",
      ignored_paths: ["/", ".", "..", ".git", ".git/objects", "/src", "C:\\temp", "safe/"],
      critical_paths: ["../outside", "/absolute", "src/"],
    }), "utf8");
    const loaded = await loadProjectProfile(cwd);
    expect(loaded.profile.ignored_paths).toEqual(["safe"]);
    expect(loaded.profile.critical_paths).toEqual(["src"]);
    expect(loaded.warnings).toHaveLength(9);
    expect(loaded.warnings.join(" ")).toContain("unsafe or not repository-relative");
    const record = createProjectProfileRecord(loaded, [], [], { type: "unknown", package_manager: "unknown", scripts: {}, validation_suggestions: [] });
    expect(record.warnings).toEqual(loaded.warnings);
  });

  it("matches normalized path prefixes without matching adjacent names", () => {
    expect(pathMatchesPrefix("src\\cli.ts", "src/")).toBe(true);
    expect(pathMatchesPrefix("src", "src/")).toBe(true);
    expect(pathMatchesPrefix("src-other/cli.ts", "src/")).toBe(false);
  });

  it("falls back safely for invalid and null quality thresholds", async () => {
    const cwd = await root();
    await mkdir(path.join(cwd, ".relaypoint"));
    await writeFile(path.join(cwd, PROFILE_PATH), JSON.stringify({
      schema_version: "0.3.0",
      quality: { max_file_lines: 0, max_function_lines: -1, max_line_length: null, allow_todos: "yes" },
    }), "utf8");
    const loaded = await loadProjectProfile(cwd);
    expect(loaded.profile.quality).toEqual({ max_file_lines: null, max_function_lines: null, max_line_length: null, allow_todos: true });
    expect(loaded.warnings).toHaveLength(3);
  });
});
