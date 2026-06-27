import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHandoff } from "../src/index.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("project profile handoff integration", () => {
  it("enriches evidence and excludes ignored paths without requiring validation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-profile-integration-"));
    roots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test", build: "node --check src/index.js" } }), "utf8");
    await writeFile(path.join(root, "src/index.js"), "export const value = 1;\n", "utf8");
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "fixture@example.com"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
    await writeFile(path.join(root, "src/index.js"), "export const value = 2;\n", "utf8");
    await mkdir(path.join(root, "scratch"));
    await writeFile(path.join(root, "scratch/debug.js"), "console.log('local');\n", "utf8");
    await mkdir(path.join(root, ".relaypoint"));
    await writeFile(path.join(root, ".relaypoint/project_profile.json"), JSON.stringify({
      schema_version: "0.3.0", project_name: "Fixture", description: "Integration fixture.", critical_paths: ["src/"], ignored_paths: ["scratch/"],
      preferred_validation: ["test", "build"], review_focus: ["preserve deterministic output"], notes: ["Review owner context."],
      quality: { max_file_lines: null, max_function_lines: null, max_line_length: 120, allow_todos: true },
    }), "utf8");

    const { record, runDir } = await createHandoff({ cwd: root, now: new Date("2026-06-21T12:00:00.000Z"), compare: false });
    expect(record.changed_files.map((file) => file.path)).toEqual(["src/index.js"]);
    expect(record.project_profile).toMatchObject({ loaded: true, critical_paths_matched: ["src/index.js"], ignored_paths_applied: ["scratch/debug.js"], preferred_validation: ["npm run build", "npm run test"] });
    expect(record.validation.results).toEqual([]);
    expect(record.readiness).toBe("NEEDS_VALIDATION");
    const agent = await readFile(path.join(runDir, "AGENT_HANDOFF.md"), "utf8");
    const qa = await readFile(path.join(runDir, "QA_REPORT.md"), "utf8");
    const handoff = await readFile(path.join(runDir, "HANDOFF.md"), "utf8");
    const quality = await readFile(path.join(runDir, "QUALITY_REVIEW.md"), "utf8");
    expect(agent).toContain("## Project Context");
    expect(agent).toContain("preserve deterministic output");
    expect(agent.toLowerCase()).not.toContain("next agent should build");
    expect(qa).toContain("### Preferred validation not run");
    expect(qa).toContain("npm run test");
    expect(handoff).toContain("## Project Profile");
    expect(quality).toContain("max line length 120");
  });
});
