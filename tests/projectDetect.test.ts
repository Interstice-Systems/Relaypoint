import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectProject } from "../src/projectDetect.js";

describe("project detection", () => {
  it("detects Node scripts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-node-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "vitest" } }));
    expect(await detectProject(root)).toMatchObject({ type: "node", name: "fixture", scripts: { test: "vitest" } });
  });

  it("detects Python and unknown projects", async () => {
    const python = await mkdtemp(path.join(os.tmpdir(), "relaypoint-python-"));
    await writeFile(path.join(python, "pyproject.toml"), "[project]\nname='fixture'\n");
    expect((await detectProject(python)).type).toBe("python");
    expect((await detectProject(await mkdtemp(path.join(os.tmpdir(), "relaypoint-unknown-")))).type).toBe("unknown");
  });
});
