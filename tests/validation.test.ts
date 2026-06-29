import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverValidationCommands, runRequestedValidations } from "../src/validation.js";
import type { DetectedProject } from "../src/types.js";

const project: DetectedProject = { type: "node", package_manager: "npm", scripts: { test: "vitest", start: "node app.js", build: "tsc" }, validation_suggestions: [] };
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("validation", () => {
  it("discovers only known validation scripts", () => expect(discoverValidationCommands(project)).toEqual(["npm run test", "npm run build"]));
  it("skips a requested missing script", async () => {
    const [result] = await runRequestedValidations(process.cwd(), project, ["lint"]);
    expect(result).toMatchObject({ command: "npm run lint", status: "skipped", exit_code: null });
  });

  it("records requested passing and failing package scripts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-validation-"));
    roots.push(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      scripts: {
        pass: "node -e \"process.exit(0)\"",
        fail: "node -e \"process.exit(7)\"",
      },
    }));
    const fixture: DetectedProject = {
      type: "node",
      package_manager: "npm",
      scripts: {
        pass: "node -e \"process.exit(0)\"",
        fail: "node -e \"process.exit(7)\"",
      },
      validation_suggestions: [],
    };

    const results = await runRequestedValidations(root, fixture, ["pass", "fail"]);

    expect(results).toMatchObject([
      { script: "pass", status: "passed", exit_code: 0 },
      { script: "fail", status: "failed", exit_code: 7 },
    ]);
  });

  it("does not run validation when none is requested", async () => {
    await expect(runRequestedValidations(process.cwd(), project, [])).resolves.toEqual([]);
  });
});
