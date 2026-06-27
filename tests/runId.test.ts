import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareRunIds, createUniqueRun, formatRunTimestamp } from "../src/runId.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-run-id-"));
  roots.push(root);
  return path.join(root, "runs");
}

describe("collision-safe run IDs", () => {
  const now = new Date("2026-06-21T18:30:00.123Z");
  const base = "2026-06-21T18-30-00-123Z";

  it("formats timestamps deterministically without Windows-unsafe characters", () => {
    expect(formatRunTimestamp(now)).toBe(base);
    expect(formatRunTimestamp(now)).not.toMatch(/[<>:"/\\|?*.]/);
  });

  it("uses the timestamp when no collision exists", async () => {
    const runsDir = await fixture();
    const allocated = await createUniqueRun({ runsDir, now });
    expect(allocated).toEqual({ runId: base, runDir: path.join(runsDir, base) });
  });

  it("increments deterministic suffixes without reusing existing directories", async () => {
    const runsDir = await fixture();
    await mkdir(path.join(runsDir, base), { recursive: true });
    await mkdir(path.join(runsDir, `${base}-001`));
    await writeFile(path.join(runsDir, base, "sentinel.txt"), "base");
    await writeFile(path.join(runsDir, `${base}-001`, "sentinel.txt"), "first collision");

    const allocated = await createUniqueRun({ runsDir, now });

    expect(allocated.runId).toBe(`${base}-002`);
    expect(await readFile(path.join(runsDir, base, "sentinel.txt"), "utf8")).toBe("base");
    expect(await readFile(path.join(runsDir, `${base}-001`, "sentinel.txt"), "utf8")).toBe("first collision");
    await expect(mkdir(path.join(runsDir, base))).rejects.toMatchObject({ code: "EEXIST" });
    await expect(mkdir(path.join(runsDir, `${base}-001`))).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("allocates distinct IDs for concurrent requests", async () => {
    const runsDir = await fixture();
    const allocated = await Promise.all([
      createUniqueRun({ runsDir, now }),
      createUniqueRun({ runsDir, now }),
      createUniqueRun({ runsDir, now }),
    ]);
    expect(allocated.map((run) => run.runId).sort()).toEqual([base, `${base}-001`, `${base}-002`]);
    expect((await readdir(runsDir)).sort()).toEqual([base, `${base}-001`, `${base}-002`]);
  });

  it("sorts suffixes in allocation order beyond three digits", () => {
    const runIds = [`${base}-1000`, `${base}-999`, `${base}-002`, base, `${base}-001`];
    expect(runIds.sort(compareRunIds)).toEqual([
      base,
      `${base}-001`,
      `${base}-002`,
      `${base}-999`,
      `${base}-1000`,
    ]);
  });
});
