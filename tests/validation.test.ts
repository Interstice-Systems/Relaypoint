import { describe, expect, it } from "vitest";
import { discoverValidationCommands, runRequestedValidations } from "../src/validation.js";
import type { DetectedProject } from "../src/types.js";

const project: DetectedProject = { type: "node", package_manager: "npm", scripts: { test: "vitest", start: "node app.js", build: "tsc" }, validation_suggestions: [] };

describe("validation", () => {
  it("discovers only known validation scripts", () => expect(discoverValidationCommands(project)).toEqual(["npm run test", "npm run build"]));
  it("skips a requested missing script", async () => {
    const [result] = await runRequestedValidations(process.cwd(), project, ["lint"]);
    expect(result).toMatchObject({ command: "npm run lint", status: "skipped", exit_code: null });
  });
});
