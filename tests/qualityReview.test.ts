import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reviewChangedFiles } from "../src/qualityReview.js";
import type { ChangedFile } from "../src/types.js";

const roots: string[] = [];
async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-quality-"));
  roots.push(root);
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), contents, "utf8");
  }
  return root;
}
function changed(pathname: string, category: ChangedFile["category"]): ChangedFile {
  return { path: pathname, status: " M", category };
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("deterministic quality review", () => {
  it("detects long lines and review markers", async () => {
    const longLine = `const value = "${"x".repeat(170)}";`;
    const root = await fixture({ "src/example.ts": `${longLine}\n${longLine}\n${longLine}\n${longLine}\n${longLine}\n// TODO: confirm this boundary\n` });
    const review = await reviewChangedFiles(root, [changed("src/example.ts", "source"), changed("tests/example.test.ts", "test")]);
    expect(review.filesReviewed).toBe(1);
    expect(review.findings.map((item) => item.category)).toEqual(expect.arrayContaining(["long-line", "review-marker"]));
  });

  it("detects large files, long functions, and approximate deep nesting", async () => {
    const body = Array.from({ length: 102 }, (_, index) => `  const value${index} = ${index};`).join("\n");
    const source = `export function large() {\n  if (true) {\n    if (true) {\n      if (true) {\n        if (true) {\n          if (true) {\n            if (true) {\n${body}\n            }\n          }\n        }\n      }\n    }\n  }\n}\n${"\n".repeat(500)}`;
    const root = await fixture({ "src/large.ts": source, "tests/large.test.ts": "// test fixture\n" });
    const review = await reviewChangedFiles(root, [changed("src/large.ts", "source"), changed("tests/large.test.ts", "test")]);
    expect(review.highestSeverity).toBe("high");
    expect(review.findings.map((item) => item.category)).toEqual(expect.arrayContaining(["file-size", "long-function", "deep-nesting"]));
  });

  it("detects long Markdown sections and repeated headings", async () => {
    const document = `# Intro\n${Array.from({ length: 105 }, (_, index) => `Paragraph ${index}`).join("\n")}\n## Repeated\nText\n## Repeated\nText\n`;
    const root = await fixture({ "docs/guide.md": document });
    const review = await reviewChangedFiles(root, [changed("docs/guide.md", "docs")]);
    expect(review.findings.map((item) => item.category)).toEqual(expect.arrayContaining(["long-markdown-section", "repeated-heading"]));
  });

  it("ignores Relaypoint and generated dependency paths", async () => {
    const root = await fixture({ ".relaypoint/latest/QUALITY_REVIEW.md": `${"x".repeat(140)}\nTODO\n`, "dist/output.js": "TODO\n" });
    const review = await reviewChangedFiles(root, [changed(".relaypoint/latest/QUALITY_REVIEW.md", "generated"), changed("dist/output.js", "generated")]);
    expect(review).toMatchObject({ filesReviewed: 0, findingCount: 0, findings: [] });
  });

  it("orders findings deterministically by severity, file, and category", async () => {
    const longLine = `const value = "${"x".repeat(170)}";`;
    const root = await fixture({ "src/z.ts": `${longLine}\n${longLine}\n${longLine}\n${longLine}\n${longLine}\n// TODO: review\n`, "src/a.ts": "// FIXME: review\n" });
    const review = await reviewChangedFiles(root, [changed("src/z.ts", "source"), changed("src/a.ts", "source")]);
    expect(review.findings.map(({ severity, file, category }) => [severity, file, category])).toEqual([
      ["medium", "src/a.ts", "review-marker"],
      ["medium", "src/z.ts", "review-marker"],
      ["low", "src/z.ts", "long-line"],
    ]);
  });
});
