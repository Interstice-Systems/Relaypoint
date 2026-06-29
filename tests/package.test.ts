import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("package distribution metadata", () => {
  it("defines the installable CLI package metadata", async () => {
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    expect(packageJson).toMatchObject({
      name: "relaypoint",
      version: "0.8.0",
      description: "Deterministic evidence infrastructure for AI-assisted software engineering.",
      type: "module",
      bin: { relaypoint: "./dist/cli.js" },
      engines: { node: ">=20" },
      license: "MIT",
    });
    expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE", "examples"]);
    expect(packageJson.files).not.toContain("src");
    expect(packageJson.files).not.toContain("tests");
    expect(packageJson.scripts["pack:check"]).toBe("npm pack --dry-run");
  });

  it("documents local npm-link installation without claiming registry publication", async () => {
    const readme = await readFile(path.join(root, "README.md"), "utf8");
    expect(readme).toContain("npm link");
    expect(readme).toContain("Before npm publication");
    expect(readme).toContain("Run `npm run build` before `npm pack`");
    expect(readme).toContain("npm run dev -- --help");
    expect(readme).toMatch(/network connection/i);
  });

  it("keeps the example configuration snippets valid JSON", async () => {
    const examples = await readFile(path.join(root, "examples", "README.md"), "utf8");
    const snippets = [...examples.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1]);
    expect(snippets).toHaveLength(2);
    for (const snippet of snippets) expect(() => JSON.parse(snippet)).not.toThrow();
  });
});
