import { describe, expect, it } from "vitest";
import { classifyChangedFiles, classifyFile } from "../src/classifyFiles.js";

describe("file classification", () => {
  it.each([
    ["src/index.ts", "source"], ["tests/index.test.ts", "test"], ["README.md", "docs"],
    ["package.json", "config"], ["package-lock.json", "lockfile"], ["dist/index.js", "generated"], ["assets/data.bin", "unknown"],
  ])("classifies %s as %s", (file, expected) => expect(classifyFile(file)).toBe(expected));

  it("excludes Relaypoint output", () => {
    expect(classifyChangedFiles([{ path: ".relaypoint/latest/HANDOFF.md", status: "??" }, { path: "src/a.ts", status: " M" }])).toEqual([
      { path: "src/a.ts", status: " M", category: "source" },
    ]);
  });
});
