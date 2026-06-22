import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHandoff } from "../src/index.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("run comparison handoff integration", () => {
  it("selects the previous run before writing, copies output to latest, and supports disabling", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-comparison-"));
    roots.push(root);
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    await writeFile(path.join(root, "package.json"), '{"name":"fixture","scripts":{"test":"node --test"}}\n');

    const first = await createHandoff({ cwd: root, now: new Date("2026-06-21T10:00:00.000Z") });
    expect(first.record.comparison).toMatchObject({ enabled: true, available: false, reason: "No previous Relaypoint run was found." });
    const second = await createHandoff({ cwd: root, now: new Date("2026-06-21T10:01:00.000Z") });
    expect(second.record.comparison).toMatchObject({ available: true, previous_run_id: first.record.run_id });
    expect(second.record.comparison.previous_run_id).not.toBe(second.record.run_id);
    expect(await readFile(path.join(root, ".relaypoint", "latest", "RUN_COMPARISON.md"), "utf8")).toContain(first.record.run_id);
    const latest = JSON.parse(await readFile(path.join(root, ".relaypoint", "latest", "RUN_RECORD.json"), "utf8"));
    expect(latest.outputs.run_comparison).toBe("RUN_COMPARISON.md");
    expect(latest.comparison.available).toBe(true);

    const sameId = await createHandoff({ cwd: root, now: new Date("2026-06-21T10:01:00.000Z") });
    expect(sameId.record.comparison.previous_run_id).toBe(first.record.run_id);
    expect(sameId.record.comparison.previous_run_id).not.toBe(sameId.record.run_id);

    const disabled = await createHandoff({ cwd: root, compare: false, now: new Date("2026-06-21T10:02:00.000Z") });
    expect(disabled.record.comparison).toEqual({ enabled: false, available: false, reason: "Comparison disabled by --no-compare." });
  });
});
